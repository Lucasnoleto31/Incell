import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarReais } from "@/lib/format";
import {
  CAMINHO_ESTOQUE,
  lerTipoItem,
  ROTULO_CONDICAO,
  ROTULO_TIPO_ITEM,
  ROTULO_TIPO_ITEM_PLURAL,
  TIPOS_ITEM,
  type Condicao,
  type TipoItem,
} from "@/lib/loja";
import { titulo } from "@/lib/marca";
import { classesDoBotao } from "@/components/ui/button";
import { Etiqueta } from "@/components/ui/etiqueta";
import { Segmentado } from "@/components/ui/segmentado";
import { cn } from "@/lib/utils";
import { comVoltar } from "../../contatos/voltar";
import { Paginador } from "../../contatos/navegacao-lista";
import { perfilDaLoja, podeEscreverNaLoja } from "../acesso";
import { BuscaLista } from "../busca-lista";
import { CabecalhoLoja, ErroLeitura, LinhaFicha, MolduraLoja, Vazio } from "../ui";

export const metadata: Metadata = { title: titulo("Estoque") };

const POR_PAGINA = 60;

type Linha = {
  id: string;
  tipo: TipoItem;
  nome: string;
  sku: string | null;
  imei: string | null;
  condicao: Condicao | null;
  quantidade: number;
  estoque_minimo: number;
  preco_centavos: number;
  ativo: boolean;
};

type Filtros = { tipo: TipoItem | null; busca: string; arquivados: boolean };

function urlLista(f: Filtros, pagina = 1): string {
  const p = new URLSearchParams();
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.busca) p.set("busca", f.busca);
  if (f.arquivados) p.set("ver", "arquivados");
  if (pagina > 1) p.set("pagina", String(pagina));
  const q = p.toString();
  return q ? `${CAMINHO_ESTOQUE}?${q}` : CAMINHO_ESTOQUE;
}

/**
 * O estoque: aparelhos, peças e acessórios, por tipo, com busca por nome,
 * SKU ou IMEI. O saldo vai à direita e fica em atenção quando está no
 * mínimo ou abaixo. Os arquivados ficam numa visão à parte.
 */
export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await perfilDaLoja();
  const params = await searchParams;
  const f: Filtros = {
    tipo: lerTipoItem(params.tipo),
    busca: (Array.isArray(params.busca) ? params.busca[0] : params.busca)?.trim().slice(0, 80) ?? "",
    arquivados: params.ver === "arquivados",
  };
  const pagina = Math.max(1, Math.floor(Number(params.pagina)) || 1);
  const de = (pagina - 1) * POR_PAGINA;
  const supabase = await createClient();

  let q = supabase
    .from("estoque_itens")
    .select("id, tipo, nome, sku, imei, condicao, quantidade, estoque_minimo, preco_centavos, ativo")
    .eq("ativo", !f.arquivados);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.busca) {
    const seguro = f.busca.replace(/[%_,()]/g, "");
    if (seguro) q = q.or(`nome.ilike.%${seguro}%,sku.ilike.%${seguro}%,imei.ilike.%${seguro}%`);
  }
  const { data, error } = await q.order("nome").order("id").range(de, de + POR_PAGINA);

  const linhas = (data ?? []) as Linha[];
  const temProxima = linhas.length > POR_PAGINA;
  const visiveis = linhas.slice(0, POR_PAGINA);
  const aqui = urlLista(f, pagina);
  const voltarLista = aqui === CAMINHO_ESTOQUE ? null : aqui;
  const podeCriar = podeEscreverNaLoja(perfil);
  const novo = `${CAMINHO_ESTOQUE}/novo${f.tipo ? `?tipo=${f.tipo}` : ""}`;

  return (
    <MolduraLoja>
      <CabecalhoLoja
        titulo="Estoque"
        acoes={
          podeCriar ? (
            <Link
              href={comVoltar(novo, voltarLista)}
              className={cn(
                classesDoBotao({ variant: "primary", size: "md" }),
                "w-[40px] px-0 pointer-coarse:h-[44px] pointer-coarse:w-[44px] @xl:w-auto @xl:px-2 pointer-coarse:@xl:w-auto",
              )}
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden />
              <span className="sr-only @xl:not-sr-only">Novo item</span>
            </Link>
          ) : null
        }
      />

      <div className="mt-2 flex flex-col gap-1.5 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <div className="-mx-2 overflow-x-auto px-2 [scrollbar-width:none]">
          <Segmentado
            rotulo="Tipo"
            valor={f.tipo ?? "todos"}
            opcoes={[
              { valor: "todos", rotulo: "Tudo", href: urlLista({ ...f, tipo: null }) },
              ...TIPOS_ITEM.map((t) => ({
                valor: t,
                rotulo: ROTULO_TIPO_ITEM_PLURAL[t],
                href: urlLista({ ...f, tipo: t }),
              })),
            ]}
          />
        </div>
        <BuscaLista
          acao={CAMINHO_ESTOQUE}
          valor={f.busca}
          ocultos={{
            ...(f.tipo ? { tipo: f.tipo } : {}),
            ...(f.arquivados ? { ver: "arquivados" } : {}),
          }}
          placeholder="Nome, SKU ou IMEI"
        />
      </div>

      <section aria-label="Itens do estoque" className="mt-2 max-w-[960px]">
        {error ? (
          <ErroLeitura mensagem={error.message} />
        ) : visiveis.length === 0 ? (
          <Vazio
            titulo={
              f.busca
                ? "Nenhum item com essa busca."
                : f.arquivados
                  ? "Nenhum item arquivado."
                  : f.tipo
                    ? `Nenhum item em ${ROTULO_TIPO_ITEM_PLURAL[f.tipo].toLowerCase()}.`
                    : "O estoque está vazio."
            }
            texto={pagina > 1 ? "Esta página está além do fim da lista." : undefined}
            acao={
              pagina > 1 ? (
                <Link href={urlLista(f)} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Ir para a primeira página
                </Link>
              ) : podeCriar && !f.busca && !f.arquivados ? (
                <Link href={novo} className={classesDoBotao({ variant: "secondary", size: "sm" })}>
                  Cadastrar o primeiro item
                </Link>
              ) : null
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-painel bg-cartao">
            {visiveis.map((i) => {
              const baixo = i.estoque_minimo > 0 && i.quantidade <= i.estoque_minimo;
              return (
                <LinhaFicha
                  key={i.id}
                  href={comVoltar(`${CAMINHO_ESTOQUE}/${i.id}`, voltarLista)}
                  titulo={i.nome}
                  apoio={[
                    ROTULO_TIPO_ITEM[i.tipo],
                    i.condicao ? ROTULO_CONDICAO[i.condicao] : null,
                    i.sku ? `SKU ${i.sku}` : null,
                    i.imei ? `IMEI ${i.imei}` : null,
                    i.preco_centavos > 0 ? formatarReais(i.preco_centavos) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  etiqueta={
                    <Etiqueta tom={i.quantidade === 0 ? "erro" : baixo ? "atencao" : "neutro"}>
                      {i.quantidade.toLocaleString("pt-BR")}
                      {i.quantidade === 0 ? " · zerado" : baixo ? " · no mínimo" : " un."}
                    </Etiqueta>
                  }
                />
              );
            })}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={urlLista({ ...f, arquivados: !f.arquivados })}
            className="tipo-nota text-texto-2 underline-offset-2 hover:text-tinta hover:underline"
          >
            {f.arquivados ? "Ver os itens ativos" : "Ver os arquivados"}
          </Link>
          {visiveis.length > 0 && (pagina > 1 || temProxima) ? (
            <nav aria-label="Páginas" className="flex items-center gap-2">
              <p className="tipo-nota whitespace-nowrap text-texto-2 tabular-nums">
                {(de + 1).toLocaleString("pt-BR")} a {(de + visiveis.length).toLocaleString("pt-BR")}
              </p>
              <Paginador
                anterior={pagina > 1 ? urlLista(f, pagina - 1) : null}
                proxima={temProxima ? urlLista(f, pagina + 1) : null}
              />
            </nav>
          ) : null}
        </div>
      </section>
    </MolduraLoja>
  );
}
