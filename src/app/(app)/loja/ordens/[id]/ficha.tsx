"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button, classesDoBotao } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { BOTAO_ICONE } from "@/components/app/form-styles";
import { formatarData, formatarDataHora, formatarReais } from "@/lib/format";
import {
  CAMINHO_ORDENS,
  centavosParaCampo,
  numeroOs,
  osEmAberto,
  PROXIMOS_STATUS_OS,
  ROTULO_STATUS_OS,
  STATUS_OS,
  type StatusOs,
} from "@/lib/loja";
import { cn } from "@/lib/utils";
import { comVoltar, urlConversa } from "../../../contatos/voltar";
import { AvisoFlutuante } from "../../../configuracoes/editor";
import { CampoLista, CampoTexto, Grupo, LinhaInfo, MIOLO_LINHA } from "../../../configuracoes/ui";
import type { ItemEncontrado } from "../../busca-actions";
import { EscolherItem } from "../../escolher-item";
import { BotaoAcao, FormInline } from "../../form-inline";
import { CabecalhoLoja, Dado, EtiquetaStatusOs, MolduraLoja } from "../../ui";
import { adicionarItemOs, adicionarNotaOs, mudarStatusOs, removerItemOs } from "../actions";

export type OrdemFicha = {
  id: string;
  numero: number;
  status: StatusOs;
  aparelho: string;
  imei: string | null;
  cor: string | null;
  acessorios: string | null;
  estado_aparelho: string | null;
  defeito_relatado: string;
  diagnostico: string | null;
  valor_orcado_centavos: number | null;
  valor_total_centavos: number;
  prazo_previsto: string | null;
  garantia_dias: number;
  aprovado_em: string | null;
  pronta_em: string | null;
  entregue_em: string | null;
  cancelada_em: string | null;
  observacao: string | null;
  criado_em: string;
  cliente: { id: string; nome: string; contato: string | null } | null;
  tecnico: string | null;
};

export type ItemOs = {
  id: string;
  tipo: "peca" | "servico";
  item_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario_centavos: number;
};

export type EventoOs = {
  id: string;
  tipo: "status" | "nota";
  de_status: StatusOs | null;
  para_status: StatusOs | null;
  nota: string | null;
  criado_em: string;
  autor: { nome: string } | null;
};

/** O próximo passo mais provável de cada status: ganha o botão principal. */
const PASSO_NATURAL: Partial<Record<StatusOs, StatusOs>> = {
  aberta: "em_analise",
  em_analise: "aguardando_aprovacao",
  aguardando_aprovacao: "em_reparo",
  em_reparo: "pronta",
  aguardando_peca: "em_reparo",
  pronta: "entregue",
};

/** "Mandar para análise", "Marcar como pronta"… o verbo de cada passo. */
const ACAO_STATUS: Record<StatusOs, string> = {
  aberta: "Reabrir",
  em_analise: "Mandar para análise",
  aguardando_aprovacao: "Passar orçamento",
  em_reparo: "Iniciar reparo",
  aguardando_peca: "Aguardando peça",
  pronta: "Marcar como pronta",
  entregue: "Entregar ao cliente",
  cancelada: "Cancelar OS",
};

export function FichaOrdem({
  os,
  itens,
  eventos,
  erroItens,
  erroEventos,
  podeEditar,
  gestao,
  voltar,
}: {
  os: OrdemFicha;
  itens: ItemOs[];
  eventos: EventoOs[];
  erroItens: string | null;
  erroEventos: string | null;
  podeEditar: boolean;
  gestao: boolean;
  voltar: string | null;
}) {
  const aqui = `${CAMINHO_ORDENS}/${os.id}`;
  const aberta = osEmAberto(os.status);
  // A bancada vê os próximos passos; a gestão pode levar a qualquer status
  // (reabrir uma entregue, pular etapa), e os extras ficam numa lista.
  const proximos = PROXIMOS_STATUS_OS[os.status];
  const natural = PASSO_NATURAL[os.status];
  const extrasGestao = gestao
    ? STATUS_OS.filter((s) => s !== os.status && !proximos.includes(s))
    : [];
  const totalItens = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_centavos, 0);

  return (
    <MolduraLoja>
      <AvisoFlutuante />
      <CabecalhoLoja
        titulo={numeroOs(os.numero)}
        subtitulo={
          <>
            {os.aparelho}
            {os.cor ? `, ${os.cor}` : ""}
            {os.imei ? (
              <>
                {" · IMEI "}
                <span className="tabular-nums">{os.imei}</span>
              </>
            ) : null}
          </>
        }
        voltar={voltar}
        pai={{ href: CAMINHO_ORDENS, rotulo: "Ordens de serviço" }}
        acoes={
          podeEditar ? (
            <Link
              href={comVoltar(`${aqui}/editar`, voltar)}
              className={classesDoBotao({ variant: "secondary", size: "md" })}
            >
              <Pencil size={18} strokeWidth={1.75} aria-hidden />
              Editar
            </Link>
          ) : null
        }
      />

      <div className="mt-3 grid max-w-[1120px] gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:gap-3">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Status e próximos passos */}
          <section aria-labelledby="os-status" className="rounded-painel bg-cartao p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <h2 id="os-status" className="tipo-titulo-3 text-tinta">
                Status
              </h2>
              <EtiquetaStatusOs status={os.status} />
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 tipo-nota text-texto-2 @md:grid-cols-4">
              <Quando rotulo="Entrou" valor={os.criado_em} />
              <Quando rotulo="Aprovada" valor={os.aprovado_em} />
              <Quando rotulo="Pronta" valor={os.pronta_em} />
              <Quando rotulo={os.cancelada_em ? "Cancelada" : "Entregue"} valor={os.cancelada_em ?? os.entregue_em} />
            </dl>
            {podeEditar && (proximos.length > 0 || extrasGestao.length > 0) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {proximos.map((para) => (
                  <BotaoAcao
                    key={para}
                    acao={mudarStatusOs}
                    campos={{ id: os.id, para }}
                    variant={
                      para === natural ? "primary" : para === "cancelada" ? "danger" : "secondary"
                    }
                    size="md"
                    gravando="Mudando…"
                    confirmar={
                      para === "cancelada"
                        ? "Cancelar esta OS? Ela sai da bancada; a gestão pode reabrir depois."
                        : undefined
                    }
                  >
                    {ACAO_STATUS[para]}
                  </BotaoAcao>
                ))}
                {extrasGestao.length > 0 ? (
                  <MudarStatusLivre id={os.id} opcoes={extrasGestao} />
                ) : null}
              </div>
            ) : null}
            {!aberta ? (
              <p className="mt-1.5 tipo-nota text-texto-2">
                {os.status === "entregue"
                  ? `Entregue com ${os.garantia_dias} ${os.garantia_dias === 1 ? "dia" : "dias"} de garantia.`
                  : "OS cancelada."}
                {gestao ? " A gestão pode reabrir pela lista de status." : ""}
              </p>
            ) : null}
          </section>

          {/* Aparelho e defeito */}
          <Grupo id="os-aparelho" titulo="Aparelho">
            <Dado rotulo="Modelo">{os.aparelho}</Dado>
            <Dado rotulo="Cor">{os.cor}</Dado>
            <Dado rotulo="IMEI / série">
              {os.imei ? <span className="tabular-nums">{os.imei}</span> : null}
            </Dado>
            <Dado rotulo="Veio com">{os.acessorios}</Dado>
            <Dado rotulo="Estado na entrada" longo>
              {os.estado_aparelho}
            </Dado>
            <Dado rotulo="Defeito relatado" longo>
              {os.defeito_relatado}
            </Dado>
            <Dado rotulo="Diagnóstico" longo>
              {os.diagnostico}
            </Dado>
            {os.observacao ? (
              <Dado rotulo="Observações" longo>
                {os.observacao}
              </Dado>
            ) : null}
          </Grupo>

          {/* Peças e serviços */}
          <Grupo
            id="os-itens"
            titulo="Peças e serviços"
            direita={totalItens > 0 ? formatarReais(totalItens) : undefined}
            nota={
              os.valor_orcado_centavos !== null && os.valor_orcado_centavos !== totalItens && totalItens > 0
                ? `Orçamento passado ao cliente: ${formatarReais(os.valor_orcado_centavos)}.`
                : undefined
            }
          >
            {erroItens ? (
              <LinhaInfo>
                <span className="tipo-nota text-erro">{erroItens}</span>
              </LinhaInfo>
            ) : itens.length === 0 ? (
              <LinhaInfo>
                <span className="tipo-nota text-texto-2">
                  Nenhuma peça ou serviço lançado ainda.
                </span>
              </LinhaInfo>
            ) : (
              itens.map((i) => (
                <li key={i.id} className="group/linha">
                  <div className="flex min-h-[48px]">
                    <div className={MIOLO_LINHA}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="tipo-corpo truncate text-tinta">{i.descricao}</span>
                        <span className="tipo-nota text-texto-2">
                          {i.tipo === "peca" ? (i.item_id ? "Peça do estoque" : "Peça avulsa") : "Serviço"}
                          {" · "}
                          <span className="tabular-nums">
                            {i.quantidade.toLocaleString("pt-BR")} × {formatarReais(i.valor_unitario_centavos)}
                          </span>
                        </span>
                      </span>
                      <span className="tipo-corpo shrink-0 tabular-nums text-tinta">
                        {formatarReais(i.quantidade * i.valor_unitario_centavos)}
                      </span>
                      {podeEditar && aberta ? (
                        <BotaoAcao
                          acao={removerItemOs}
                          campos={{ id: i.id }}
                          variant="ghost"
                          size="sm"
                          className={cn(BOTAO_ICONE, "h-[32px] w-[32px] pointer-coarse:h-[44px] pointer-coarse:w-[44px]")}
                          confirmar={
                            i.item_id ? "Tirar esta peça da OS? Ela volta ao estoque." : "Tirar esta linha da OS?"
                          }
                        >
                          <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                          <span className="sr-only">Tirar {i.descricao}</span>
                        </BotaoAcao>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))
            )}
          </Grupo>
          {podeEditar && aberta ? <AdicionarItem osId={os.id} /> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Cliente */}
          <section aria-labelledby="os-cliente" className="rounded-painel bg-cartao p-2.5">
            <h2 id="os-cliente" className="tipo-nota tracking-[0.04em] text-texto-2 uppercase">
              Cliente
            </h2>
            {os.cliente ? (
              <>
                <p className="mt-1 tipo-destaque text-tinta">{os.cliente.nome}</p>
                {os.cliente.contato ? (
                  <p className="tipo-nota tabular-nums text-texto-2">{os.cliente.contato}</p>
                ) : null}
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Button
                    href={urlConversa(os.cliente.id, comVoltar(aqui, voltar))}
                    size="md"
                    icone={<MessageSquare size={18} strokeWidth={1.75} aria-hidden />}
                  >
                    Conversa
                  </Button>
                  <Button
                    href={comVoltar(`/contatos/${os.cliente.id}`, comVoltar(aqui, voltar))}
                    variant="secondary"
                    size="md"
                  >
                    Ficha
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1 tipo-corpo text-texto-2">Contato removido da base.</p>
            )}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tipo-nota">
              <dt className="text-texto-2">Técnico</dt>
              <dd className="text-tinta">{os.tecnico ?? "A definir"}</dd>
              <dt className="text-texto-2">Prazo</dt>
              <dd className="text-tinta tabular-nums">
                {os.prazo_previsto ? formatarData(os.prazo_previsto) : "—"}
              </dd>
              <dt className="text-texto-2">Garantia</dt>
              <dd className="text-tinta tabular-nums">
                {os.garantia_dias === 0 ? "Sem garantia" : `${os.garantia_dias} dias`}
              </dd>
              <dt className="text-texto-2">Orçado</dt>
              <dd className="text-tinta tabular-nums">
                {os.valor_orcado_centavos === null ? "—" : formatarReais(os.valor_orcado_centavos)}
              </dd>
            </dl>
          </section>

          {/* Linha do tempo */}
          <Grupo id="os-historico" titulo="Linha do tempo">
            {erroEventos ? (
              <LinhaInfo>
                <span className="tipo-nota text-erro">{erroEventos}</span>
              </LinhaInfo>
            ) : eventos.length === 0 ? (
              <LinhaInfo>
                <span className="tipo-nota text-texto-2">Sem registros.</span>
              </LinhaInfo>
            ) : (
              eventos.map((e) => (
                <li key={e.id} className="group/linha">
                  <div className="flex min-h-[48px]">
                    <div className={cn(MIOLO_LINHA, "flex-col items-start gap-0.5 py-1.5")}>
                      <span className="tipo-corpo text-tinta">
                        {e.tipo === "status" && e.para_status ? (
                          e.de_status ? (
                            <>
                              {ROTULO_STATUS_OS[e.de_status]} → <strong className="font-semibold">{ROTULO_STATUS_OS[e.para_status]}</strong>
                            </>
                          ) : (
                            "OS aberta"
                          )
                        ) : (
                          <span className="whitespace-pre-wrap">{e.nota}</span>
                        )}
                      </span>
                      {e.tipo === "status" && e.nota ? (
                        <span className="tipo-nota whitespace-pre-wrap text-tinta">{e.nota}</span>
                      ) : null}
                      <span className="tipo-nota tabular-nums text-texto-2">
                        {formatarDataHora(e.criado_em)}
                        {e.autor ? ` · ${e.autor.nome}` : ""}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            )}
          </Grupo>
          {podeEditar ? (
            <FormInline
              acao={adicionarNotaOs}
              botao="Gravar nota"
              botaoGravando="Gravando…"
              variant="secondary"
              aria-label="Nova nota na OS"
            >
              <input type="hidden" name="os_id" value={os.id} />
              <CampoTexto
                id="nota-os"
                name="nota"
                label="Nota da equipe"
                rows={2}
                required
                placeholder="O que foi feito, o que o cliente disse, o que falta"
              />
            </FormInline>
          ) : null}
        </div>
      </div>
    </MolduraLoja>
  );
}

function Quando({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col">
      <dt>{rotulo}</dt>
      <dd className={cn("tabular-nums", valor ? "text-tinta" : "text-texto-3")}>
        {valor ? formatarDataHora(valor) : "—"}
      </dd>
    </div>
  );
}

/** A gestão leva a OS a qualquer status: uma lista e o botão. */
function MudarStatusLivre({ id, opcoes }: { id: string; opcoes: readonly StatusOs[] }) {
  return (
    <FormInline
      acao={mudarStatusOs}
      botao="Mudar"
      botaoGravando="Mudando…"
      variant="ghost"
      limparAoGravar={false}
      className="flex-row items-end gap-1"
      aria-label="Mudar para outro status"
    >
      <input type="hidden" name="id" value={id} />
      <CampoLista id="status-livre" name="para" label="Outro status (gestão)">
        {opcoes.map((s) => (
          <option key={s} value={s}>
            {ROTULO_STATUS_OS[s]}
          </option>
        ))}
      </CampoLista>
    </FormInline>
  );
}

/** Acrescentar peça (do estoque ou avulsa) ou serviço à OS. */
function AdicionarItem({ osId }: { osId: string }) {
  const [tipo, setTipo] = useState<"servico" | "peca">("servico");
  const [item, setItem] = useState<ItemEncontrado | null>(null);
  // A descrição e o preço vêm do item escolhido; a pessoa pode mudar.
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

  return (
    <section aria-labelledby="os-adicionar" className="rounded-painel bg-cartao p-2.5">
      <h2 id="os-adicionar" className="tipo-titulo-3 text-tinta">
        Acrescentar à OS
      </h2>
      <FormInline
        acao={adicionarItemOs}
        botao={tipo === "peca" ? "Acrescentar peça" : "Acrescentar serviço"}
        botaoGravando="Acrescentando…"
        className="mt-1.5"
        aria-label="Acrescentar peça ou serviço"
      >
        <input type="hidden" name="os_id" value={osId} />
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="item_id" value={tipo === "peca" && item ? item.id : ""} />
        <div role="radiogroup" aria-label="Tipo" className="inline-flex max-w-full items-center gap-0.5 rounded-controle bg-realce p-0.5">
          {(["servico", "peca"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => {
                setTipo(t);
                if (t === "servico") setItem(null);
              }}
              className={cn(
                "relative inline-flex h-[36px] items-center justify-center rounded-celula px-1.5 text-sm font-semibold transition-[background-color,color] duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta",
                tipo === t ? "bg-elevado text-tinta ring-1 ring-fio" : "text-texto-2 hover:text-tinta",
              )}
            >
              {t === "servico" ? "Serviço" : "Peça"}
            </button>
          ))}
        </div>
        {tipo === "peca" ? (
          <EscolherItem
            escolhido={item}
            onEscolher={(i) => {
              setItem(i);
              if (i) {
                setDescricao(i.nome);
                setValor(centavosParaCampo(i.preco_centavos, true));
              }
            }}
            rotulo="Peça do estoque (opcional)"
            ajuda="Peça do estoque dá baixa no saldo na hora. Sem escolher, a peça entra como avulsa."
          />
        ) : null}
        <div className="grid gap-1.5 @md:grid-cols-[1fr_96px_140px]">
          <Field
            id="descricao-item"
            name="descricao"
            label={tipo === "peca" ? "Peça" : "Serviço"}
            required
            autoComplete="off"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={tipo === "peca" ? "Tela iPhone 13 Incell" : "Troca de tela"}
          />
          <Field
            id="quantidade-item"
            name="quantidade"
            label="Qtd."
            inputMode="numeric"
            defaultValue="1"
            className="tabular-nums"
          />
          <Field
            id="valor-item"
            name="valor_unitario"
            label="Valor unit. (R$)"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="tabular-nums"
          />
        </div>
      </FormInline>
    </section>
  );
}
