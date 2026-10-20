import { redirect } from "next/navigation";
import { perfilAtual, perfilQueEscreve, type PerfilSessao } from "@/lib/auth";
import { somenteLeitura } from "@/lib/papeis";

/*
 * Quem entra na Loja: toda a equipe com conta ativa lê (o layout já barrou
 * a desativada); o compliance só lê. As actions conferem de novo com
 * quemEscreveNaLoja(), e o RLS do banco (0070) decide por baixo.
 */

/** O perfil de quem abre uma tela da Loja; sem sessão, o login. */
export async function perfilDaLoja(): Promise<PerfilSessao> {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");
  return perfil;
}

/** A pessoa pode cadastrar e mudar (não é compliance). */
export function podeEscreverNaLoja(perfil: PerfilSessao | null): boolean {
  return perfil !== null && !somenteLeitura(perfil.papel);
}

/** A guarda das actions: conta ativa e que grava; null para quem não. */
export async function quemEscreveNaLoja(): Promise<PerfilSessao | null> {
  return perfilQueEscreve();
}

export const SEM_PERMISSAO_LOJA =
  "Sua conta é só de leitura: fale com a gestão para cadastrar ou mudar.";
