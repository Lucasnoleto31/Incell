"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/auditoria";
import { ehGestao } from "@/lib/papeis";
import type { PerfilSessao } from "@/lib/auth";
import {
  CAMINHO_LOJA,
  CAMINHO_VENDAS,
  ehFormaPagamento,
  lerCentavos,
  lerInteiro,
  lerUuid,
  type FormaPagamento,
} from "@/lib/loja";
import { comVoltar, lerVoltar, voltarDiferenteDe } from "../../contatos/voltar";
import type { ResultadoAcao } from "../../configuracoes/resultado";
import { quemEscreveNaLoja, SEM_PERMISSAO_LOJA } from "../acesso";
import { falhaDe, texto, type EstadoForm } from "../estado-form";

/*
 * As actions das vendas. A venda nasce pelo formulário (com os itens de uma
 * vez, em JSON num campo escondido) e pode ser concluída no mesmo gesto; a
 * ficha acrescenta e tira itens enquanto está em aberto, conclui e cancela.
 * Concluir dá baixa no estoque dos itens que vieram de lá; cancelar uma
 * concluída devolve.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>;

function revalidar(id?: string) {
  revalidatePath(CAMINHO_LOJA, "layout");
  if (id) revalidatePath(`${CAMINHO_VENDAS}/${id}`);
}

/** Uma linha de item como o formulário manda. */
type ItemLido = {
  item_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario_centavos: number;
};

/** Os itens do campo escondido `itens` (JSON), conferidos um a um. */
function lerItens(
  bruto: unknown,
): { itens: ItemLido[]; erro?: undefined } | { itens?: undefined; erro: string } {
  if (typeof bruto !== "string" || !bruto) return { erro: "Acrescente ao menos um item." };
  let lista: unknown;
  try {
    lista = JSON.parse(bruto);
  } catch {
    return { erro: "Os itens vieram num formato inesperado. Recarregue a página." };
  }
  if (!Array.isArray(lista) || lista.length === 0) return { erro: "Acrescente ao menos um item." };
  if (lista.length > 100) return { erro: "No máximo 100 itens por venda." };
  const itens: ItemLido[] = [];
  for (const l of lista) {
    const o = (l ?? {}) as Record<string, unknown>;
    const descricao = String(o.descricao ?? "").trim().slice(0, 200);
    if (!descricao) return { erro: "Todo item precisa de descrição." };
    const quantidade = lerInteiro(String(o.quantidade ?? ""), 1);
    if (quantidade === null) return { erro: `Quantidade inválida em “${descricao}”.` };
    const valor = lerCentavos(String(o.valor ?? "0"));
    if (valor === null) return { erro: `Valor inválido em “${descricao}”.` };
    itens.push({
      item_id: lerUuid(o.item_id),
      descricao,
      quantidade,
      valor_unitario_centavos: valor,
    });
  }
  return { itens };
}

type Pagamento = {
  forma_pagamento: FormaPagamento | null;
  parcelas: number;
  desconto_centavos: number;
  observacao: string | null;
};

/** Os campos de pagamento, comuns ao cadastro e à ficha. */
function lerPagamento(
  formData: FormData,
): { valores: Pagamento; erro?: undefined } | { valores?: undefined; erro: string } {
  const formaBruta = formData.get("forma_pagamento");
  const forma = ehFormaPagamento(formaBruta) ? formaBruta : null;
  const parcelasTexto = texto(formData, "parcelas", 3);
  const parcelas = parcelasTexto ? lerInteiro(parcelasTexto, 1) : 1;
  if (parcelas === null || parcelas > 24) return { erro: "Parcelas: de 1 a 24." };
  const descontoTexto = texto(formData, "desconto", 40);
  const desconto = descontoTexto ? lerCentavos(descontoTexto) : 0;
  if (desconto === null) return { erro: "Desconto inválido. Exemplo: 20,00." };
  return {
    valores: {
      forma_pagamento: forma,
      parcelas: forma === "cartao_credito" ? parcelas : 1,
      desconto_centavos: desconto,
      observacao: texto(formData, "observacao", 2000) || null,
    },
  };
}

/** Registra a venda (e conclui, se pedido) e abre a ficha. */
export async function criarVenda(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await quemEscreveNaLoja();
  const falha = falhaDe(anterior);
  if (!perfil) return falha(SEM_PERMISSAO_LOJA);

  const itensLidos = lerItens(formData.get("itens"));
  if (itensLidos.erro !== undefined) return falha(itensLidos.erro, "itens");
  const pagamento = lerPagamento(formData);
  if (pagamento.erro !== undefined) return falha(pagamento.erro, "desconto");
  const clienteId = lerUuid(formData.get("cliente_id"));
  // Só a gestão vende em nome de outra pessoa.
  const vendedorPedido = lerUuid(formData.get("vendedor_id"));
  const vendedorId = ehGestao(perfil.papel) && vendedorPedido ? vendedorPedido : perfil.id;
  const concluirAgora = formData.get("concluir") === "1";
  if (concluirAgora && !pagamento.valores.forma_pagamento) {
    return falha("Para concluir agora, escolha a forma de pagamento.", "forma_pagamento");
  }
  const voltar = voltarDiferenteDe(lerVoltar(formData.get("voltar")), `${CAMINHO_VENDAS}/nova`);

  const supabase = await createClient();
  const { data: venda, error } = await supabase
    .from("vendas")
    .insert({ ...pagamento.valores, cliente_id: clienteId, vendedor_id: vendedorId })
    .select("id, numero")
    .single();
  if (error) return falha(`Não deu para registrar a venda: ${error.message}`);

  const { error: erroItens } = await supabase
    .from("vendas_itens")
    .insert(itensLidos.itens.map((i) => ({ ...i, venda_id: venda.id })));
  if (erroItens) {
    await supabase.from("vendas").delete().eq("id", venda.id);
    return falha(`Não deu para gravar os itens: ${erroItens.message}`);
  }

  registrarAcesso(perfil.id, "criou_venda", { venda_id: venda.id, numero: venda.numero });

  if (concluirAgora) {
    const r = await concluir(supabase, perfil, venda.id);
    if (r.erro) {
      // A venda fica em aberto, com o aviso: a pessoa resolve na ficha.
      revalidar();
      redirect(comVoltar(`${CAMINHO_VENDAS}/${venda.id}?aviso=sem_estoque`, voltar));
    }
  }

  revalidar();
  redirect(comVoltar(`${CAMINHO_VENDAS}/${venda.id}`, voltar));
}

/**
 * Conclui: baixa no estoque de cada item que veio de lá e carimba. Sem
 * saldo em algum, desfaz as baixas já feitas e volta com o erro.
 */
async function concluir(
  supabase: Cliente,
  perfil: PerfilSessao,
  vendaId: string,
): Promise<{ erro?: string }> {
  const { data: venda, error } = await supabase
    .from("vendas")
    .select("id, numero, status, vendedor_id, forma_pagamento")
    .eq("id", vendaId)
    .maybeSingle();
  if (error || !venda) return { erro: "Venda não encontrada." };
  if (venda.status !== "aberta") return { erro: "Esta venda já foi concluída ou cancelada." };
  if (venda.vendedor_id !== perfil.id && !ehGestao(perfil.papel)) {
    return { erro: "Só quem vendeu (ou a gestão) conclui a venda." };
  }
  if (!venda.forma_pagamento) return { erro: "Escolha a forma de pagamento antes de concluir." };

  const { data: itens } = await supabase
    .from("vendas_itens")
    .select("id, item_id, quantidade, descricao")
    .eq("venda_id", vendaId);
  if (!itens || itens.length === 0) return { erro: "A venda está sem itens." };

  const feitos: string[] = [];
  for (const i of itens) {
    if (!i.item_id) continue;
    const { data: mov, error: erroMov } = await supabase
      .from("estoque_movimentos")
      .insert({
        item_id: i.item_id,
        tipo: "saida",
        delta: -i.quantidade,
        origem: "venda",
        venda_id: vendaId,
        por: perfil.id,
      })
      .select("id")
      .single();
    if (erroMov) {
      // Desfaz o que já saiu: a gestão apaga o movimento; os demais lançam a
      // entrada contrária (o resultado no saldo é o mesmo).
      for (const id of feitos) {
        const { error: erroApaga } = await supabase.from("estoque_movimentos").delete().eq("id", id);
        if (erroApaga) {
          const { data: m } = await supabase
            .from("estoque_movimentos")
            .select("item_id, delta")
            .eq("id", id)
            .maybeSingle();
          if (m) {
            await supabase.from("estoque_movimentos").insert({
              item_id: m.item_id,
              tipo: "entrada",
              delta: -m.delta,
              origem: "estorno",
              venda_id: vendaId,
              observacao: "Conclusão da venda desfeita por falta de saldo",
              por: perfil.id,
            });
          }
        }
      }
      return {
        erro:
          erroMov.code === "23514"
            ? `Sem saldo em estoque para “${i.descricao}”. Lance a entrada no item ou tire a linha da venda.`
            : `Não deu para dar baixa no estoque: ${erroMov.message}`,
      };
    }
    feitos.push(mov.id);
  }

  const { error: erroStatus } = await supabase
    .from("vendas")
    .update({ status: "concluida", concluida_em: new Date().toISOString() })
    .eq("id", vendaId)
    .eq("status", "aberta");
  if (erroStatus) return { erro: `Não deu para concluir: ${erroStatus.message}` };

  registrarAcesso(perfil.id, "concluiu_venda", { venda_id: vendaId, numero: venda.numero });
  return {};
}

export async function concluirVenda(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Venda não encontrada." };
  const supabase = await createClient();
  const r = await concluir(supabase, perfil, id);
  revalidar(id);
  return r.erro ? { erro: r.erro } : { ok: "Venda concluída." };
}

/** Cancela. Se já estava concluída, os itens do estoque voltam ao saldo. */
export async function cancelarVenda(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Venda não encontrada." };
  const motivo = texto(formData, "motivo", 500) || null;

  const supabase = await createClient();
  const { data: venda, error } = await supabase
    .from("vendas")
    .select("id, numero, status, vendedor_id, observacao")
    .eq("id", id)
    .maybeSingle();
  if (error || !venda) return { erro: "Venda não encontrada." };
  if (venda.status === "cancelada") return { erro: "A venda já está cancelada." };
  if (venda.status === "concluida" && !ehGestao(perfil.papel)) {
    return { erro: "Venda concluída só a gestão cancela." };
  }
  if (venda.vendedor_id !== perfil.id && !ehGestao(perfil.papel)) {
    return { erro: "Só quem vendeu (ou a gestão) cancela a venda." };
  }

  if (venda.status === "concluida") {
    const { data: itens } = await supabase
      .from("vendas_itens")
      .select("item_id, quantidade")
      .eq("venda_id", id)
      .not("item_id", "is", null);
    for (const i of itens ?? []) {
      await supabase.from("estoque_movimentos").insert({
        item_id: i.item_id,
        tipo: "entrada",
        delta: i.quantidade,
        origem: "estorno",
        venda_id: id,
        observacao: "Venda cancelada",
        por: perfil.id,
      });
    }
  }

  const observacao = motivo
    ? [venda.observacao, `Cancelada: ${motivo}`].filter(Boolean).join("\n")
    : venda.observacao;
  const { error: erroStatus } = await supabase
    .from("vendas")
    .update({ status: "cancelada", cancelada_em: new Date().toISOString(), observacao })
    .eq("id", id);
  if (erroStatus) return { erro: `Não deu para cancelar: ${erroStatus.message}` };

  registrarAcesso(perfil.id, "cancelou_venda", { venda_id: id, numero: venda.numero, motivo });
  revalidar(id);
  return { ok: "Venda cancelada." };
}

/** Pagamento, parcelas, desconto e observação de uma venda em aberto. */
export async function atualizarPagamento(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Venda não encontrada." };
  const pagamento = lerPagamento(formData);
  if (pagamento.erro !== undefined) return { erro: pagamento.erro };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendas")
    .update(pagamento.valores)
    .eq("id", id)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();
  if (error) return { erro: `Não deu para salvar: ${error.message}` };
  if (!data) return { erro: "A venda não está mais em aberto." };
  revalidar(id);
  return { ok: "Pagamento salvo." };
}

/** Acrescenta uma linha à venda em aberto (a baixa é só na conclusão). */
export async function adicionarItemVenda(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const vendaId = lerUuid(formData.get("venda_id"));
  if (!vendaId) return { erro: "Venda não encontrada." };
  const descricao = texto(formData, "descricao", 200);
  if (!descricao) return { erro: "Descreva o item." };
  const quantidade = lerInteiro(texto(formData, "quantidade", 6) || "1", 1);
  if (quantidade === null) return { erro: "Quantidade: um número inteiro, 1 ou mais." };
  const valor = lerCentavos(texto(formData, "valor_unitario", 40) || "0");
  if (valor === null) return { erro: "Valor unitário inválido. Exemplo: 120,00." };

  const supabase = await createClient();
  const { data: venda } = await supabase
    .from("vendas")
    .select("status")
    .eq("id", vendaId)
    .maybeSingle();
  if (!venda) return { erro: "Venda não encontrada." };
  if (venda.status !== "aberta") return { erro: "A venda não está mais em aberto." };

  const { error } = await supabase.from("vendas_itens").insert({
    venda_id: vendaId,
    item_id: lerUuid(formData.get("item_id")),
    descricao,
    quantidade,
    valor_unitario_centavos: valor,
  });
  if (error) return { erro: `Não deu para acrescentar: ${error.message}` };
  revalidar(vendaId);
  return { ok: "Item acrescentado." };
}

export async function removerItemVenda(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Linha não encontrada." };

  const supabase = await createClient();
  const { data: linha } = await supabase
    .from("vendas_itens")
    .select("venda_id, venda:vendas(status)")
    .eq("id", id)
    .maybeSingle();
  const venda = linha?.venda as unknown as { status: string } | null;
  if (!linha || !venda) return { erro: "Linha não encontrada." };
  if (venda.status !== "aberta") return { erro: "A venda não está mais em aberto." };

  const { error } = await supabase.from("vendas_itens").delete().eq("id", id);
  if (error) return { erro: `Não deu para tirar: ${error.message}` };
  revalidar(linha.venda_id);
  return { ok: "Item tirado da venda." };
}
