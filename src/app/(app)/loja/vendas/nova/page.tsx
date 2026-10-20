import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarTelefone } from "@/lib/format";
import { CAMINHO_VENDAS, lerUuid } from "@/lib/loja";
import { ehGestao, somenteLeitura } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja } from "../../acesso";
import type { ClienteEncontrado } from "../../busca-actions";
import { CabecalhoLoja, MolduraLoja, voltarDaLoja } from "../../ui";
import { FormVenda } from "../form-venda";

export const metadata: Metadata = { title: titulo("Nova venda") };

const PROPRIA = `${CAMINHO_VENDAS}/nova`;

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const voltar = voltarDaLoja(params.voltar, PROPRIA);
  const destino = voltar ?? CAMINHO_VENDAS;
  if (somenteLeitura(perfil.papel)) redirect(destino);

  const clienteId = lerUuid(params.cliente);
  const supabase = await createClient();
  const gestao = ehGestao(perfil.papel);
  const [equipeR, clienteR] = await Promise.all([
    gestao
      ? supabase.from("profiles").select("id, nome, papel").eq("ativo", true).order("nome")
      : Promise.resolve({ data: null }),
    clienteId
      ? supabase
          .from("leads")
          .select("id, nome, telefone_e164, instagram_usuario")
          .eq("id", clienteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const vendedores = gestao
    ? ((equipeR.data ?? []) as { id: string; nome: string; papel: string }[])
        .filter((p) => !somenteLeitura(p.papel))
        .map(({ id, nome }) => ({ id, nome }))
    : null;

  const l = clienteR.data as {
    id: string;
    nome: string;
    telefone_e164: string | null;
    instagram_usuario: string | null;
  } | null;
  const cliente: ClienteEncontrado | null = l
    ? {
        id: l.id,
        nome: l.nome,
        contato: l.telefone_e164
          ? formatarTelefone(l.telefone_e164)
          : l.instagram_usuario
            ? `@${l.instagram_usuario}`
            : null,
      }
    : null;

  return (
    <MolduraLoja>
      <CabecalhoLoja titulo="Nova venda" voltar={voltar} pai={{ href: CAMINHO_VENDAS, rotulo: "Vendas" }} />
      <div className="mt-3">
        <FormVenda
          cliente={cliente}
          vendedores={vendedores}
          vendedorInicial={perfil.id}
          ocultos={{ voltar: voltar ?? "" }}
          cancelar={destino}
          aqui={`${PROPRIA}${clienteId ? `?cliente=${clienteId}` : ""}`}
        />
      </div>
    </MolduraLoja>
  );
}
