"use client";

import { useState } from "react";
import { CircleAlert, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { BOTAO_ICONE } from "@/components/app/form-styles";
import { formatarDataHora, formatarReais } from "@/lib/format";
import {
  CAMINHO_VENDAS,
  centavosParaCampo,
  FORMAS_PAGAMENTO,
  numeroVenda,
  ROTULO_FORMA_PAGAMENTO,
  type FormaPagamento,
  type StatusVenda,
} from "@/lib/loja";
import { cn } from "@/lib/utils";
import { comVoltar, urlConversa } from "../../../contatos/voltar";
import { AvisoFlutuante } from "../../../configuracoes/editor";
import { CampoLista, CampoTexto, Grupo, LinhaInfo, MIOLO_LINHA } from "../../../configuracoes/ui";
import type { ItemEncontrado } from "../../busca-actions";
import { EscolherItem } from "../../escolher-item";
import { BotaoAcao, FormInline } from "../../form-inline";
import { CabecalhoLoja, EtiquetaStatusVenda, MolduraLoja, Numero } from "../../ui";
import {
  adicionarItemVenda,
  atualizarPagamento,
  cancelarVenda,
  concluirVenda,
  removerItemVenda,
} from "../actions";

export type VendaFicha = {
  id: string;
  numero: number;
  status: StatusVenda;
  forma_pagamento: FormaPagamento | null;
  parcelas: number;
  desconto_centavos: number;
  total_centavos: number;
  observacao: string | null;
  concluida_em: string | null;
  cancelada_em: string | null;
  criado_em: string;
  cliente: { id: string; nome: string; contato: string | null } | null;
  vendedor: string | null;
};

export type ItemVenda = {
  id: string;
  item_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario_centavos: number;
};

export function FichaVenda({
  venda,
  itens,
  erroItens,
  podeMexer,
  gestao,
  aviso,
  voltar,
}: {
  venda: VendaFicha;
  itens: ItemVenda[];
  erroItens: string | null;
  podeMexer: boolean;
  gestao: boolean;
  aviso: "sem_estoque" | null;
  voltar: string | null;
}) {
  const aqui = `${CAMINHO_VENDAS}/${venda.id}`;
  const aberta = venda.status === "aberta";
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_centavos, 0);
  const [forma, setForma] = useState<FormaPagamento | "">(venda.forma_pagamento ?? "");

  return (
    <MolduraLoja>
      <AvisoFlutuante />
      <CabecalhoLoja
        titulo={numeroVenda(venda.numero)}
        subtitulo={[
          venda.vendedor ? `Vendedor: ${venda.vendedor}` : null,
          formatarDataHora(venda.concluida_em ?? venda.criado_em),
        ]
          .filter(Boolean)
          .join(" · ")}
        voltar={voltar}
        pai={{ href: CAMINHO_VENDAS, rotulo: "Vendas" }}
        acoes={<EtiquetaStatusVenda status={venda.status} />}
      />

      {aviso === "sem_estoque" ? (
        <p
          role="status"
          className="mt-2 flex max-w-[68ch] items-start gap-1 rounded-painel bg-cartao p-2 tipo-corpo text-tinta"
        >
          <CircleAlert size={20} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-atencao" />
          A venda foi registrada, mas ficou em aberto: faltou saldo em estoque para algum item.
          Lance a entrada no item ou tire a linha, e conclua aqui.
        </p>
      ) : null}

      <div className="mt-3 grid max-w-[1120px] gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:gap-3">
        <div className="flex min-w-0 flex-col gap-4">
          <Grupo id="venda-itens" titulo="Itens" direita={formatarReais(subtotal)}>
            {erroItens ? (
              <LinhaInfo>
                <span className="tipo-nota text-erro">{erroItens}</span>
              </LinhaInfo>
            ) : itens.length === 0 ? (
              <LinhaInfo>
                <span className="tipo-nota text-texto-2">Nenhum item.</span>
              </LinhaInfo>
            ) : (
              itens.map((i) => (
                <li key={i.id} className="group/linha">
                  <div className="flex min-h-[48px]">
                    <div className={MIOLO_LINHA}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="tipo-corpo truncate text-tinta">{i.descricao}</span>
                        <span className="tipo-nota tabular-nums text-texto-2">
                          {i.item_id ? "Do estoque · " : "Avulso · "}
                          {i.quantidade.toLocaleString("pt-BR")} × {formatarReais(i.valor_unitario_centavos)}
                        </span>
                      </span>
                      <span className="tipo-corpo shrink-0 tabular-nums text-tinta">
                        {formatarReais(i.quantidade * i.valor_unitario_centavos)}
                      </span>
                      {podeMexer && aberta ? (
                        <BotaoAcao
                          acao={removerItemVenda}
                          campos={{ id: i.id }}
                          variant="ghost"
                          size="sm"
                          className={cn(BOTAO_ICONE, "h-[32px] w-[32px] pointer-coarse:h-[44px] pointer-coarse:w-[44px]")}
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

          {podeMexer && aberta ? <AdicionarItem vendaId={venda.id} /> : null}

          {/* Pagamento */}
          <section aria-labelledby="venda-pagamento" className="rounded-painel bg-cartao p-2.5">
            <h2 id="venda-pagamento" className="tipo-titulo-3 text-tinta">
              Pagamento
            </h2>
            {podeMexer && aberta ? (
              <FormInline
                acao={atualizarPagamento}
                botao="Salvar pagamento"
                botaoGravando="Salvando…"
                variant="secondary"
                limparAoGravar={false}
                className="mt-1.5"
                aria-label="Pagamento da venda"
              >
                <input type="hidden" name="id" value={venda.id} />
                <div className="grid gap-1.5 @md:grid-cols-3">
                  <CampoLista
                    id="forma_pagamento"
                    name="forma_pagamento"
                    label="Forma"
                    value={forma}
                    onChange={(e) => setForma(e.target.value as FormaPagamento | "")}
                  >
                    <option value="">A definir</option>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f} value={f}>
                        {ROTULO_FORMA_PAGAMENTO[f]}
                      </option>
                    ))}
                  </CampoLista>
                  {forma === "cartao_credito" ? (
                    <Field
                      id="parcelas"
                      name="parcelas"
                      label="Parcelas"
                      inputMode="numeric"
                      defaultValue={String(venda.parcelas)}
                      className="tabular-nums"
                    />
                  ) : null}
                  <Field
                    id="desconto"
                    name="desconto"
                    label="Desconto (R$)"
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={centavosParaCampo(venda.desconto_centavos, true)}
                    className="tabular-nums"
                  />
                </div>
                <CampoTexto
                  id="observacao"
                  name="observacao"
                  label="Observação"
                  rows={2}
                  defaultValue={venda.observacao ?? ""}
                />
              </FormInline>
            ) : (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tipo-corpo">
                <dt className="text-texto-2">Forma</dt>
                <dd className="text-tinta">
                  {venda.forma_pagamento
                    ? `${ROTULO_FORMA_PAGAMENTO[venda.forma_pagamento]}${venda.parcelas > 1 ? ` em ${venda.parcelas}×` : ""}`
                    : "A definir"}
                </dd>
                <dt className="text-texto-2">Desconto</dt>
                <dd className="text-tinta tabular-nums">{formatarReais(venda.desconto_centavos)}</dd>
                {venda.observacao ? (
                  <>
                    <dt className="text-texto-2">Observação</dt>
                    <dd className="whitespace-pre-wrap text-tinta">{venda.observacao}</dd>
                  </>
                ) : null}
              </dl>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Total e ações */}
          <section aria-label="Total" className="rounded-painel bg-cartao p-2.5">
            <Numero
              valor={formatarReais(venda.total_centavos)}
              rotulo={
                venda.desconto_centavos > 0
                  ? `total · ${formatarReais(subtotal)} com ${formatarReais(venda.desconto_centavos)} de desconto`
                  : "total"
              }
              tom={venda.status === "concluida" ? "bom" : "neutro"}
            />
            {venda.cancelada_em ? (
              <p className="mt-1 tipo-nota text-texto-2">Cancelada em {formatarDataHora(venda.cancelada_em)}.</p>
            ) : null}
            {podeMexer && aberta ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <BotaoAcao acao={concluirVenda} campos={{ id: venda.id }} variant="primary" gravando="Concluindo…">
                  Concluir venda
                </BotaoAcao>
                <BotaoAcao
                  acao={cancelarVenda}
                  campos={{ id: venda.id }}
                  variant="ghost"
                  className="text-erro hover:text-erro"
                  confirmar="Cancelar esta venda?"
                >
                  Cancelar venda
                </BotaoAcao>
              </div>
            ) : null}
            {gestao && venda.status === "concluida" ? (
              <div className="mt-2">
                <BotaoAcao
                  acao={cancelarVenda}
                  campos={{ id: venda.id }}
                  variant="ghost"
                  className="text-erro hover:text-erro"
                  confirmar="Cancelar esta venda concluída? Os itens do estoque voltam ao saldo."
                >
                  Cancelar venda (gestão)
                </BotaoAcao>
              </div>
            ) : null}
          </section>

          {/* Cliente */}
          <section aria-labelledby="venda-cliente" className="rounded-painel bg-cartao p-2.5">
            <h2 id="venda-cliente" className="tipo-nota tracking-[0.04em] text-texto-2 uppercase">
              Cliente
            </h2>
            {venda.cliente ? (
              <>
                <p className="mt-1 tipo-destaque text-tinta">{venda.cliente.nome}</p>
                {venda.cliente.contato ? (
                  <p className="tipo-nota tabular-nums text-texto-2">{venda.cliente.contato}</p>
                ) : null}
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Button
                    href={urlConversa(venda.cliente.id, comVoltar(aqui, voltar))}
                    size="md"
                    icone={<MessageSquare size={18} strokeWidth={1.75} aria-hidden />}
                  >
                    Conversa
                  </Button>
                  <Button
                    href={comVoltar(`/contatos/${venda.cliente.id}`, comVoltar(aqui, voltar))}
                    variant="secondary"
                    size="md"
                  >
                    Ficha
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-1 tipo-corpo text-texto-2">Venda de balcão, sem cadastro.</p>
            )}
          </section>
        </div>
      </div>
    </MolduraLoja>
  );
}

function AdicionarItem({ vendaId }: { vendaId: string }) {
  const [item, setItem] = useState<ItemEncontrado | null>(null);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  return (
    <section aria-labelledby="venda-adicionar" className="rounded-painel bg-cartao p-2.5">
      <h2 id="venda-adicionar" className="tipo-titulo-3 text-tinta">
        Acrescentar item
      </h2>
      <FormInline
        acao={adicionarItemVenda}
        botao="Acrescentar"
        botaoGravando="Acrescentando…"
        variant="secondary"
        className="mt-1.5"
        aria-label="Acrescentar item à venda"
      >
        <input type="hidden" name="venda_id" value={vendaId} />
        <input type="hidden" name="item_id" value={item?.id ?? ""} />
        <EscolherItem
          escolhido={item}
          onEscolher={(i) => {
            setItem(i);
            if (i) {
              setDescricao(i.nome);
              setValor(centavosParaCampo(i.preco_centavos, true));
            }
          }}
          rotulo="Do estoque (opcional)"
        />
        <div className="grid gap-1.5 @md:grid-cols-[1fr_88px_140px]">
          <Field
            id="descricao-venda"
            name="descricao"
            label="Descrição"
            required
            autoComplete="off"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Field id="quantidade-venda" name="quantidade" label="Qtd." inputMode="numeric" defaultValue="1" className="tabular-nums" />
          <Field
            id="valor-venda"
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
