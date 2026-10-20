import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CAMINHO_ESTOQUE, lerTipoItem } from "@/lib/loja";
import { somenteLeitura } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja } from "../../acesso";
import { CabecalhoLoja, MolduraLoja, voltarDaLoja } from "../../ui";
import { FormItem, VALORES_ITEM_VAZIOS } from "../form-item";

export const metadata: Metadata = { title: titulo("Novo item") };

const PROPRIA = `${CAMINHO_ESTOQUE}/novo`;

export default async function NovoItemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const voltar = voltarDaLoja(params.voltar, PROPRIA);
  const destino = voltar ?? CAMINHO_ESTOQUE;
  if (somenteLeitura(perfil.papel)) redirect(destino);
  // A lista filtrada por tipo abre o cadastro já com o tipo.
  const tipo = lerTipoItem(params.tipo);

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo="Novo item"
        voltar={voltar}
        pai={{ href: CAMINHO_ESTOQUE, rotulo: "Estoque" }}
      />
      <div className="mt-3">
        <FormItem
          modo="novo"
          valores={{ ...VALORES_ITEM_VAZIOS, tipo: tipo ?? "peca" }}
          ocultos={{ voltar: voltar ?? "" }}
          cancelar={destino}
        />
      </div>
    </MolduraLoja>
  );
}
