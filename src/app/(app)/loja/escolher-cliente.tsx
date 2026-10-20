"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Field } from "@/components/ui/field";
import { AJUDA, BOTAO_ICONE, ERRO_CAMPO, ROTULO } from "@/components/app/form-styles";
import { cn } from "@/lib/utils";
import { buscarClientes, type ClienteEncontrado } from "./busca-actions";

/*
 * O campo "Cliente" da OS e da venda: a pessoa digita nome ou telefone, a
 * lista de contatos do chat aparece embaixo, e o escolhido vira um cartão
 * com o X para trocar. O id vai num campo escondido (`cliente_id`); o
 * formulário de servidor lê só ele.
 *
 * Sem resultado, o link cadastra o contato em Contatos e volta para cá.
 */
export function EscolherCliente({
  name = "cliente_id",
  inicial,
  erro,
  obrigatorio = false,
  voltar,
}: {
  name?: string;
  inicial: ClienteEncontrado | null;
  erro?: string;
  obrigatorio?: boolean;
  /** A tela atual, para o "Cadastrar contato" voltar para cá. */
  voltar: string;
}) {
  const [escolhido, setEscolhido] = useState<ClienteEncontrado | null>(inicial);
  const [termo, setTermo] = useState("");
  const [opcoes, setOpcoes] = useState<ClienteEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const idLista = useId();

  // Busca com atraso curto enquanto digita; a resposta velha não vence a nova.
  useEffect(() => {
    if (escolhido) return;
    const t = termo.trim();
    if (t.length < 2) return;
    let vale = true;
    // O estado muda dentro do atraso (fora do corpo do efeito): a busca só
    // começa quando a pessoa para de digitar.
    const timer = window.setTimeout(() => {
      setBuscando(true);
      buscarClientes(t)
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
        <p className={ROTULO}>Cliente</p>
        <input type="hidden" name={name} value={escolhido.id} />
        <div className="flex min-h-[48px] items-center gap-1 rounded-controle bg-cartao pl-1.5">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="tipo-corpo truncate text-tinta">{escolhido.nome}</span>
            {escolhido.contato ? (
              <span className="tipo-nota truncate text-texto-2">{escolhido.contato}</span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label="Trocar o cliente"
            className={BOTAO_ICONE}
            onClick={() => {
              setEscolhido(null);
              setTermo("");
              window.setTimeout(() => campo.current?.focus(), 0);
            }}
          >
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {erro ? <p className={ERRO_CAMPO}>{erro}</p> : null}
      </div>
    );
  }

  const cadastrar = `/contatos/novo?voltar=${encodeURIComponent(voltar)}${
    termo.trim() ? `&${/\d{4,}/.test(termo) ? "telefone" : "nome"}=${encodeURIComponent(termo.trim())}` : ""
  }`;

  return (
    <div className="relative flex flex-col gap-1">
      <input type="hidden" name={name} value="" />
      <Field
        ref={campo}
        id={`${name}-busca`}
        label={obrigatorio ? "Cliente" : "Cliente (opcional)"}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          // Com menos de duas letras não há busca: a lista some na hora.
          if (e.target.value.trim().length < 2) setOpcoes(null);
        }}
        autoComplete="off"
        placeholder="Nome ou telefone do contato"
        role="combobox"
        aria-expanded={opcoes !== null}
        aria-controls={idLista}
        aria-autocomplete="list"
        erro={erro}
        ajuda={
          opcoes === null
            ? "O cliente é um contato do chat. Digite para procurar."
            : undefined
        }
      />
      {opcoes !== null ? (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Contatos encontrados"
          className="overflow-hidden rounded-painel bg-cartao"
        >
          {opcoes.map((c) => (
            <li key={c.id} role="option" aria-selected={false} className="group/linha">
              <button
                type="button"
                onClick={() => setEscolhido(c)}
                className="flex min-h-[48px] w-full items-center text-left transition-colors duration-[120ms] hover:bg-realce active:bg-pressionado focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tinta"
              >
                <span className="ml-2 flex min-w-0 flex-1 flex-col border-t border-fio py-1 pr-1.5 group-first/linha:border-t-0">
                  <span className="tipo-corpo truncate text-tinta">{c.nome}</span>
                  {c.contato ? (
                    <span className="tipo-nota truncate text-texto-2">{c.contato}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          <li className="group/linha">
            <div
              className={cn(
                "ml-2 flex min-h-[48px] items-center gap-1 border-t border-fio py-1 pr-1.5 group-first/linha:border-t-0",
              )}
            >
              <Search size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-texto-3" />
              <span className={cn(AJUDA, "flex-1")}>
                {buscando
                  ? "Procurando…"
                  : opcoes.length === 0
                    ? "Nenhum contato com esse nome ou telefone."
                    : "Não é nenhum destes?"}
              </span>
              <Link
                href={cadastrar}
                className="tipo-nota shrink-0 font-semibold text-tinta underline-offset-2 hover:underline"
              >
                Cadastrar contato
              </Link>
            </div>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
