import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarTelefone } from "@/lib/format";
import { CAMINHO_ORDENS, centavosParaCampo, lerUuid, numeroOs } from "@/lib/loja";
import { somenteLeitura } from "@/lib/papeis";
import { titulo } from "@/lib/marca";
import { comVoltar } from "../../../../contatos/voltar";
import { perfilDaLoja } from "../../../acesso";
import { CabecalhoLoja, MolduraLoja, voltarDaLoja } from "../../../ui";
import { FormOrdem } from "../../form-ordem";

export const metadata: Metadata = { title: titulo("Editar ordem de serviço") };

type Linha = {
  id: string;
  numero: number;
  aparelho: string;
  imei: string | null;
  cor: string | null;
  acessorios: string | null;
  estado_aparelho: string | null;
  defeito_relatado: string;
  diagnostico: string | null;
  tecnico_id: string | null;
  valor_orcado_centavos: number | null;
  prazo_previsto: string | null;
  garantia_dias: number;
  observacao: string | null;
  cliente: {
    id: string;
    nome: string;
    telefone_e164: string | null;
    instagram_usuario: string | null;
  } | null;
};

export default async function EditarOrdemPage({
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
  const ficha = `${CAMINHO_ORDENS}/${id}`;
  const voltar = voltarDaLoja(busca.voltar, `${ficha}/editar`);
  const perfil = await perfilDaLoja();
  if (somenteLeitura(perfil.papel)) redirect(voltar ?? ficha);

  const supabase = await createClient();
  const [osR, equipeR] = await Promise.all([
    supabase
      .from("ordens_servico")
      .select(
        `id, numero, aparelho, imei, cor, acessorios, estado_aparelho, defeito_relatado,
         diagnostico, tecnico_id, valor_orcado_centavos, prazo_previsto, garantia_dias,
         observacao, cliente:leads(id, nome, telefone_e164, instagram_usuario)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("id, nome, papel").eq("ativo", true).order("nome"),
  ]);
  const os = osR.data as unknown as Linha | null;
  if (!os) notFound();

  const tecnicos = ((equipeR.data ?? []) as { id: string; nome: string; papel: string }[])
    .filter((p) => !somenteLeitura(p.papel))
    .map(({ id, nome }) => ({ id, nome }));

  // O Cancelar e o Salvar voltam à ficha, que leva junto a origem dela.
  const destino = comVoltar(ficha, voltar);

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo={`Editar ${numeroOs(os.numero)}`}
        pai={{ href: destino, rotulo: "Ordem de serviço" }}
      />
      <div className="mt-3">
        <FormOrdem
          modo="editar"
          valores={{
            aparelho: os.aparelho,
            imei: os.imei ?? "",
            cor: os.cor ?? "",
            acessorios: os.acessorios ?? "",
            estadoAparelho: os.estado_aparelho ?? "",
            defeitoRelatado: os.defeito_relatado,
            diagnostico: os.diagnostico ?? "",
            tecnicoId: os.tecnico_id ?? "",
            valorOrcado: centavosParaCampo(os.valor_orcado_centavos),
            prazoPrevisto: os.prazo_previsto ?? "",
            garantiaDias: String(os.garantia_dias),
            observacao: os.observacao ?? "",
          }}
          cliente={
            os.cliente
              ? {
                  id: os.cliente.id,
                  nome: os.cliente.nome,
                  contato: os.cliente.telefone_e164
                    ? formatarTelefone(os.cliente.telefone_e164)
                    : os.cliente.instagram_usuario
                      ? `@${os.cliente.instagram_usuario}`
                      : null,
                }
              : null
          }
          ocultos={{ id: os.id, voltar: voltar ?? "" }}
          tecnicos={tecnicos}
          cancelar={destino}
          aqui={comVoltar(`${ficha}/editar`, voltar)}
        />
      </div>
    </MolduraLoja>
  );
}
