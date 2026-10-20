import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarTelefone } from "@/lib/format";
import { CAMINHO_ORDENS, lerUuid, type StatusOs } from "@/lib/loja";
import { ehGestao } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja, podeEscreverNaLoja } from "../../acesso";
import { voltarDaLoja } from "../../ui";
import { FichaOrdem, type EventoOs, type ItemOs, type OrdemFicha } from "./ficha";

export const metadata: Metadata = { title: titulo("Ordem de serviço") };

type Linha = Omit<OrdemFicha, "cliente" | "tecnico" | "status"> & {
  status: StatusOs;
  cliente: {
    id: string;
    nome: string;
    telefone_e164: string | null;
    instagram_usuario: string | null;
  } | null;
  tecnico: { nome: string } | null;
};

/**
 * A ficha da OS: o aparelho, o cliente, o status com os próximos passos,
 * as peças e os serviços e a linha do tempo. Tudo numa onda de consultas
 * em paralelo; o que o RLS não devolve é "não encontrado".
 */
export default async function OrdemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: bruto } = await params;
  const id = lerUuid(bruto);
  if (!id) notFound();
  const busca = await searchParams;
  const voltar = voltarDaLoja(busca.voltar, `${CAMINHO_ORDENS}/${id}`);
  const perfil = await perfilDaLoja();
  const supabase = await createClient();

  const [osR, itensR, eventosR] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select(
        `id, numero, status, aparelho, imei, cor, acessorios, estado_aparelho,
         defeito_relatado, diagnostico, valor_orcado_centavos, valor_total_centavos,
         prazo_previsto, garantia_dias, aprovado_em, pronta_em, entregue_em,
         cancelada_em, observacao, criado_em,
         cliente:leads(id, nome, telefone_e164, instagram_usuario),
         tecnico:profiles!ordens_servico_tecnico_id_fkey(nome)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ordens_servico_itens")
      .select("id, tipo, item_id, descricao, quantidade, valor_unitario_centavos")
      .eq("os_id", id)
      .order("criado_em"),
    supabase
      .from("ordens_servico_eventos")
      .select("id, tipo, de_status, para_status, nota, criado_em, autor:profiles(nome)")
      .eq("os_id", id)
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  const os = osR.data as unknown as Linha | null;
  if (!os) notFound();

  const ordem: OrdemFicha = {
    ...os,
    cliente: os.cliente
      ? {
          id: os.cliente.id,
          nome: os.cliente.nome,
          contato: os.cliente.telefone_e164
            ? formatarTelefone(os.cliente.telefone_e164)
            : os.cliente.instagram_usuario
              ? `@${os.cliente.instagram_usuario}`
              : null,
        }
      : null,
    tecnico: os.tecnico?.nome ?? null,
  };

  return (
    <FichaOrdem
      os={ordem}
      itens={(itensR.data ?? []) as ItemOs[]}
      eventos={(eventosR.data ?? []) as unknown as EventoOs[]}
      erroItens={itensR.error?.message ?? null}
      erroEventos={eventosR.error?.message ?? null}
      podeEditar={podeEscreverNaLoja(perfil)}
      gestao={ehGestao(perfil.papel)}
      voltar={voltar}
    />
  );
}
