import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CAMINHO_ESTOQUE, lerUuid } from "@/lib/loja";
import { ehGestao } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja, podeEscreverNaLoja } from "../../acesso";
import { voltarDaLoja } from "../../ui";
import { FichaItem, type ItemFicha, type Movimento } from "./ficha";

export const metadata: Metadata = { title: titulo("Item do estoque") };

export default async function ItemPage({
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
  const voltar = voltarDaLoja(busca.voltar, `${CAMINHO_ESTOQUE}/${id}`);
  const perfil = await perfilDaLoja();
  const supabase = await createClient();

  const [itemR, movimentosR] = await Promise.all([
    supabase
      .from("estoque_itens")
      .select(
        "id, tipo, nome, sku, descricao, condicao, imei, custo_centavos, preco_centavos, quantidade, estoque_minimo, ativo, criado_em",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("estoque_movimentos")
      .select(
        "id, tipo, delta, origem, venda_id, os_id, custo_unitario_centavos, observacao, criado_em, autor:profiles(nome)",
      )
      .eq("item_id", id)
      .order("criado_em", { ascending: false })
      .limit(60),
  ]);

  const item = itemR.data as ItemFicha | null;
  if (!item) notFound();

  return (
    <FichaItem
      item={item}
      movimentos={(movimentosR.data ?? []) as unknown as Movimento[]}
      erroMovimentos={movimentosR.error?.message ?? null}
      podeEditar={podeEscreverNaLoja(perfil)}
      gestao={ehGestao(perfil.papel)}
      voltar={voltar}
    />
  );
}
