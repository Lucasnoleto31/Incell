"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { classesDoBotao } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatarDataHora, formatarReais } from "@/lib/format";
import {
  CAMINHO_ESTOQUE,
  CAMINHO_ORDENS,
  CAMINHO_VENDAS,
  ROTULO_CONDICAO,
  ROTULO_MOVIMENTO,
  ROTULO_ORIGEM_MOVIMENTO,
  ROTULO_TIPO_ITEM,
  type Condicao,
  type TipoItem,
  type TipoMovimento,
} from "@/lib/loja";
import { cn } from "@/lib/utils";
import { comVoltar } from "../../../contatos/voltar";
import { AvisoFlutuante } from "../../../configuracoes/editor";
import { CampoLista, Grupo, LinhaInfo, MIOLO_LINHA } from "../../../configuracoes/ui";
import { BotaoAcao, FormInline } from "../../form-inline";
import { CabecalhoLoja, Dado, MolduraLoja, Numero } from "../../ui";
import { arquivarItem, lancarMovimento } from "../actions";

export type ItemFicha = {
  id: string;
  tipo: TipoItem;
  nome: string;
  sku: string | null;
  descricao: string | null;
  condicao: Condicao | null;
  imei: string | null;
  custo_centavos: number;
  preco_centavos: number;
  quantidade: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: string;
};

export type Movimento = {
  id: string;
  tipo: TipoMovimento;
  delta: number;
  origem: string;
  venda_id: string | null;
  os_id: string | null;
  custo_unitario_centavos: number | null;
  observacao: string | null;
  criado_em: string;
  autor: { nome: string } | null;
};

export function FichaItem({
  item,
  movimentos,
  erroMovimentos,
  podeEditar,
  gestao,
  voltar,
}: {
  item: ItemFicha;
  movimentos: Movimento[];
  erroMovimentos: string | null;
  podeEditar: boolean;
  gestao: boolean;
  voltar: string | null;
}) {
  const aqui = `${CAMINHO_ESTOQUE}/${item.id}`;
  const baixo = item.estoque_minimo > 0 && item.quantidade <= item.estoque_minimo;
  const margem =
    item.preco_centavos > 0 && item.custo_centavos > 0
      ? item.preco_centavos - item.custo_centavos
      : null;

  return (
    <MolduraLoja>
      <AvisoFlutuante />
      <CabecalhoLoja
        titulo={item.nome}
        subtitulo={[
          ROTULO_TIPO_ITEM[item.tipo],
          item.condicao ? ROTULO_CONDICAO[item.condicao] : null,
          item.sku ? `SKU ${item.sku}` : null,
          item.ativo ? null : "Arquivado",
        ]
          .filter(Boolean)
          .join(" · ")}
        voltar={voltar}
        pai={{ href: CAMINHO_ESTOQUE, rotulo: "Estoque" }}
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

      <div className="mt-3 grid max-w-[1120px] gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @4xl:gap-3">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Saldo e preços" className="rounded-painel bg-cartao p-2.5">
            <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
              <Numero
                valor={item.quantidade.toLocaleString("pt-BR")}
                rotulo={
                  item.quantidade === 0 ? "em estoque · zerado" : baixo ? "em estoque · no mínimo" : "em estoque"
                }
                tom={item.quantidade === 0 || baixo ? "atencao" : "neutro"}
              />
              <Numero valor={formatarReais(item.preco_centavos)} rotulo="preço de venda" />
              <Numero
                valor={formatarReais(item.custo_centavos)}
                rotulo={margem !== null ? `custo · margem ${formatarReais(margem)}` : "custo"}
              />
            </div>
          </section>

          <Grupo id="item-dados" titulo="Dados">
            <Dado rotulo="Tipo">{ROTULO_TIPO_ITEM[item.tipo]}</Dado>
            {item.tipo === "aparelho" ? (
              <>
                <Dado rotulo="Condição">{item.condicao ? ROTULO_CONDICAO[item.condicao] : null}</Dado>
                <Dado rotulo="IMEI">
                  {item.imei ? <span className="tabular-nums">{item.imei}</span> : null}
                </Dado>
              </>
            ) : null}
            <Dado rotulo="SKU">{item.sku}</Dado>
            <Dado rotulo="Estoque mínimo">
              {item.estoque_minimo === 0 ? "Sem aviso" : item.estoque_minimo.toLocaleString("pt-BR")}
            </Dado>
            <Dado rotulo="Descrição" longo>
              {item.descricao}
            </Dado>
            <Dado rotulo="Cadastrado em">{formatarDataHora(item.criado_em)}</Dado>
          </Grupo>

          {podeEditar ? (
            <div className="flex flex-wrap gap-1.5">
              <BotaoAcao
                acao={arquivarItem}
                campos={{ id: item.id, ativo: item.ativo ? "0" : "1" }}
                variant={item.ativo ? "ghost" : "secondary"}
                size="md"
                className={item.ativo ? "text-erro hover:text-erro" : undefined}
                confirmar={
                  item.ativo
                    ? "Arquivar este item? Ele sai das buscas da OS e da venda; o histórico fica."
                    : undefined
                }
              >
                {item.ativo ? "Arquivar item" : "Reativar item"}
              </BotaoAcao>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {podeEditar && item.ativo ? <LancarMovimento itemId={item.id} saldo={item.quantidade} /> : null}

          <Grupo
            id="item-movimentos"
            titulo="Movimentos"
            nota={gestao ? "Movimento errado se corrige com o lançamento contrário." : undefined}
          >
            {erroMovimentos ? (
              <LinhaInfo>
                <span className="tipo-nota text-erro">{erroMovimentos}</span>
              </LinhaInfo>
            ) : movimentos.length === 0 ? (
              <LinhaInfo>
                <span className="tipo-nota text-texto-2">Nenhum movimento ainda.</span>
              </LinhaInfo>
            ) : (
              movimentos.map((m) => (
                <li key={m.id} className="group/linha">
                  <div className="flex min-h-[48px]">
                    <div className={MIOLO_LINHA}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="tipo-corpo truncate text-tinta">
                          {ROTULO_MOVIMENTO[m.tipo]}
                          {" · "}
                          {ROTULO_ORIGEM_MOVIMENTO[m.origem] ?? m.origem}
                          {m.venda_id ? (
                            <>
                              {" · "}
                              <Link href={`${CAMINHO_VENDAS}/${m.venda_id}`} className="underline-offset-2 hover:underline">
                                ver venda
                              </Link>
                            </>
                          ) : null}
                          {m.os_id ? (
                            <>
                              {" · "}
                              <Link href={`${CAMINHO_ORDENS}/${m.os_id}`} className="underline-offset-2 hover:underline">
                                ver OS
                              </Link>
                            </>
                          ) : null}
                        </span>
                        <span className="tipo-nota truncate text-texto-2">
                          {formatarDataHora(m.criado_em)}
                          {m.autor ? ` · ${m.autor.nome}` : ""}
                          {m.custo_unitario_centavos !== null
                            ? ` · custo ${formatarReais(m.custo_unitario_centavos)}`
                            : ""}
                          {m.observacao ? ` · ${m.observacao}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "tipo-corpo shrink-0 tabular-nums",
                          m.delta > 0 ? "text-bom" : "text-erro",
                        )}
                      >
                        {m.delta > 0 ? "+" : ""}
                        {m.delta.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            )}
          </Grupo>
        </div>
      </div>
    </MolduraLoja>
  );
}

/** Entrada, saída ou ajuste pela contagem. */
function LancarMovimento({ itemId, saldo }: { itemId: string; saldo: number }) {
  const [tipo, setTipo] = useState<TipoMovimento>("entrada");
  return (
    <section aria-labelledby="item-lancar" className="rounded-painel bg-cartao p-2.5">
      <h2 id="item-lancar" className="tipo-titulo-3 text-tinta">
        Lançar movimento
      </h2>
      <FormInline
        acao={lancarMovimento}
        botao={tipo === "entrada" ? "Lançar entrada" : tipo === "saida" ? "Lançar saída" : "Ajustar saldo"}
        botaoGravando="Lançando…"
        className="mt-1.5"
        aria-label="Lançar movimento de estoque"
      >
        <input type="hidden" name="item_id" value={itemId} />
        <div className="grid gap-1.5 @md:grid-cols-[160px_1fr_1fr]">
          <CampoLista
            id="tipo-movimento"
            name="tipo"
            label="Tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoMovimento)}
          >
            <option value="entrada">Entrada (compra)</option>
            <option value="saida">Saída</option>
            <option value="ajuste">Ajuste (contagem)</option>
          </CampoLista>
          {tipo === "ajuste" ? (
            <Field
              id="contagem"
              name="contagem"
              label="Contagem na prateleira"
              inputMode="numeric"
              required
              className="tabular-nums"
              ajuda={`Saldo de hoje: ${saldo.toLocaleString("pt-BR")}. A diferença vira o ajuste.`}
            />
          ) : (
            <Field
              id="quantidade-movimento"
              name="quantidade"
              label="Quantidade"
              inputMode="numeric"
              required
              defaultValue="1"
              className="tabular-nums"
            />
          )}
          {tipo === "entrada" ? (
            <Field
              id="custo-movimento"
              name="custo_unitario"
              label="Custo unitário (R$)"
              inputMode="decimal"
              placeholder="0,00"
              className="tabular-nums"
            />
          ) : null}
        </div>
        <Field
          id="observacao-movimento"
          name="observacao"
          label="Observação"
          autoComplete="off"
          placeholder={
            tipo === "entrada" ? "Fornecedor, nota fiscal" : tipo === "saida" ? "Motivo da saída" : "Inventário de hoje"
          }
        />
      </FormInline>
    </section>
  );
}
