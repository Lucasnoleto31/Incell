import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarTelefone } from "@/lib/format";
import { CAMINHO_ORDENS, lerUuid } from "@/lib/loja";
import { somenteLeitura } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { perfilDaLoja } from "../../acesso";
import type { ClienteEncontrado } from "../../busca-actions";
import { CabecalhoLoja, MolduraLoja, voltarDaLoja } from "../../ui";
import { FormOrdem, VALORES_ORDEM_VAZIOS } from "../form-ordem";

export const metadata: Metadata = { title: titulo("Nova ordem de serviço") };

const PROPRIA = `${CAMINHO_ORDENS}/nova`;

/**
 * Abrir uma OS. A ficha do contato pode mandar o cliente já escolhido
 * (?cliente=<id>), e o ?voltar= diz para onde o Cancelar e a ficha nova
 * voltam (a lista com a visão, a ficha do contato).
 */
export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const voltar = voltarDaLoja(params.voltar, PROPRIA);
  const destino = voltar ?? CAMINHO_ORDENS;
  if (somenteLeitura(perfil.papel)) redirect(destino);

  const clienteId = lerUuid(params.cliente);
  const supabase = await createClient();
  const [equipeR, clienteR] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, papel")
      .eq("ativo", true)
      .order("nome"),
    clienteId
      ? supabase
          .from("leads")
          .select("id, nome, telefone_e164, instagram_usuario")
          .eq("id", clienteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const tecnicos = ((equipeR.data ?? []) as { id: string; nome: string; papel: string }[])
    .filter((p) => !somenteLeitura(p.papel))
    .map(({ id, nome }) => ({ id, nome }));

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

  const aqui = `${PROPRIA}${clienteId ? `?cliente=${clienteId}` : ""}`;

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo="Nova ordem de serviço"
        voltar={voltar}
        pai={{ href: CAMINHO_ORDENS, rotulo: "Ordens de serviço" }}
      />
      <div className="mt-3">
        <FormOrdem
          modo="nova"
          valores={{ ...VALORES_ORDEM_VAZIOS, tecnicoId: perfil.id }}
          cliente={cliente}
          ocultos={{ voltar: voltar ?? "" }}
          tecnicos={tecnicos}
          cancelar={destino}
          aqui={aqui}
        />
      </div>
    </MolduraLoja>
  );
}
