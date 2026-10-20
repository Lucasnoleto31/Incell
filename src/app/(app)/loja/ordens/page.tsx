import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarDataCurta, formatarReais } from "@/lib/format";
import {
  CAMINHO_ORDENS,
  lerVisaoOs,
  numeroOs,
  ROTULO_VISAO_OS,
  statusDaVisaoOs,
  VISOES_OS,
  type StatusOs,
  type VisaoOs,
} from "@/lib/loja";
import { titulo } from "@/lib/marca";
import { classesDoBotao } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/segmentado";
import { cn } from "@/lib/utils";
import { comVoltar } from "../../contatos/voltar";
import { Paginador } from "../../contatos/navegacao-lista";
import { perfilDaLoja, podeEscreverNaLoja } from "../acesso";
import {
  CabecalhoLoja,
  ErroLeitura,
  EtiquetaStatusOs,
  LinhaFicha,
  MolduraLoja,
  Vazio,
} from "../ui";
import { BuscaLista } from "../busca-lista";

export const metadata: Metadata = { title: titulo("Ordens de serviço") };

const POR_PAGINA = 50;

type Linha = {
  id: string;
  numero: number;
  status: StatusOs;
  aparelho: string;
  imei: string | null;
  prazo_previsto: string | null;
  valor_orcado_centavos: number | null;
  valor_total_centavos: number;
  criado_em: string;
  cliente: { nome: string } | null;
  tecnico: { nome: string } | null;
};

/** O endereço da lista com a visão, a busca e a página. */
function urlLista(visao: VisaoOs, busca: string, pagina = 1): string {
  const p = new URLSearchParams();
  if (visao !== "abertas") p.set("ver", visao);
  if (busca) p.set("busca", busca);
  if (pagina > 1) p.set("pagina", String(pagina));
  const q = p.toString();
  return q ? `${CAMINHO_ORDENS}?${q}` : CAMINHO_ORDENS;
}

/**
 * A bancada: as OS por visão (na bancada, prontas, entregues, canceladas,
 * todas), com busca por número, aparelho, IMEI ou nome do cliente. A ordem
 * é a de entrada, mais antiga primeiro nas abertas (quem espera há mais
 * tempo aparece em cima) e mais recente primeiro nas fechadas.
 */
export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const visao = lerVisaoOs(params.ver);
  const busca = (Array.isArray(params.busca) ? params.busca[0] : params.busca)?.trim().slice(0, 80) ?? "";
  const pagina = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const de = (pagina - 1) * POR_PAGINA;
  const supabase = await createClient();

  const status = statusDaVisaoOs(visao);
  let q = supabase
    .from("ordens_servico")
    .select(
      "id, numero, status, aparelho, imei, prazo_previsto, valor_orcado_centavos, valor_total_centavos, criado_em, cliente:leads(nome), tecnico:profiles(nome)",
    );
  if (status) q = q.in("status", status);

  if (busca) {
    const seguro = busca.replace(/[%_,()]/g, "");
    const partes: string[] = [];
    if (/^\d+$/.test(seguro)) partes.push(`numero.eq.${seguro}`);
    if (seguro) {
      partes.push(`aparelho.ilike.%${seguro}%`, `imei.ilike.%${seguro}%`);
      // O nome do cliente mora em leads: os ids que batem entram no OR.
      const { data: clientes } = await supabase
        .from("leads")
        .select("id")
        .ilike("nome", `%${seguro}%`)
        .limit(100);
      const ids = (clientes ?? []).map((c) => c.id);
      if (ids.length > 0) partes.push(`cliente_id.in.(${ids.join(",")})`);
    }
    if (partes.length > 0) q = q.or(partes.join(","));
  }

  const abertas = visao === "abertas" || visao === "prontas";
  const { data, error } = await q
    .order("criado_em", { ascending: abertas })
    .order("id")
    .range(de, de + POR_PAGINA);

  const linhas = (data ?? []) as unknown as Linha[];
  const temProxima = linhas.length > POR_PAGINA;
  const visiveis = linhas.slice(0, POR_PAGINA);
  const aqui = urlLista(visao, busca, pagina);
  const podeCriar = podeEscreverNaLoja(perfil);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo="Ordens de serviço"
        acoes={
          podeCriar ? (
            <Link
              href={comVoltar(`${CAMINHO_ORDENS}/nova`, aqui === CAMINHO_ORDENS ? null : aqui)}
              className={cn(
                classesDoBotao({ variant: "primary", size: "md" }),
                "w-[40px] px-0 pointer-coarse:h-[44px] pointer-coarse:w-[44px] @xl:w-auto @xl:px-2 pointer-coarse:@xl:w-auto",
              )}
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden />
              <span className="sr-only @xl:not-sr-only">Nova OS</span>
            </Link>
          ) : null
        }
      />

      <div className="mt-2 flex flex-col gap-1.5 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none]">
          <Segmentado
            rotulo="Visão"
            valor={visao}
            opcoes={VISOES_OS.map((v) => ({
              valor: v,
              rotulo: ROTULO_VISAO_OS[v],
              href: urlLista(v, busca),
            }))}
          />
        </div>
        <BuscaLista
          acao={CAMINHO_ORDENS}
          valor={busca}
          ocultos={visao !== "abertas" ? { ver: visao } : {}}
          placeholder="Número, aparelho, IMEI ou cliente"
        />
      </div>

      <section aria-label="Lista de ordens de serviço" className="mt-2 max-w-[960px]">
        {error ? (
          <ErroLeitura mensagem={error.message} />
        ) : visiveis.length === 0 ? (
          <Vazio
            titulo={
              busca
                ? "Nenhuma OS com essa busca."
                : visao === "abertas"
                  ? "Nenhuma OS na bancada."
                  : `Nenhuma OS em “${ROTULO_VISAO_OS[visao]}”.`
            }
            texto={
              pagina > 1
                ? "Esta página está além do fim da lista."
                : busca
                  ? "Procure pelo número da OS, pelo modelo, pelo IMEI ou pelo nome do cliente."
                  : undefined
            }
            acao={
              pagina > 1 ? (
                <Link href={urlLista(visao, busca)} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Ir para a primeira página
                </Link>
              ) : podeCriar && !busca && visao === "abertas" ? (
                <Link href={`${CAMINHO_ORDENS}/nova`} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Abrir a primeira OS
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-painel bg-cartao">
            {visiveis.map((os) => {
              const atrasada =
                os.prazo_previsto !== null &&
                os.prazo_previsto < hoje &&
                os.status !== "entregue" &&
                os.status !== "cancelada";
              const valor = os.valor_total_centavos || os.valor_orcado_centavos || 0;
              return (
                <LinhaFicha
                  key={os.id}
                  href={comVoltar(`${CAMINHO_ORDENS}/${os.id}`, aqui === CAMINHO_ORDENS ? null : aqui)}
                  titulo={
                    <>
                      <span className="tabular-nums">{numeroOs(os.numero)}</span>
                      <span className="text-texto-2"> · </span>
                      {os.aparelho}
                    </>
                  }
                  apoio={
                    <>
                      {os.cliente?.nome ?? "Cliente removido"}
                      {os.tecnico ? ` · ${os.tecnico.nome}` : ""}
                      {" · entrou "}
                      {formatarDataCurta(os.criado_em)}
                      {os.prazo_previsto ? (
                        <>
                          {" · prazo "}
                          <span className={atrasada ? "text-atencao" : undefined}>
                            {formatarDataCurta(os.prazo_previsto)}
                            {atrasada ? " (vencido)" : ""}
                          </span>
                        </>
                      ) : null}
                    </>
                  }
                  direita={valor > 0 ? formatarReais(valor) : undefined}
                  etiqueta={<EtiquetaStatusOs status={os.status} />}
                />
              );
            })}
          </ul>
        )}

        {visiveis.length > 0 && (pagina > 1 || temProxima) ? (
          <nav aria-label="Páginas" className="mt-2 flex items-center justify-between gap-2">
            <p className="tipo-nota whitespace-nowrap text-texto-2 tabular-nums">
              {(de + 1).toLocaleString("pt-BR")} a {(de + visiveis.length).toLocaleString("pt-BR")}
            </p>
            <Paginador
              anterior={pagina > 1 ? urlLista(visao, busca, pagina - 1) : null}
              proxima={temProxima ? urlLista(visao, busca, pagina + 1) : null}
            />
          </nav>
        ) : null}
      </section>
    </MolduraLoja>
  );
}
