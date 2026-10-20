"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/auditoria";
import { ehGestao } from "@/lib/papeis";
import {
  CAMINHO_LOJA,
  CAMINHO_ORDENS,
  ehStatusOs,
  lerCentavos,
  lerInteiro,
  lerUuid,
  PROXIMOS_STATUS_OS,
  ROTULO_STATUS_OS,
  type StatusOs,
} from "@/lib/loja";
import { comVoltar, lerVoltar, voltarDiferenteDe } from "../../contatos/voltar";
import type { ResultadoAcao } from "../../configuracoes/resultado";
import { quemEscreveNaLoja, SEM_PERMISSAO_LOJA } from "../acesso";
import { falhaDe, texto, type EstadoForm, type Lido } from "../estado-form";

/*
 * As actions das ordens de serviço. O cadastro e a edição devolvem
 * EstadoForm (erro no campo, formulário preenchido) e redirecionam quando
 * gravam; as da ficha (status, item, nota) devolvem { ok, erro } para o
 * FormInline. A conta que grava é conferida aqui e o RLS (0070) confere de
 * novo no banco.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** A OS inteira relê: a lista, o índice da Loja e a ficha. */
function revalidar(id?: string) {
  revalidatePath(CAMINHO_LOJA, "layout");
  if (id) revalidatePath(`${CAMINHO_ORDENS}/${id}`);
}

type ValoresOrdem = {
  cliente_id: string;
  tecnico_id: string | null;
  aparelho: string;
  imei: string | null;
  cor: string | null;
  acessorios: string | null;
  estado_aparelho: string | null;
  defeito_relatado: string;
  diagnostico: string | null;
  valor_orcado_centavos: number | null;
  prazo_previsto: string | null;
  garantia_dias: number;
  observacao: string | null;
};

/** Os campos do formulário da OS, já conferidos. */
function lerCamposOrdem(formData: FormData, anterior: EstadoForm): Lido<ValoresOrdem> {
  const falha = falhaDe(anterior);
  const clienteId = lerUuid(formData.get("cliente_id"));
  if (!clienteId) {
    return { erro: falha("Escolha o cliente: um contato do chat.", "cliente_id") };
  }
  const aparelho = texto(formData, "aparelho", 120);
  if (!aparelho) return { erro: falha("Informe o aparelho (modelo).", "aparelho") };
  const defeito = texto(formData, "defeito_relatado", 4000);
  if (!defeito) {
    return { erro: falha("Descreva o defeito que o cliente relatou.", "defeito_relatado") };
  }
  const orcadoTexto = texto(formData, "valor_orcado", 40);
  const orcado = orcadoTexto ? lerCentavos(orcadoTexto) : null;
  if (orcadoTexto && orcado === null) {
    return { erro: falha("Valor orçado inválido. Exemplo: 350,00.", "valor_orcado") };
  }
  const garantiaTexto = texto(formData, "garantia_dias", 6);
  const garantia = garantiaTexto ? lerInteiro(garantiaTexto, 0) : 90;
  if (garantia === null) {
    return { erro: falha("Garantia em dias: um número inteiro, 0 para sem garantia.", "garantia_dias") };
  }
  const prazo = texto(formData, "prazo_previsto", 10);
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
    return { erro: falha("Prazo previsto inválido.", "prazo_previsto") };
  }
  const tecnicoId = lerUuid(formData.get("tecnico_id"));
  return {
    valores: {
      cliente_id: clienteId,
      tecnico_id: tecnicoId,
      aparelho,
      imei: texto(formData, "imei", 40) || null,
      cor: texto(formData, "cor", 60) || null,
      acessorios: texto(formData, "acessorios", 500) || null,
      estado_aparelho: texto(formData, "estado_aparelho", 2000) || null,
      defeito_relatado: defeito,
      diagnostico: texto(formData, "diagnostico", 4000) || null,
      valor_orcado_centavos: orcado,
      prazo_previsto: prazo || null,
      garantia_dias: garantia,
      observacao: texto(formData, "observacao", 4000) || null,
    },
  };
}

/** Abre a OS e vai para a ficha dela. */
export async function criarOrdem(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return falhaDe(anterior)(SEM_PERMISSAO_LOJA);
  const lido = lerCamposOrdem(formData, anterior);
  if (lido.erro) return lido.erro;
  const voltar = voltarDiferenteDe(lerVoltar(formData.get("voltar")), `${CAMINHO_ORDENS}/nova`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_servico")
    .insert({ ...lido.valores, criado_por: perfil.id })
    .select("id, numero")
    .single();
  if (error) {
    return falhaDe(anterior)(
      error.code === "23503"
        ? "O cliente escolhido não existe mais. Escolha outro."
        : `Não deu para abrir a OS: ${error.message}`,
    );
  }

  await supabase.from("ordens_servico_eventos").insert({
    os_id: data.id,
    tipo: "status",
    de_status: null,
    para_status: "aberta",
    por: perfil.id,
  });

  registrarAcesso(perfil.id, "criou_os", { os_id: data.id, numero: data.numero });
  revalidar();
  redirect(comVoltar(`${CAMINHO_ORDENS}/${data.id}`, voltar));
}

/** Salva os dados da OS (não o status: esse vai pela ficha). */
export async function atualizarOrdem(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return falhaDe(anterior)(SEM_PERMISSAO_LOJA);
  const id = lerUuid(formData.get("id"));
  if (!id) return falhaDe(anterior)("OS não encontrada.");
  const lido = lerCamposOrdem(formData, anterior);
  if (lido.erro) return lido.erro;
  const voltar = voltarDiferenteDe(lerVoltar(formData.get("voltar")), `${CAMINHO_ORDENS}/${id}/editar`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ordens_servico")
    .update(lido.valores)
    .eq("id", id)
    .select("id, numero")
    .maybeSingle();
  if (error) return falhaDe(anterior)(`Não deu para salvar: ${error.message}`);
  if (!data) return falhaDe(anterior)("OS não encontrada ou sem permissão para editar.");

  registrarAcesso(perfil.id, "mudou_os", { os_id: id, numero: data.numero });
  revalidar(id);
  redirect(comVoltar(`${CAMINHO_ORDENS}/${id}`, voltar));
}

/** O carimbo que cada status deixa na OS. */
function carimboDe(status: StatusOs): Record<string, string> {
  const agora = new Date().toISOString();
  switch (status) {
    case "em_reparo":
      return { aprovado_em: agora };
    case "pronta":
      return { pronta_em: agora };
    case "entregue":
      return { entregue_em: agora };
    case "cancelada":
      return { cancelada_em: agora };
    default:
      return {};
  }
}

/** Muda o status da OS, com a nota opcional, e registra na linha do tempo. */
export async function mudarStatusOs(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  const para = formData.get("para");
  if (!id || !ehStatusOs(para)) return { erro: "Status inválido." };
  const nota = texto(formData, "nota", 4000) || null;

  const supabase = await createClient();
  const { data: atual, error: erroLeitura } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, aprovado_em")
    .eq("id", id)
    .maybeSingle();
  if (erroLeitura) return { erro: `Não deu para ler a OS: ${erroLeitura.message}` };
  if (!atual) return { erro: "OS não encontrada." };
  const de = atual.status as StatusOs;
  if (de === para) return { erro: `A OS já está ${ROTULO_STATUS_OS[para].toLowerCase()}.` };
  // A bancada segue os caminhos de PROXIMOS_STATUS_OS; a gestão pode
  // reabrir uma entregue ou cancelada, e pular etapas quando preciso.
  if (!PROXIMOS_STATUS_OS[de].includes(para) && !ehGestao(perfil.papel)) {
    return {
      erro: `De ${ROTULO_STATUS_OS[de].toLowerCase()} não dá para ir direto a ${ROTULO_STATUS_OS[para].toLowerCase()}. Peça à gestão.`,
    };
  }

  // O "aprovado em" só se grava na primeira vez que a OS entra no reparo.
  const carimbo = carimboDe(para);
  if (para === "em_reparo" && atual.aprovado_em) delete carimbo.aprovado_em;

  const { error } = await supabase
    .from("ordens_servico")
    .update({ status: para, ...carimbo })
    .eq("id", id);
  if (error) return { erro: `Não deu para mudar o status: ${error.message}` };

  await supabase.from("ordens_servico_eventos").insert({
    os_id: id,
    tipo: "status",
    de_status: de,
    para_status: para,
    nota,
    por: perfil.id,
  });

  registrarAcesso(perfil.id, "mudou_status_os", {
    os_id: id,
    numero: atual.numero,
    de,
    para,
  });
  revalidar(id);
  return { ok: `OS ${ROTULO_STATUS_OS[para].toLowerCase()}.` };
}

/**
 * Acrescenta uma peça ou um serviço à OS. Peça vinda do estoque dá baixa na
 * hora (movimento de saída ligado à OS); sem saldo, a linha não entra.
 */
export async function adicionarItemOs(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const osId = lerUuid(formData.get("os_id"));
  if (!osId) return { erro: "OS não encontrada." };
  const tipo = formData.get("tipo") === "peca" ? "peca" : "servico";
  const itemId = lerUuid(formData.get("item_id"));
  const descricao = texto(formData, "descricao", 200);
  if (!descricao) return { erro: "Descreva a peça ou o serviço." };
  const quantidade = lerInteiro(texto(formData, "quantidade", 6) || "1", 1);
  if (quantidade === null) return { erro: "Quantidade: um número inteiro, 1 ou mais." };
  const valor = lerCentavos(texto(formData, "valor_unitario", 40) || "0");
  if (valor === null) return { erro: "Valor unitário inválido. Exemplo: 120,00." };

  const supabase = await createClient();
  const { data: linha, error } = await supabase
    .from("ordens_servico_itens")
    .insert({
      os_id: osId,
      tipo,
      item_id: tipo === "peca" ? itemId : null,
      descricao,
      quantidade,
      valor_unitario_centavos: valor,
    })
    .select("id")
    .single();
  if (error) return { erro: `Não deu para acrescentar: ${error.message}` };

  if (tipo === "peca" && itemId) {
    const baixa = await darBaixa(supabase, {
      itemId,
      quantidade,
      osId,
      por: perfil.id,
    });
    if (baixa.erro) {
      await supabase.from("ordens_servico_itens").delete().eq("id", linha.id);
      return { erro: baixa.erro };
    }
  }

  revalidar(osId);
  return { ok: tipo === "peca" ? "Peça acrescentada." : "Serviço acrescentado." };
}

/** Tira a linha da OS; peça do estoque volta ao saldo. */
export async function removerItemOs(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const id = lerUuid(formData.get("id"));
  if (!id) return { erro: "Linha não encontrada." };

  const supabase = await createClient();
  const { data: linha, error } = await supabase
    .from("ordens_servico_itens")
    .delete()
    .eq("id", id)
    .select("os_id, item_id, quantidade, descricao")
    .maybeSingle();
  if (error) return { erro: `Não deu para tirar: ${error.message}` };
  if (!linha) return { erro: "Linha não encontrada." };

  if (linha.item_id) {
    await supabase.from("estoque_movimentos").insert({
      item_id: linha.item_id,
      tipo: "entrada",
      delta: linha.quantidade,
      origem: "estorno",
      os_id: linha.os_id,
      observacao: `Peça tirada da OS: ${linha.descricao}`,
      por: perfil.id,
    });
  }

  revalidar(linha.os_id);
  return { ok: "Linha tirada da OS." };
}

/** Uma nota da equipe na linha do tempo da OS. */
export async function adicionarNotaOs(
  _anterior: ResultadoAcao,
  formData: FormData,
): Promise<ResultadoAcao> {
  const perfil = await quemEscreveNaLoja();
  if (!perfil) return { erro: SEM_PERMISSAO_LOJA };
  const osId = lerUuid(formData.get("os_id"));
  const nota = texto(formData, "nota", 4000);
  if (!osId) return { erro: "OS não encontrada." };
  if (!nota) return { erro: "Escreva a nota." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ordens_servico_eventos")
    .insert({ os_id: osId, tipo: "nota", nota, por: perfil.id });
  if (error) return { erro: `Não deu para gravar a nota: ${error.message}` };

  revalidar(osId);
  return { ok: "Nota gravada." };
}

/**
 * A saída de estoque de uma peça usada na OS. O check de saldo do banco
 * recusa a baixa sem estoque (23514): o erro vira frase.
 */
async function darBaixa(
  supabase: Cliente,
  {
    itemId,
    quantidade,
    osId,
    por,
  }: { itemId: string; quantidade: number; osId: string; por: string },
): Promise<{ erro?: string }> {
  const { error } = await supabase.from("estoque_movimentos").insert({
    item_id: itemId,
    tipo: "saida",
    delta: -quantidade,
    origem: "os",
    os_id: osId,
    por,
  });
  if (!error) return {};
  return {
    erro:
      error.code === "23514"
        ? "Sem saldo em estoque para essa quantidade. Lance a entrada no item ou acrescente a peça como avulsa."
        : `Não deu para dar baixa no estoque: ${error.message}`,
  };
}
