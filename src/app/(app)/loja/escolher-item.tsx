"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { Field } from "@/components/ui/field";
import { AJUDA, BOTAO_ICONE, ROTULO } from "@/components/app/form-styles";
import { buscarItensEstoque, type ItemEncontrado } from "./busca-actions";

/*
 * O campo que acha um item do estoque pelo nome, SKU ou IMEI. Escolhido,
 * vira um cartão com o X; quem usa recebe o item em `onEscolher` (a venda
 * preenche a descrição e o preço; a OS, a peça).
 */
export function EscolherItem({
  escolhido,
  onEscolher,
  rotulo = "Item do estoque",
  ajuda,
}: {
  escolhido: ItemEncontrado | null;
  onEscolher: (item: ItemEncontrado | null) => void;
  rotulo?: string;
  ajuda?: string;
}) {
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<ItemEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const idLista = useId();
  const idCampo = useId();

  useEffect(() => {
    if (escolhido) return;
    const t = termo.trim();
    if (t.length < 2) return;
    let vale = true;
    // O estado muda dentro do atraso (fora do corpo do efeito): a busca só
    // começa quando a pessoa para de digitar.
    const timer = window.setTimeout(() => {
      setBuscando(true);
      buscarItensEstoque(t)
        .then((r) => {
          if (vale) setOpcoes(r);
        })
        .catch(() => {
          if (vale) setOpcoes([]);
        })
        .finally(() => {
          if (vale) setBuscando(false);
        });
    }, 250);
    return () => {
      vale = false;
      window.clearTimeout(timer);
    };
  }, [termo, escolhido]);

  if (escolhido) {
    return (
      <div className="flex flex-col gap-1">
        <p className={ROTULO}>{rotulo}</p>
        <div className="flex min-h-[48px] items-center gap-1 rounded-controle bg-cartao pl-1.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tipo-corpo truncate text-tinta">{escolhido.nome}</span>
            <span className="tipo-nota truncate text-texto-2">{escolhido.apoio}</span>
          </span>
          <button
            type="button"
            aria-label="Trocar o item"
            className={BOTAO_ICONE}
            onClick={() => {
              onEscolher(null);
              setTermo("");
            }}
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Field
        id={idCampo}
        label={rotulo}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          // Com menos de duas letras não há busca: a lista some na hora.
          if (e.target.value.trim().length < 2) setOpcoes(null);
        }}
        autoComplete="off"
        placeholder="Nome, SKU ou IMEI"
        role="combobox"
        aria-expanded={opcoes !== null}
        aria-controls={idLista}
        aria-autocomplete="list"
        ajuda={opcoes === null ? ajuda : undefined}
      />
      {opcoes !== null ? (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Itens encontrados"
          className="overflow-hidden rounded-painel bg-cartao"
        >
          {opcoes.map((i) => (
            <li key={i.id} role="option" aria-selected={false} className="group/linha">
              <button
                type="button"
                onClick={() => {
                  onEscolher(i);
                  setTermo("");
                }}
                className="flex min-h-[48px] w-full items-center text-left transition-colors duration-[120ms] hover:bg-realce active:bg-pressionado focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tinta"
              >
                <span className="ml-2 flex min-w-0 flex-1 flex-col border-t border-fio py-1 pr-1.5 group-first/linha:border-t-0">
                  <span className="tipo-corpo truncate text-tinta">{i.nome}</span>
                  <span className="tipo-nota truncate text-texto-2">{i.apoio}</span>
                </span>
              </button>
            </li>
          ))}
          {buscando || opcoes.length === 0 ? (
            <li className="group/linha">
              <p className="ml-2 flex min-h-[48px] items-center border-t border-fio py-1 pr-1.5 group-first/linha:border-t-0">
                <span className={AJUDA}>
                  {buscando ? "Procurando…" : "Nenhum item ativo com esse nome, SKU ou IMEI."}
                </span>
              </p>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
