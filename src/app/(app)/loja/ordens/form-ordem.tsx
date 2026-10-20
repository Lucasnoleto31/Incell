"use client";

import { useActionState, useEffect } from "react";
import { semReset } from "@/app/entrar/form-acao";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useVoltarPeloHistorico } from "../../contatos/rastro";
import { CampoLista, CampoTexto } from "../../configuracoes/ui";
import type { ClienteEncontrado } from "../busca-actions";
import { EscolherCliente } from "../escolher-cliente";
import { ESTADO_INICIAL, type EstadoForm } from "../estado-form";
import { ErroForm } from "../ui";
import { atualizarOrdem, criarOrdem } from "./actions";

/*
 * O formulário da ordem de serviço, no cadastro e na edição. A action vem
 * daqui (componente de servidor não passa função para o cliente). Erro de
 * um campo vai embaixo dele, com o foco; os outros ficam acima dos botões,
 * e o que foi digitado continua nos campos (semReset).
 */

export type ValoresOrdem = {
  aparelho: string;
  imei: string;
  cor: string;
  acessorios: string;
  estadoAparelho: string;
  defeitoRelatado: string;
  diagnostico: string;
  tecnicoId: string;
  valorOrcado: string;
  prazoPrevisto: string;
  garantiaDias: string;
  observacao: string;
};

export const VALORES_ORDEM_VAZIOS: ValoresOrdem = {
  aparelho: "",
  imei: "",
  cor: "",
  acessorios: "",
  estadoAparelho: "",
  defeitoRelatado: "",
  diagnostico: "",
  tecnicoId: "",
  valorOrcado: "",
  prazoPrevisto: "",
  garantiaDias: "90",
  observacao: "",
};

export function FormOrdem({
  modo,
  valores,
  cliente,
  ocultos,
  tecnicos,
  cancelar,
  aqui,
}: {
  modo: "nova" | "editar";
  valores: ValoresOrdem;
  cliente: ClienteEncontrado | null;
  /** Campos escondidos que a action lê (id, voltar). */
  ocultos: Record<string, string>;
  tecnicos: { id: string; nome: string }[];
  cancelar: string;
  /** O endereço desta tela, para o "Cadastrar contato" voltar para cá. */
  aqui: string;
}) {
  const voltar = useVoltarPeloHistorico(cancelar);
  const [estado, executar, pendente] = useActionState<EstadoForm, FormData>(
    modo === "nova" ? criarOrdem : atualizarOrdem,
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.vez > 0 && estado.campo) {
      (
        document.getElementById(estado.campo) ??
        document.getElementById(`${estado.campo}-busca`)
      )?.focus();
    }
  }, [estado.vez, estado.campo]);

  const erroDe = (campo: string) =>
    estado.campo === campo ? (estado.erro ?? undefined) : undefined;

  return (
    <form
      method="post"
      onSubmit={semReset(executar)}
      className="flex max-w-[640px] flex-col gap-2"
    >
      {Object.entries(ocultos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}

      <EscolherCliente
        inicial={cliente}
        erro={erroDe("cliente_id")}
        obrigatorio
        voltar={aqui}
      />

      <div className="grid gap-2 @md:grid-cols-[2fr_1fr]">
        <Field
          id="aparelho"
          name="aparelho"
          label="Aparelho"
          required
          autoComplete="off"
          placeholder="iPhone 13 128 GB"
          defaultValue={valores.aparelho}
          erro={erroDe("aparelho")}
        />
        <Field
          id="cor"
          name="cor"
          label="Cor"
          autoComplete="off"
          defaultValue={valores.cor}
        />
      </div>

      <Field
        id="imei"
        name="imei"
        label="IMEI ou número de série"
        autoComplete="off"
        inputMode="numeric"
        className="tabular-nums"
        defaultValue={valores.imei}
        ajuda="Ajustes › Geral › Sobre, ou *#06# no teclado."
      />

      <CampoTexto
        id="defeito_relatado"
        name="defeito_relatado"
        label="Defeito relatado pelo cliente"
        required
        rows={3}
        defaultValue={valores.defeitoRelatado}
        placeholder="Ex.: tela não acende depois de cair; bateria dura 2 horas"
      />
      {erroDe("defeito_relatado") ? (
        <p className="-mt-1.5 text-xs text-erro">{erroDe("defeito_relatado")}</p>
      ) : null}

      <CampoTexto
        id="estado_aparelho"
        name="estado_aparelho"
        label="Estado do aparelho na entrada"
        rows={2}
        defaultValue={valores.estadoAparelho}
        placeholder="Riscos, trincas, marcas de umidade, botões"
        ajuda="O que já estava assim quando chegou, para não virar reclamação na retirada."
      />

      <Field
        id="acessorios"
        name="acessorios"
        label="Veio com"
        autoComplete="off"
        defaultValue={valores.acessorios}
        placeholder="Capa, película, carregador"
      />

      {modo === "editar" ? (
        <CampoTexto
          id="diagnostico"
          name="diagnostico"
          label="Diagnóstico do técnico"
          rows={3}
          defaultValue={valores.diagnostico}
        />
      ) : null}

      <div className="grid gap-2 @md:grid-cols-3">
        <CampoLista
          id="tecnico_id"
          name="tecnico_id"
          label="Técnico"
          defaultValue={valores.tecnicoId}
        >
          <option value="">A definir</option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </CampoLista>
        <Field
          id="prazo_previsto"
          name="prazo_previsto"
          type="date"
          label="Prazo previsto"
          defaultValue={valores.prazoPrevisto}
          erro={erroDe("prazo_previsto")}
        />
        <Field
          id="garantia_dias"
          name="garantia_dias"
          label="Garantia (dias)"
          inputMode="numeric"
          className="tabular-nums"
          defaultValue={valores.garantiaDias}
          erro={erroDe("garantia_dias")}
        />
      </div>

      <Field
        id="valor_orcado"
        name="valor_orcado"
        label="Valor orçado (R$)"
        inputMode="decimal"
        className="tabular-nums"
        placeholder="0,00"
        defaultValue={valores.valorOrcado}
        ajuda="O que foi passado ao cliente. As peças e os serviços somam à parte, na ficha."
        erro={erroDe("valor_orcado")}
      />

      <CampoTexto
        id="observacao"
        name="observacao"
        label="Observações"
        rows={2}
        defaultValue={valores.observacao}
        placeholder="Senha do aparelho, combinado com o cliente, recado para a bancada"
      />

      {estado.erro && !estado.campo ? <ErroForm>{estado.erro}</ErroForm> : null}

      <div className="mt-1 grid grid-cols-2 gap-1.5 @md:flex">
        <Button type="submit" size="lg" carregando={pendente}>
          {modo === "nova"
            ? pendente
              ? "Abrindo…"
              : "Abrir OS"
            : pendente
              ? "Salvando…"
              : "Salvar"}
        </Button>
        <Button href={cancelar} variant="secondary" size="lg" onClick={voltar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
