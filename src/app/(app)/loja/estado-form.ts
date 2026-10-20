/**
 * O que as actions de cadastro e edição da Loja devolvem quando não dá para
 * gravar (o mesmo desenho de contatos/form-estado.ts): o erro, o campo com
 * problema (o erro vai embaixo dele e o foco também) e a vez, que muda a
 * cada envio para o foco voltar mesmo com o mesmo erro. Gravar com sucesso
 * não devolve nada: a action redireciona.
 */
export type EstadoForm = {
  erro: string | null;
  campo: string | null;
  vez: number;
};

export const ESTADO_INICIAL: EstadoForm = { erro: null, campo: null, vez: 0 };

/** A falha, já com a vez da próxima tentativa. */
export function falhaDe(anterior: EstadoForm) {
  return (erro: string, campo: string | null = null): EstadoForm => ({
    erro,
    campo,
    vez: anterior.vez + 1,
  });
}

/** O texto de um campo do formulário, limpo e cortado. */
export function texto(formData: FormData, nome: string, maximo = 2000): string {
  return String(formData.get(nome) ?? "")
    .trim()
    .slice(0, maximo);
}

/**
 * O que as leituras de formulário devolvem: ou o erro (já no EstadoForm),
 * ou os valores. Os dois lados têm a outra chave como undefined para o
 * `if (lido.erro)` estreitar o tipo.
 */
export type Lido<T> =
  | { erro: EstadoForm; valores?: undefined }
  | { erro?: undefined; valores: T };
