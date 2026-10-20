import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHora, formatarReais } from "@/lib/format";
import {
  CAMINHO_VENDAS,
  lerVisaoVenda,
  numeroVenda,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_VISAO_VENDA,
  statusDaVisaoVenda,
  VISOES_VENDA,
  type FormaPagamento,
  type StatusVenda,
  type VisaoVenda,
} from "@/lib/loja";
import { titulo } from "@/lib/marca";
import { classesDoBotao } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/segmentado";
import { cn } from "@/lib/utils";
import { comVoltar } from "../../contatos/voltar";
import { Paginador } from "../../contatos/navegacao-lista";
import { perfilDaLoja, podeEscreverNaLoja } from "../acesso";
import { BuscaLista } from "../busca-lista";
import { CabecalhoLoja, ErroLeitura, EtiquetaStatusVenda, LinhaFicha, MolduraLoja, Vazio } from "../ui";

export const metadata: Metadata = { title: titulo("Vendas") };

const POR_PAGINA = 50;

type Linha = {
  id: string;
  numero: number;
  status: StatusVenda;
  forma_pagamento: FormaPagamento | null;
  parcelas: number;
  total_centavos: number;
  criado_em: string;
  concluida_em: string | null;
  cliente: { nome: string } | null;
  vendedor: { nome: string } | null;
};

function urlLista(visao: VisaoVenda, busca: string, pagina = 1): string {
  const p = new URLSearchParams();
  if (visao !== "todas") p.set("ver", visao);
  if (busca) p.set("busca", busca);
  if (pagina > 1) p.set("pagina", String(pagina));
  const q = p.toString();
  return q ? `${CAMINHO_VENDAS}?${q}` : CAMINHO_VENDAS;
}

/**
 * As vendas, mais recentes primeiro, por status e com busca por número ou
 * nome do cliente. O total do recorte visível vai no rodapé.
 */
export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const visao = lerVisaoVenda(params.ver);
  const busca = (Array.isArray(params.busca) ? params.busca[0] : params.busca)?.trim().slice(0, 80) ?? "";
  const pagina = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const de = (pagina - 1) * POR_PAGINA;
  const supabase = await createClient();

  let q = supabase
    .from("vendas")
    .select(
      "id, numero, status, forma_pagamento, parcelas, total_centavos, criado_em, concluida_em, cliente:leads(nome), vendedor:profiles(nome)",
    );
  const status = statusDaVisaoVenda(visao);
  if (status) q = q.eq("status", status);
  if (busca) {
    const seguro = busca.replace(/[%_,()]/g, "");
    const partes: string[] = [];
    if (/^\d+$/.test(seguro)) partes.push(`numero.eq.${seguro}`);
    if (seguro) {
      const { data: clientes } = await supabase
        .from("leads")
        .select("id")
        .ilike("nome", `%${seguro}%`)
        .limit(100);
      const ids = (clientes ?? []).map((c) => c.id);
      if (ids.length > 0) partes.push(`cliente_id.in.(${ids.join(",")})`);
    }
    // Sem nada que case, a lista sai vazia de propósito.
    q = partes.length > 0 ? q.or(partes.join(",")) : q.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  const { data, error } = await q
    .order("criado_em", { ascending: false })
    .order("id")
    .range(de, de + POR_PAGINA);

  const linhas = (data ?? []) as unknown as Linha[];
  const temProxima = linhas.length > POR_PAGINA;
  const visiveis = linhas.slice(0, POR_PAGINA);
  const aqui = urlLista(visao, busca, pagina);
  const voltarLista = aqui === CAMINHO_VENDAS ? null : aqui;
  const podeCriar = podeEscreverNaLoja(perfil);
  const totalConcluidas = visiveis
    .filter((v) => v.status === "concluida")
    .reduce((s, v) => s + v.total_centavos, 0);

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo="Vendas"
        acoes={
          podeCriar ? (
            <Link
              href={comVoltar(`${CAMINHO_VENDAS}/nova`, voltarLista)}
              className={cn(
                classesDoBotao({ variant: "primary", size: "md" }),
                "w-[40px] px-0 pointer-coarse:h-[44px] pointer-coarse:w-[44px] @xl:w-auto @xl:px-2 pointer-coarse:@xl:w-auto",
              )}
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden />
              <span className="sr-only @xl:not-sr-only">Nova venda</span>
            </Link>
          ) : null
        }
      />

      <div className="mt-2 flex flex-col gap-1.5 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none]">
          <Segmentado
            rotulo="Status"
            valor={visao}
            opcoes={VISOES_VENDA.map((v) => ({
              valor: v,
              rotulo: ROTULO_VISAO_VENDA[v],
              href: urlLista(v, busca),
            }))}
          />
        </div>
        <BuscaLista
          acao={CAMINHO_VENDAS}
          valor={busca}
          ocultos={visao !== "todas" ? { ver: visao } : {}}
          placeholder="Número da venda ou cliente"
        />
      </div>

      <section aria-label="Lista de vendas" className="mt-2 max-w-[960px]">
        {error ? (
          <ErroLeitura mensagem={error.message} />
        ) : visiveis.length === 0 ? (
          <Vazio
            titulo={busca ? "Nenhuma venda com essa busca." : "Nenhuma venda registrada."}
            texto={pagina > 1 ? "Esta página está além do fim da lista." : undefined}
            acao={
              pagina > 1 ? (
                <Link href={urlLista(visao, busca)} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Ir para a primeira página
                </Link>
              ) : podeCriar && !busca && visao === "todas" ? (
                <Link href={`${CAMINHO_VENDAS}/nova`} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Registrar a primeira venda
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-painel bg-cartao">
            {visiveis.map((v) => (
              <LinhaFicha
                key={v.id}
                href={comVoltar(`${CAMINHO_VENDAS}/${v.id}`, voltarLista)}
                titulo={
                  <>
                    <span className="tabular-nums">{numeroVenda(v.numero)}</span>
                    <span className="text-texto-2"> · </span>
                    {v.cliente?.nome ?? "Balcão"}
                  </>
                }
                apoio={[
                  v.vendedor?.nome,
                  formatarDataHora(v.concluida_em ?? v.criado_em),
                  v.forma_pagamento
                    ? `${ROTULO_FORMA_PAGAMENTO[v.forma_pagamento]}${v.parcelas > 1 ? ` ${v.parcelas}×` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                direita={formatarReais(v.total_centavos)}
                etiqueta={<EtiquetaStatusVenda status={v.status} />}
              />
            ))}
          </ul>
        )}

        {visiveis.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="tipo-nota text-texto-2 tabular-nums">
              {totalConcluidas > 0 ? `Concluídas nesta página: ${formatarReais(totalConcluidas)}` : ""}
            </p>
            {pagina > 1 || temProxima ? (
              <nav aria-label="Páginas" className="flex items-center gap-2">
                <p className="tipo-nota whitespace-nowrap text-texto-2 tabular-nums">
                  {(de + 1).toLocaleString("pt-BR")} a {(de + visiveis.length).toLocaleString("pt-BR")}
                </p>
                <Paginador
                  anterior={pagina > 1 ? urlLista(visao, busca, pagina - 1) : null}
                  proxima={temProxima ? urlLista(visao, busca, pagina + 1) : null}
                />
              </nav>
            ) : null}
          </div>
        ) : null}
      </section>
    </MolduraLoja>
  );
}
