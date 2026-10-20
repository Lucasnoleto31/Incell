import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarTelefone } from "@/lib/format";
import { CAMINHO_VENDAS, lerUuid } from "@/lib/loja";
import { ehGestao } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja, podeEscreverNaLoja } from "../../acesso";
import { voltarDaLoja } from "../../ui";
import { FichaVenda, type ItemVenda, type VendaFicha } from "./ficha";

export const metadata: Metadata = { title: titulo("Venda") };

type Linha = Omit<VendaFicha, "cliente" | "vendedor"> & {
  vendedor_id: string;
  cliente: {
    id: string;
    nome: string;
    telefone_e164: string | null;
    instagram_usuario: string | null;
  } | null;
  vendedor: { nome: string } | null;
};

export default async function VendaPage({
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
  const voltar = voltarDaLoja(busca.voltar, `${CAMINHO_VENDAS}/${id}`);
  const perfil = await perfilDaLoja();
  const supabase = await createClient();

  const [vendaR, itensR] = await Promise.all([
    supabase
      .from("vendas")
      .select(
        `id, numero, status, forma_pagamento, parcelas, desconto_centavos, total_centavos,
         observacao, concluida_em, cancelada_em, criado_em, vendedor_id,
         cliente:leads(id, nome, telefone_e164, instagram_usuario),
         vendedor:profiles(nome)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vendas_itens")
      .select("id, item_id, descricao, quantidade, valor_unitario_centavos")
      .eq("venda_id", id)
      .order("criado_em"),
  ]);

  const v = vendaR.data as unknown as Linha | null;
  if (!v) notFound();

  const venda: VendaFicha = {
    ...v,
    cliente: v.cliente
      ? {
          id: v.cliente.id,
          nome: v.cliente.nome,
          contato: v.cliente.telefone_e164
            ? formatarTelefone(v.cliente.telefone_e164)
            : v.cliente.instagram_usuario
              ? `@${v.cliente.instagram_usuario}`
              : null,
        }
      : null,
    vendedor: v.vendedor?.nome ?? null,
  };

  const gestao = ehGestao(perfil.papel);
  return (
    <FichaVenda
      venda={venda}
      itens={(itensR.data ?? []) as ItemVenda[]}
      erroItens={itensR.error?.message ?? null}
      // Mexe na venda quem vendeu ou a gestão; o compliance só lê.
      podeMexer={podeEscreverNaLoja(perfil) && (gestao || v.vendedor_id === perfil.id)}
      gestao={gestao}
      aviso={busca.aviso === "sem_estoque" ? "sem_estoque" : null}
      voltar={voltar}
    />
  );
}
