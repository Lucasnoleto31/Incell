"use client";

import { useActionState, useEffect, useRef } from "react";
import { semReset } from "@/app/entrar/form-acao";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { avisar } from "../configuracoes/editor";
import type { ResultadoAcao } from "../configuracoes/resultado";
import { ErroForm } from "./ui";

/*
 * O formulário curto que mora dentro de uma ficha da Loja (mudar o status,
 * lançar um movimento, acrescentar um item): server action que devolve
 * { ok, erro }, sem redirecionar. Deu certo: o aviso em pílula e o
 * formulário limpa (a action já revalidou a página). Deu errado: o erro
 * fica acima do botão com o que foi digitado.
 *
 * Mais leve que o editor da Administração (sem folha nem painel): aqui o
 * formulário já está na tela.
 */
export function FormInline({
  acao,
  children,
  botao,
  botaoGravando,
  variant = "primary",
  size = "md",
  limparAoGravar = true,
  className,
  classeBotao,
  "aria-label": rotulo,
}: {
  acao: (estado: ResultadoAcao, formData: FormData) => Promise<ResultadoAcao>;
  children?: React.ReactNode;
  botao: string;
  botaoGravando?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  limparAoGravar?: boolean;
  className?: string;
  classeBotao?: string;
  "aria-label"?: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, despachar, pendente] = useActionState(
    async (anterior: ResultadoAcao, dados: FormData) => {
      const resultado = await acao(anterior, dados);
      if (resultado.ok) {
        avisar(resultado.ok);
        if (limparAoGravar) formulario.current?.reset();
      }
      return resultado;
    },
    {},
  );

  // O aviso de erro some quando a pessoa volta a digitar: ela já viu.
  const ultimoErro = useRef<string | undefined>(undefined);
  useEffect(() => {
    ultimoErro.current = estado.erro;
  }, [estado.erro]);

  return (
    <form
      ref={formulario}
      method="post"
      aria-label={rotulo}
      onSubmit={semReset(despachar)}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {children}
      {estado.erro ? <ErroForm>{estado.erro}</ErroForm> : null}
      <div>
        <Button
          type="submit"
          variant={variant}
          size={size}
          carregando={pendente}
          className={classeBotao}
        >
          {pendente ? (botaoGravando ?? botao) : botao}
        </Button>
      </div>
    </form>
  );
}

/**
 * Um botão só, que dispara uma action com campos escondidos (os botões de
 * status da OS, o "Concluir venda"). Mesmo contrato { ok, erro }.
 */
export function BotaoAcao({
  acao,
  campos,
  children,
  gravando,
  variant = "secondary",
  size = "md",
  className,
  confirmar,
}: {
  acao: (estado: ResultadoAcao, formData: FormData) => Promise<ResultadoAcao>;
  campos: Record<string, string>;
  children: React.ReactNode;
  gravando?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Pergunta antes (confirm nativo): para o que não tem volta fácil. */
  confirmar?: string;
}) {
  const [estado, despachar, pendente] = useActionState(
    async (anterior: ResultadoAcao, dados: FormData) => {
      const resultado = await acao(anterior, dados);
      if (resultado.ok) avisar(resultado.ok);
      if (resultado.erro) avisar(resultado.erro, "erro");
      return resultado;
    },
    {},
  );
  void estado;

  return (
    <form
      method="post"
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) {
          e.preventDefault();
          return;
        }
        semReset(despachar)(e);
      }}
      className="contents"
    >
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size={size}
        carregando={pendente}
        className={className}
      >
        {pendente ? (gravando ?? children) : children}
      </Button>
    </form>
  );
}
