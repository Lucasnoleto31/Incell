import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Etiqueta } from "@/components/ui/etiqueta";
import { cn } from "@/lib/utils";
import {
  CAMINHO_LOJA,
  ROTULO_STATUS_OS,
  ROTULO_STATUS_VENDA,
  TOM_STATUS_OS,
  TOM_STATUS_VENDA,
  type StatusOs,
  type StatusVenda,
} from "@/lib/loja";
import { CabecalhoPagina, LINHA_ACAO, MIOLO_LINHA, Seta } from "../configuracoes/ui";
import { LinkVoltarAdmin } from "../admin/subpagina";
import { lerVoltar, rotuloVoltar, voltarDiferenteDe } from "../contatos/voltar";

/*
 * As peças comuns das telas da Loja, no mesmo desenho da Administração:
 * "‹ Loja" acima do título grande, grupos de linhas de 48px no cartão
 * chapado, estado em texto curto (Etiqueta), erro perto do problema.
 *
 * Sem "use client": servem às páginas de servidor e às telas de cliente.
 */

/** O ?voltar= de uma tela da Loja, já conferido. */
export function voltarDaLoja(valor: unknown, propria: string): string | null {
  return voltarDiferenteDe(lerVoltar(valor), propria);
}

/**
 * O "‹ Loja" (ou a volta do ?voltar=, ou a tela-mãe passada em `pai`) e o
 * título. `pai` é para as telas de terceiro nível: a ficha da OS volta à
 * lista de OS, não ao índice.
 */
export function CabecalhoLoja({
  titulo,
  voltar = null,
  pai,
  acoes,
  subtitulo,
}: {
  titulo: string;
  voltar?: string | null;
  pai?: { href: string; rotulo: string };
  acoes?: React.ReactNode;
  subtitulo?: React.ReactNode;
}) {
  const volta = voltar
    ? { href: voltar, rotulo: rotuloVoltar(voltar) }
    : (pai ?? { href: CAMINHO_LOJA, rotulo: "Loja" });
  return (
    <>
      <div className="mb-1.5">
        <LinkVoltarAdmin href={volta.href} rotulo={volta.rotulo} />
      </div>
      <CabecalhoPagina titulo={titulo} acoes={acoes} />
      {subtitulo ? (
        <p className="mt-0.5 tipo-subtitulo text-texto-2">{subtitulo}</p>
      ) : null}
    </>
  );
}

/** A moldura das telas da Loja: o mesmo respiro das outras. */
export function MolduraLoja({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container px-2 pt-2 pb-6 md:px-3 md:pt-3 lg:pt-3">
      {children}
    </div>
  );
}

/** Linha de lista que abre uma ficha: título, apoio, valor e seta. */
export function LinhaFicha({
  href,
  titulo,
  apoio,
  direita,
  etiqueta,
}: {
  href: string;
  titulo: React.ReactNode;
  apoio?: React.ReactNode;
  /** Valor à direita (dinheiro, quantidade), em algarismo tabular. */
  direita?: React.ReactNode;
  /** A etiqueta de estado, à direita antes da seta. */
  etiqueta?: React.ReactNode;
}) {
  return (
    <li className="group/linha">
      <Link href={href} prefetch={false} className={LINHA_ACAO}>
        <span className={MIOLO_LINHA}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tipo-corpo truncate text-tinta">{titulo}</span>
            {apoio ? (
              <span className="tipo-nota truncate text-texto-2">{apoio}</span>
            ) : null}
          </span>
          {direita ? (
            <span className="tipo-corpo shrink-0 text-right tabular-nums text-tinta">
              {direita}
            </span>
          ) : null}
          {etiqueta}
          <Seta />
        </span>
      </Link>
    </li>
  );
}

/** O cartão de lista vazia: uma frase e, se houver, a ação. */
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-painel bg-cartao p-2.5">
      <p className="tipo-destaque text-tinta">{titulo}</p>
      {texto ? <p className="mt-0.5 tipo-nota text-texto-2">{texto}</p> : null}
      {acao ? <div className="mt-1.5">{acao}</div> : null}
    </div>
  );
}

/** O erro de leitura de uma lista ou ficha, com o texto do banco. */
export function ErroLeitura({ mensagem }: { mensagem: string }) {
  return (
    <div role="alert" className="rounded-painel bg-cartao p-2.5">
      <p className="tipo-destaque text-erro">Não deu para carregar.</p>
      <p className="mt-0.5 tipo-nota break-words text-texto-2">{mensagem}</p>
    </div>
  );
}

/** O erro geral de um formulário (sem campo), acima dos botões. */
export function ErroForm({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1 rounded-painel bg-cartao p-2 tipo-corpo text-erro"
    >
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
      {children}
    </p>
  );
}

export function EtiquetaStatusOs({ status }: { status: StatusOs }) {
  return <Etiqueta tom={TOM_STATUS_OS[status]}>{ROTULO_STATUS_OS[status]}</Etiqueta>;
}

export function EtiquetaStatusVenda({ status }: { status: StatusVenda }) {
  return (
    <Etiqueta tom={TOM_STATUS_VENDA[status]}>{ROTULO_STATUS_VENDA[status]}</Etiqueta>
  );
}

/**
 * Par rótulo/valor das fichas (o "Aparelho: iPhone 13"), em linhas de
 * grupo. O valor quebra em várias linhas quando é texto longo.
 */
export function Dado({
  rotulo,
  children,
  longo = false,
}: {
  rotulo: string;
  children: React.ReactNode;
  longo?: boolean;
}) {
  return (
    <li className="group/linha">
      <div className="flex min-h-[48px]">
        <div className={cn(MIOLO_LINHA, longo && "flex-col items-start gap-0.5")}>
          <span className={cn("tipo-nota text-texto-2", !longo && "w-[120px] shrink-0")}>
            {rotulo}
          </span>
          <span
            className={cn(
              "tipo-corpo min-w-0 flex-1 text-tinta",
              longo ? "whitespace-pre-wrap" : "truncate",
            )}
          >
            {children ?? <span className="text-texto-3">—</span>}
          </span>
        </div>
      </div>
    </li>
  );
}

/** Um número grande com o rótulo embaixo (os totais do índice). */
export function Numero({
  valor,
  rotulo,
  tom = "neutro",
}: {
  valor: string;
  rotulo: string;
  tom?: "neutro" | "atencao" | "bom";
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "tipo-titulo-1 tabular-nums",
          tom === "atencao" ? "text-atencao" : tom === "bom" ? "text-bom" : "text-tinta",
        )}
      >
        {valor}
      </span>
      <span className="tipo-nota text-texto-2">{rotulo}</span>
    </div>
  );
}
