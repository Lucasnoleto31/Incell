"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/auditoria";
import {
  CAMINHO_ESTOQUE,
  CAMINHO_LOJA,
  ehCondicao,
  ehTipoItem,
  ehTipoMovimento,
  lerCentavos,
  lerInteiro,
  lerUuid,
  type Condicao,
  type TipoItem,
} from "@/lib/loja";
import { comVoltar, lerVoltar, voltarDiferenteDe } from "../../contatos/voltar";
import type { ResultadoAcao } from "../../configuracoes/resultado";
import { quemEscreveNaLoja, SEM_PERMISSAO_LOJA } from "../acesso";
import { falhaDe, texto, type EstadoForm, type Lido } from "../estado-form";

/*
 * As actions do estoque. O item se cadastra e se edita por formulário
 * (EstadoForm, redireciona ao gravar); o saldo só muda por movimento
 * (lançarMovimento, { ok, erro }), nunca editando a quantidade à mão: o
 * gatilho do banco (0070) é quem soma.
 */

function revalidar(id?: string) {
  revalidatePath(CAMINHO_LOJA, "layout");
  if (id) revalidatePath(`${CAMINHO_ESTOQUE}/${id}`);
}

function amigavel(codigo: string | undefined, mensagem: string): string {
  if (codigo === "23505") {
    return mensagem.includes("imei")
      ? "Já existe um item com esse IMEI."
      : "Já existe um item com esse SKU.";
  }
  return mensagem;
}

type ValoresItem = {
  tipo: TipoItem;
  nome: string;
  sku: string | null;
  descricao: string | null;
  condicao: Condicao | null;
  imei: string | null;
  custo_centavos: number;
  preco_centavos: number;
  estoque_minimo: number;
};

/** Os campos do item, já conferidos. */
function lerCamposItem(formData: FormData, anterior: EstadoForm): Lido<ValoresItem> {
  const falha = falhaDe(anterior);
  const tipo = formData.get("tipo");
  if (!ehTipoItem(tipo)) return { erro: falha("Escolha o tipo do item.", "tipo") };
  const nome = texto(formData, "nome", 160);
  if (!nome) return { erro: falha("Informe o nome do item.", "nome") };

  const custoTexto = texto(formData, "custo", 40);
  const custo = custoTexto ? lerCentavos(custoTexto) : 0;
  if (custo === null) return { erro: falha("Custo inválido. Exemplo: 180,00.", "custo") };
  const precoTexto = texto(formData, "preco", 40);
  const preco = precoTexto ? lerCentavos(precoTexto) : 0;
  if (preco === null) return { erro: falha("Preço inválido. Exemplo: 350,00.", "preco") };

  const minimoTexto = texto(formData, "estoque_minimo", 6);
  const minimo = minimoTexto ? lerInteiro(minimoTexto, 0) : 0;
  if (minimo === null) {
    return { erro: falha("Estoque mínimo: um número inteiro, 0 para não avisar.", "estoque_minimo") };
  }

  const condicaoBruta = formData.get("condicao");
  const condicao = tipo === "aparelho" && ehCondicao(condicaoBruta) ? condicaoBruta : null;
  const imei = tipo === "aparelho" ? texto(formData, "imei", 40) || null : null;

  return {
    valores: {
      tipo,
      nome,
      sku: texto(formData, "sku", 60) || null,
      descricao: texto(formData, "descricao", 2000) || null,
      condicao,
      imei,
      custo_centavos: custo,
      preco_centavos: preco,
      estoque_minimo: minimo,
    },
  };
}

/** Cadastra o item e, se veio com saldo, lança a entrada inicial. */
export async function criarItem(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return falhaDe(anterior)(SEM_PERMISSAO_LOJA);
  const lido = lerCamposItem(formData, anterior);
  if (lido.erro) return lido.erro;
  const inicialTexto = texto(formData, "quantidade_inicial", 8);
  const inicial = inicialTexto ? lerInteiro(inicialTexto, 0) : 0;
  if (inicial === null) {
    return falhaDe(anterior)("Quantidade inicial: um número inteiro.", "quantidade_inicial");
  }
  const voltar = voltarDiferenteDe(lerVoltar(formData.get("voltar")), `${CAMINHO_ESTOQUE}/novo`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque_itens")
    .insert({ ...lido.valores, criado_por: perfil.id })
    .select("id")
    .single();
  if (error) return falhaDe(anterior)(amigavel(error.code, `Não deu para cadastrar: ${error.message}`));

  if (inicial > 0) {
    await supabase.from("estoque_movimentos").insert({
      item_id: data.id,
      tipo: "entrada",
      delta: inicial,
      origem: "inventario",
      custo_unitario_centavos: lido.valores.custo_centavos,
      observacao: "Saldo inicial no cadastro",
      por: perfil.id,
    });
  }

  registrarAcesso(perfil.id, "criou_item_estoque", { item_id: data.id, nome: lido.valores.nome });
  revalidar();
  redirect(comVoltar(`${CAMINHO_ESTOQUE}/${data.id}`, voltar));
}

export async function atualizarItem(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return falhaDe(anterior)(SEM_PERMISSAO_LOJA);
  const id = lerUuid(formData.get("id"));
  if (!id) return falhaDe(anterior)("Item não encontrado.");
  const lido = lerCamposItem(formData, anterior);
  if (lido.erro) return lido.erro;
  const voltar = voltarDiferenteDe(lerVoltar(formData.get("voltar")), `${CAMINHO_ESTOQUE}/${id}/editar`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque_itens")
    .update(lido.valores)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return falhaDe(anterior)(amigavel(error.code, `Não deu para salvar: ${error.message}`));
  if (!data) return falhaDe(anterior)("Item não encontrado ou sem permissão para editar.");

  registrarAcesso(perfil.id, "mudou_item_estoque", { item_id: id, nome: lido.valores.nome });
  revalidar(id);
  redirect(comVoltar(`${CAMINHO_ESTOQUE}/${id}`, voltar));
}

/**
 * Entrada, saída ou ajuste do saldo. No ajuste a pessoa informa a contagem
 * (o que há na prateleira) e a diferença vira o movimento: é como se faz
 * inventário, sem conta de cabeça.
 */
export async function lancarMovimento(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const itemId = lerUuid(formData.get("item_id"));
  const tipo = formData.get("tipo");
  if (!itemId || !ehTipoMovimento(tipo)) return { erro: "Movimento inválido." };
  const observacao = texto(formData, "observacao", 500) || null;

  const supabase = await createClient();
  let delta: number;
  if (tipo === "ajuste") {
    const contagem = lerInteiro(texto(formData, "contagem", 8), 0);
    if (contagem === null) return { erro: "Contagem: um número inteiro, 0 ou mais." };
    const { data: item, error } = await supabase
      .from("estoque_itens")
      .select("quantidade")
      .eq("id", itemId)
      .maybeSingle();
    if (error || !item) return { erro: "Não deu para ler o saldo atual do item." };
    delta = contagem - item.quantidade;
    if (delta === 0) return { erro: "A contagem é igual ao saldo de hoje: nada a ajustar." };
  } else {
    const quantidade = lerInteiro(texto(formData, "quantidade", 8), 1);
    if (quantidade === null) return { erro: "Quantidade: um número inteiro, 1 ou mais." };
    delta = tipo === "entrada" ? quantidade : -quantidade;
  }

  const custoTexto = texto(formData, "custo_unitario", 40);
  const custo = custoTexto ? lerCentavos(custoTexto) : null;
  if (custoTexto && custo === null) return { erro: "Custo unitário inválido. Exemplo: 180,00." };

  const { error } = await supabase.from("estoque_movimentos").insert({
    item_id: itemId,
    tipo,
    delta,
    origem: tipo === "entrada" ? "compra" : tipo === "ajuste" ? "inventario" : "manual",
    custo_unitario_centavos: tipo === "entrada" ? custo : null,
    observacao,
    por: perfil.id,
  });
  if (error) {
    return {
      erro:
        error.code === "23514"
          ? "O saldo não pode ficar negativo. Confira a quantidade."
          : `Não deu para lançar: ${error.message}`,
    };
  }

  registrarAcesso(perfil.id, "movimentou_estoque", { item_id: itemId, tipo, delta });
  revalidar(itemId);
  return {
    ok:
      tipo === "entrada"
        ? "Entrada lançada."
        : tipo === "saida"
          ? "Saída lançada."
          : `Saldo ajustado (${delta > 0 ? "+" : ""}${delta.toLocaleString("pt-BR")}).`,
  };
}

/** Arquiva (some da lista e das buscas) ou reativa o item. O histórico fica. */
export async function arquivarItem(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Item não encontrado." };
  const ativo = formData.get("ativo") === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estoque_itens")
    .update({ ativo })
    .eq("id", id)
    .select("nome")
    .maybeSingle();
  if (error) return { erro: `Não deu para ${ativo ? "reativar" : "arquivar"}: ${error.message}` };
  if (!data) return { erro: "Item não encontrado." };

  registrarAcesso(perfil.id, "mudou_item_estoque", { item_id: id, nome: data.nome, ativo });
  revalidar(id);
  return { ok: ativo ? "Item reativado." : "Item arquivado." };
}
