"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { semReset } from "@/app/entrar/form-acao";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { BOTAO_ICONE } from "@/components/app/form-styles";
import { formatarReais } from "@/lib/format";
import {
  centavosParaCampo,
  FORMAS_PAGAMENTO,
  lerCentavos,
  ROTULO_FORMA_PAGAMENTO,
  type FormaPagamento,
} from "@/lib/loja";
import { cn } from "@/lib/utils";
import { useVoltarPeloHistorico } from "../../contatos/rastro";
import { CampoInterruptor, CampoLista, CampoTexto, MIOLO_LINHA } from "../../configuracoes/ui";
import type { ClienteEncontrado, ItemEncontrado } from "../busca-actions";
import { EscolherCliente } from "../escolher-cliente";
import { EscolherItem } from "../escolher-item";
import { ESTADO_INICIAL, type EstadoForm } from "../estado-form";
import { ErroForm } from "../ui";
import { criarVenda } from "./actions";

/*
 * O formulário da venda: os itens são montados na tela (do estoque ou
 * avulsos) e vão juntos num campo escondido em JSON; o cliente é opcional
 * (venda de balcão sem cadastro); o pagamento e o "concluir agora" fecham a
 * venda no mesmo gesto, com a baixa no estoque.
 */

type LinhaItem = {
  chave: number;
  item: ItemEncontrado | null;
  descricao: string;
  quantidade: string;
  valor: string;
};

export function FormVenda({
  cliente,
  vendedores,
  vendedorInicial,
  ocultos,
  cancelar,
  aqui,
}: {
  cliente: ClienteEncontrado | null;
  /** Para a gestão, quem vendeu; para os outros, null (vende em nome próprio). */
  vendedores: { id: string; nome: string }[] | null;
  vendedorInicial: string;
  ocultos: Record<string, string>;
  cancelar: string;
  aqui: string;
}) {
  const voltar = useVoltarPeloHistorico(cancelar);
  const [estado, executar, pendente] = useActionState<EstadoForm, FormData>(criarVenda, ESTADO_INICIAL);
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [proximaChave, setProximaChave] = useState(1);
  const [novo, setNovo] = useState<LinhaItem>({
    chave: 0,
    item: null,
    descricao: "",
    quantidade: "1",
    valor: "",
  });
  const [forma, setForma] = useState<FormaPagamento | "">("pix");
  const [desconto, setDesconto] = useState("");

  useEffect(() => {
    if (estado.vez > 0 && estado.campo) {
      (
        document.getElementById(estado.campo) ?? document.getElementById(`${estado.campo}-busca`)
      )?.focus();
    }
  }, [estado.vez, estado.campo]);

  const erroDe = (campo: string) =>
    estado.campo === campo ? (estado.erro ?? undefined) : undefined;

  const subtotal = linhas.reduce(
    (s, l) => s + (lerCentavos(l.quantidade) ?? 0) / 100 * (lerCentavos(l.valor) ?? 0),
    0,
  );
  const descontoCentavos = lerCentavos(desconto) ?? 0;
  const total = Math.max(0, Math.round(subtotal) - descontoCentavos);

  const acrescentar = () => {
    if (!novo.descricao.trim()) return;
    setLinhas((ls) => [...ls, { ...novo, chave: proximaChave }]);
    setProximaChave((n) => n + 1);
    setNovo({ chave: 0, item: null, descricao: "", quantidade: "1", valor: "" });
  };

  const itensJson = JSON.stringify(
    linhas.map((l) => ({
      item_id: l.item?.id ?? null,
      descricao: l.descricao,
      quantidade: l.quantidade,
      valor: l.valor,
    })),
  );

  return (
    <form method="post" onSubmit={semReset(executar)} className="flex max-w-[720px] flex-col gap-3">
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <input type="hidden" name="itens" value={itensJson} />

      {/* Itens */}
      <section aria-labelledby="venda-itens" className="flex flex-col gap-1.5">
        <h2 id="venda-itens" className="tipo-titulo-3 text-tinta">
          Itens
        </h2>
        {linhas.length > 0 ? (
          <ul className="overflow-hidden rounded-painel bg-cartao">
            {linhas.map((l) => {
              const q = lerCentavos(l.quantidade) ?? 0;
              const v = lerCentavos(l.valor) ?? 0;
              return (
                <li key={l.chave} className="group/linha">
                  <div className="flex min-h-[48px]">
                    <div className={MIOLO_LINHA}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="tipo-corpo truncate text-tinta">{l.descricao}</span>
                        <span className="tipo-nota tabular-nums text-texto-2">
                          {l.item ? "Do estoque · " : "Avulso · "}
                          {l.quantidade} × {formatarReais(v)}
                        </span>
                      </span>
                      <span className="tipo-corpo shrink-0 tabular-nums text-tinta">
                        {formatarReais(Math.round((q / 100) * v))}
                      </span>
                      <button
                        type="button"
                        aria-label={`Tirar ${l.descricao}`}
                        className={cn(BOTAO_ICONE, "h-[32px] w-[32px]")}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                      >
                        <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {erroDe("itens") ? <p id="itens" tabIndex={-1} className="text-xs text-erro">{erroDe("itens")}</p> : null}

        <div className="flex flex-col gap-1.5 rounded-painel bg-cartao p-2">
          <EscolherItem
            escolhido={novo.item}
            onEscolher={(i) =>
              setNovo((n) => ({
                ...n,
                item: i,
                descricao: i ? i.nome : n.descricao,
                valor: i ? centavosParaCampo(i.preco_centavos, true) : n.valor,
              }))
            }
            rotulo="Do estoque (opcional)"
            ajuda="Escolha do estoque para dar baixa ao concluir, ou descreva um item avulso abaixo."
          />
          <div className="grid gap-1.5 @md:grid-cols-[1fr_88px_140px_auto]">
            <Field
              id="novo-descricao"
              label="Descrição"
              autoComplete="off"
              value={novo.descricao}
              onChange={(e) => setNovo((n) => ({ ...n, descricao: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  acrescentar();
                }
              }}
              placeholder="iPhone 13 128 GB seminovo"
            />
            <Field
              id="novo-quantidade"
              label="Qtd."
              inputMode="numeric"
              className="tabular-nums"
              value={novo.quantidade}
              onChange={(e) => setNovo((n) => ({ ...n, quantidade: e.target.value }))}
            />
            <Field
              id="novo-valor"
              label="Valor unit. (R$)"
              inputMode="decimal"
              placeholder="0,00"
              className="tabular-nums"
              value={novo.valor}
              onChange={(e) => setNovo((n) => ({ ...n, valor: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  acrescentar();
                }
              }}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={acrescentar}
                disabled={!novo.descricao.trim()}
                icone={<Plus size={18} strokeWidth={1.75} aria-hidden />}
                className="w-full @md:w-auto"
              >
                Acrescentar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cliente e vendedor */}
      <EscolherCliente inicial={cliente} erro={erroDe("cliente_id")} voltar={aqui} />
      {vendedores ? (
        <CampoLista id="vendedor_id" name="vendedor_id" label="Vendedor" defaultValue={vendedorInicial}>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
        </CampoLista>
      ) : null}

      {/* Pagamento */}
      <section aria-labelledby="venda-pagamento" className="flex flex-col gap-1.5">
        <h2 id="venda-pagamento" className="tipo-titulo-3 text-tinta">
          Pagamento
        </h2>
        <div className="grid gap-2 @md:grid-cols-3">
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
              defaultValue="1"
              className="tabular-nums"
            />
          ) : null}
          <Field
            id="desconto"
            name="desconto"
            label="Desconto (R$)"
            inputMode="decimal"
            placeholder="0,00"
            className="tabular-nums"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            erro={erroDe("desconto")}
          />
        </div>
        <CampoTexto
          id="observacao"
          name="observacao"
          label="Observação"
          rows={2}
          placeholder="Garantia combinada, troca, brinde"
        />
        <ul className="overflow-hidden rounded-painel bg-cartao">
          <CampoInterruptor
            name="concluir"
            value="1"
            rotulo="Concluir agora"
            ajuda="Dá baixa no estoque e fecha a venda. Desligado, ela fica em aberto para concluir depois."
            defaultChecked
          />
        </ul>
      </section>

      {/* Total */}
      <div className="flex items-end justify-between gap-2 rounded-painel bg-cartao p-2.5">
        <div className="tipo-nota text-texto-2">
          <p>Subtotal {formatarReais(Math.round(subtotal))}</p>
          {descontoCentavos > 0 ? <p>Desconto {formatarReais(descontoCentavos)}</p> : null}
        </div>
        <p className="tipo-titulo-1 tabular-nums text-tinta">{formatarReais(total)}</p>
      </div>

      {estado.erro && !estado.campo ? <ErroForm>{estado.erro}</ErroForm> : null}

      <div className="grid grid-cols-2 gap-1.5 @md:flex">
        <Button type="submit" size="lg" carregando={pendente} disabled={linhas.length === 0}>
          {pendente ? "Registrando…" : "Registrar venda"}
        </Button>
        <Button href={cancelar} variant="secondary" size="lg" onClick={voltar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
