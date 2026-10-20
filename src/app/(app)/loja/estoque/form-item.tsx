"use client";

import { useActionState, useEffect, useState } from "react";
import { semReset } from "@/app/entrar/form-acao";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  CONDICOES,
  ROTULO_CONDICAO,
  ROTULO_TIPO_ITEM,
  TIPOS_ITEM,
  type TipoItem,
} from "@/lib/loja";
import { useVoltarPeloHistorico } from "../../contatos/rastro";
import { CampoLista, CampoTexto } from "../../configuracoes/ui";
import { ESTADO_INICIAL, type EstadoForm } from "../estado-form";
import { ErroForm } from "../ui";
import { atualizarItem, criarItem } from "./actions";

export type ValoresItem = {
  tipo: TipoItem;
  nome: string;
  sku: string;
  descricao: string;
  condicao: string;
  imei: string;
  custo: string;
  preco: string;
  estoqueMinimo: string;
  quantidadeInicial: string;
};

export const VALORES_ITEM_VAZIOS: ValoresItem = {
  tipo: "peca",
  nome: "",
  sku: "",
  descricao: "",
  condicao: "novo",
  imei: "",
  custo: "",
  preco: "",
  estoqueMinimo: "0",
  quantidadeInicial: "0",
};

/**
 * O formulário do item do estoque. Aparelho ganha condição e IMEI; os
 * outros, não. No cadastro há a quantidade inicial, que vira a primeira
 * entrada; na edição o saldo não se mexe aqui (é por movimento, na ficha).
 */
export function FormItem({
  modo,
  valores,
  ocultos,
  cancelar,
}: {
  modo: "novo" | "editar";
  valores: ValoresItem;
  ocultos: Record<string, string>;
  cancelar: string;
}) {
  const voltar = useVoltarPeloHistorico(cancelar);
  const [tipo, setTipo] = useState<TipoItem>(valores.tipo);
  const [estado, executar, pendente] = useActionState<EstadoForm, FormData>(
    modo === "novo" ? criarItem : atualizarItem,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.vez > 0 && estado.campo) document.getElementById(estado.campo)?.focus();
  }, [estado.vez, estado.campo]);

  const erroDe = (campo: string) =>
    estado.campo === campo ? (estado.erro ?? undefined) : undefined;

  return (
    <form method="post" onSubmit={semReset(executar)} className="flex max-w-[640px] flex-col gap-2">
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}

      <div className="grid gap-2 @md:grid-cols-[1fr_2fr]">
        <CampoLista
          id="tipo"
          name="tipo"
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoItem)}
        >
          {TIPOS_ITEM.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_ITEM[t]}
            </option>
          ))}
        </CampoLista>
        <Field
          id="nome"
          name="nome"
          label="Nome"
          required
          autoComplete="off"
          defaultValue={valores.nome}
          placeholder={
            tipo === "aparelho"
              ? "iPhone 13 128 GB Meia-noite"
              : tipo === "peca"
                ? "Tela iPhone 13 Incell"
                : "Capa transparente iPhone 13"
          }
          erro={erroDe("nome")}
        />
      </div>

      {tipo === "aparelho" ? (
        <div className="grid gap-2 @md:grid-cols-2">
          <CampoLista id="condicao" name="condicao" label="Condição" defaultValue={valores.condicao}>
            {CONDICOES.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CONDICAO[c]}
              </option>
            ))}
          </CampoLista>
          <Field
            id="imei"
            name="imei"
            label="IMEI"
            autoComplete="off"
            inputMode="numeric"
            className="tabular-nums"
            defaultValue={valores.imei}
            ajuda="Um aparelho por item: o IMEI não se repete."
          />
        </div>
      ) : null}

      <Field
        id="sku"
        name="sku"
        label="SKU / código"
        autoComplete="off"
        defaultValue={valores.sku}
        ajuda="Opcional. O código da etiqueta ou do fornecedor, para achar na busca."
      />

      <div className="grid gap-2 @md:grid-cols-3">
        <Field
          id="custo"
          name="custo"
          label="Custo (R$)"
          inputMode="decimal"
          className="tabular-nums"
          placeholder="0,00"
          defaultValue={valores.custo}
          erro={erroDe("custo")}
        />
        <Field
          id="preco"
          name="preco"
          label="Preço de venda (R$)"
          inputMode="decimal"
          className="tabular-nums"
          placeholder="0,00"
          defaultValue={valores.preco}
          erro={erroDe("preco")}
        />
        <Field
          id="estoque_minimo"
          name="estoque_minimo"
          label="Estoque mínimo"
          inputMode="numeric"
          className="tabular-nums"
          defaultValue={valores.estoqueMinimo}
          ajuda="Abaixo disso a Loja avisa. 0 não avisa."
          erro={erroDe("estoque_minimo")}
        />
      </div>

      {modo === "novo" ? (
        <Field
          id="quantidade_inicial"
          name="quantidade_inicial"
          label="Quantidade em estoque hoje"
          inputMode="numeric"
          className="tabular-nums"
          defaultValue={valores.quantidadeInicial}
          ajuda="Vira a primeira entrada do item. Depois, o saldo muda só por movimento."
          erro={erroDe("quantidade_inicial")}
        />
      ) : null}

      <CampoTexto
        id="descricao"
        name="descricao"
        label="Descrição"
        rows={2}
        defaultValue={valores.descricao}
        placeholder="Compatibilidade, fornecedor, detalhe do modelo"
      />

      {estado.erro && !estado.campo ? <ErroForm>{estado.erro}</ErroForm> : null}

      <div className="mt-1 grid grid-cols-2 gap-1.5 @md:flex">
        <Button type="submit" size="lg" carregando={pendente}>
          {modo === "novo" ? (pendente ? "Cadastrando…" : "Cadastrar item") : pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button href={cancelar} variant="secondary" size="lg" onClick={voltar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
