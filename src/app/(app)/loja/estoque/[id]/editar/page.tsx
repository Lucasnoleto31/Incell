import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CAMINHO_ESTOQUE, centavosParaCampo, lerUuid, type Condicao, type TipoItem } from "@/lib/loja";
import { somenteLeitura } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { comVoltar } from "../../../../contatos/voltar";
import { perfilDaLoja } from "../../../acesso";
import { CabecalhoLoja, MolduraLoja, voltarDaLoja } from "../../../ui";
import { FormItem } from "../../form-item";

export const metadata: Metadata = { title: titulo("Editar item") };

type Linha = {
  id: string;
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

export default async function EditarItemPage({
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
  const ficha = `${CAMINHO_ESTOQUE}/${id}`;
  const voltar = voltarDaLoja(busca.voltar, `${ficha}/editar`);
  const perfil = await perfilDaLoja();
  if (somenteLeitura(perfil.papel)) redirect(voltar ?? ficha);

  const supabase = await createClient();
  const { data } = await supabase
    .from("estoque_itens")
    .select("id, tipo, nome, sku, descricao, condicao, imei, custo_centavos, preco_centavos, estoque_minimo")
    .eq("id", id)
    .maybeSingle();
  const item = data as Linha | null;
  if (!item) notFound();

  const destino = comVoltar(ficha, voltar);

  return (
    <MolduraLoja>
      <CabecalhoLoja titulo={`Editar ${item.nome}`} pai={{ href: destino, rotulo: "Item do estoque" }} />
      <div className="mt-3">
        <FormItem
          modo="editar"
          valores={{
            tipo: item.tipo,
            nome: item.nome,
            sku: item.sku ?? "",
            descricao: item.descricao ?? "",
            condicao: item.condicao ?? "novo",
            imei: item.imei ?? "",
            custo: centavosParaCampo(item.custo_centavos, true),
            preco: centavosParaCampo(item.preco_centavos, true),
            estoqueMinimo: String(item.estoque_minimo),
            quantidadeInicial: "0",
          }}
          ocultos={{ id: item.id, voltar: voltar ?? "" }}
          cancelar={destino}
        />
      </div>
    </MolduraLoja>
  );
}
