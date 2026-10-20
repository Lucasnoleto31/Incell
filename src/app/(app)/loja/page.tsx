import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Receipt, Wrench, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarReais, agoraEmBrasilia } from "@/lib/format";
import {
  CAMINHO_ESTOQUE,
  CAMINHO_ORDENS,
  CAMINHO_VENDAS,
  STATUS_OS_ABERTOS,
} from "@/lib/loja";
import { cn } from "@/lib/utils";
import { titulo } from "@/lib/marca";
import {
  CabecalhoPagina,
  Grupo,
  LINHA_ACAO,
  MIOLO_LINHA,
  Seta,
  ValorLinha,
} from "../configuracoes/ui";
import { contagem } from "../configuracoes/resultado";
import { perfilDaLoja } from "./acesso";

export const metadata: Metadata = { title: titulo("Loja") };

/**
 * O índice da Loja, no desenho dos Ajustes (como a Administração): uma
 * linha por módulo com o estado do dia à direita. Ordens de serviço na
 * frente, que é o que a bancada abre toda hora; depois o estoque e as
 * vendas.
 */
export default async function LojaPage() {
  await perfilDaLoja();
  const supabase = await createClient();
  const inicioDoMes = `${agoraEmBrasilia().dia.slice(0, 7)}-01T00:00:00-03:00`;

  const contar = (q: PromiseLike<{ count: number | null; error: unknown }>) =>
    q.then((r) => (r.error ? null : (r.count ?? 0)));

  const [naBancada, prontas, baixo, vendasMes] = await Promise.all([
    contar(
      supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .in("status", STATUS_OS_ABERTOS.filter((s) => s !== "pronta")),
    ),
    contar(
      supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("status", "pronta"),
    ),
    // Itens ativos com saldo no mínimo ou abaixo (e com mínimo definido).
    supabase
      .from("estoque_itens")
      .select("id, quantidade, estoque_minimo")
      .eq("ativo", true)
      .gt("estoque_minimo", 0)
      .then((r) =>
        r.error
          ? null
          : (r.data as { quantidade: number; estoque_minimo: number }[]).filter(
              (i) => i.quantidade <= i.estoque_minimo,
            ).length,
      ),
    supabase
      .from("vendas")
      .select("total_centavos")
      .eq("status", "concluida")
      .gte("concluida_em", inicioDoMes)
      .then((r) =>
        r.error
          ? null
          : {
              quantidade: r.data.length,
              total: (r.data as { total_centavos: number }[]).reduce(
                (s, v) => s + v.total_centavos,
                0,
              ),
            },
      ),
  ]);

  return (
    <div className="px-2 pt-3 pb-6 md:px-3 lg:pt-4">
      <CabecalhoPagina titulo="Loja" />
      <div className="mt-3 flex max-w-[720px] flex-col gap-4">
        <Grupo id="loja-bancada" titulo="Assistência">
          <LinhaModulo
            href={CAMINHO_ORDENS}
            icone={Wrench}
            titulo="Ordens de serviço"
            apoio={
              prontas !== null && prontas > 0
                ? `${contagem(prontas, "pronta", "prontas")} para retirada`
                : "Aparelhos na bancada, orçamentos e entregas"
            }
            valor={naBancada === null ? undefined : contagem(naBancada, "aberta", "abertas")}
            tom={prontas !== null && prontas > 0 ? "atencao" : "neutro"}
          />
        </Grupo>
        <Grupo id="loja-estoque" titulo="Estoque">
          <LinhaModulo
            href={CAMINHO_ESTOQUE}
            icone={Boxes}
            titulo="Itens"
            apoio="Aparelhos, peças e acessórios, com entradas e saídas"
            valor={
              baixo === null
                ? undefined
                : baixo === 0
                  ? "Tudo acima do mínimo"
                  : `${contagem(baixo, "item", "itens")} no mínimo`
            }
            tom={baixo !== null && baixo > 0 ? "atencao" : "neutro"}
          />
        </Grupo>
        <Grupo id="loja-vendas" titulo="Vendas">
          <LinhaModulo
            href={CAMINHO_VENDAS}
            icone={Receipt}
            titulo="Vendas"
            apoio={
              vendasMes
                ? `${contagem(vendasMes.quantidade, "venda concluída", "vendas concluídas")} neste mês`
                : "Aparelhos e acessórios vendidos no balcão"
            }
            valor={vendasMes ? formatarReais(vendasMes.total) : undefined}
          />
        </Grupo>
      </div>
    </div>
  );
}

/** Uma linha do índice: ícone, nome, estado e a seta (o mesmo desenho da
 *  Administração). */
function LinhaModulo({
  href,
  icone: Icone,
  titulo,
  apoio,
  valor,
  tom = "neutro",
}: {
  href: string;
  icone: LucideIcon;
  titulo: string;
  apoio?: string;
  valor?: string;
  tom?: "neutro" | "atencao";
}) {
  return (
    <li className="group/linha">
      <Link href={href} className={LINHA_ACAO}>
        <span className="flex shrink-0 items-center pl-2">
          <Icone size={20} strokeWidth={1.75} aria-hidden className="text-texto-2" />
        </span>
        <span className={cn(MIOLO_LINHA, "ml-1.5")}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tipo-corpo truncate text-tinta">{titulo}</span>
            {apoio ? (
              <span
                className={cn(
                  "tipo-nota truncate",
                  tom === "atencao" && !valor ? "text-atencao" : "text-texto-2",
                )}
              >
                {apoio}
              </span>
            ) : null}
          </span>
          {valor ? <ValorLinha tom={tom}>{valor}</ValorLinha> : null}
          <Seta />
        </span>
      </Link>
    </li>
  );
}
