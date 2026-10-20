"use server";

import { createClient } from "@/lib/supabase/server";
import { perfilAtivo } from "@/lib/auth";
import { formatarTelefone } from "@/lib/format";
import { normalizarTelefone } from "@/lib/telefone";
import { ROTULO_TIPO_ITEM, type TipoItem } from "@/lib/loja";

/*
 * As buscas que os seletores dos formulários da Loja fazem enquanto a
 * pessoa digita: o cliente (um contato do chat) e o item do estoque. Poucas
 * linhas por vez; o RLS recorta o que a pessoa vê.
 */

const LIMITE = 8;

export type ClienteEncontrado = {
  id: string;
  nome: string;
  /** Telefone formatado ou @ do Instagram, para a pessoa reconhecer. */
  contato: string | null;
};

/** Contatos pelo nome ou pelo telefone (com DDD, como a pessoa digita). */
export async function buscarClientes(termo: string): Promise<ClienteEncontrado[]> {
  if (!(await perfilAtivo())) return [];
  const t = termo.trim().slice(0, 80);
  if (t.length < 2) return [];
  const supabase = await createClient();

  const digitos = t.replace(/\D/g, "");
  let q = supabase
    .from("leads")
    .select("id, nome, telefone_e164, instagram_usuario")
    .order("ultima_interacao_em", { ascending: false, nullsFirst: false })
    .limit(LIMITE);
  if (digitos.length >= 4 && digitos.length === t.replace(/[\s()+\-.]/g, "").length) {
    // Só número: procura no telefone (o E.164 ou o que foi digitado).
    const e164 = normalizarTelefone(t, { aceitarExterior: true });
    q = q.or(
      [`telefone_e164.ilike.%${digitos}%`, e164 ? `telefone_e164.eq.${e164}` : null]
        .filter(Boolean)
        .join(","),
    );
  } else {
    // O % e o _ do ilike saem do que a pessoa digitou.
    const seguro = t.replace(/[%_]/g, "");
    q = q.or(`nome.ilike.%${seguro}%,instagram_usuario.ilike.%${seguro}%`);
  }

  const { data } = await q;
  return ((data ?? []) as {
    id: string;
    nome: string;
    telefone_e164: string | null;
    instagram_usuario: string | null;
  }[]).map((l) => ({
    id: l.id,
    nome: l.nome,
    contato: l.telefone_e164
      ? formatarTelefone(l.telefone_e164)
      : l.instagram_usuario
        ? `@${l.instagram_usuario}`
        : null,
  }));
}

export type ItemEncontrado = {
  id: string;
  nome: string;
  tipo: TipoItem;
  sku: string | null;
  quantidade: number;
  preco_centavos: number;
  /** "Peça · SKU 123 · 4 em estoque". */
  apoio: string;
};

/** Itens ativos do estoque pelo nome, SKU ou IMEI. */
export async function buscarItensEstoque(termo: string): Promise<ItemEncontrado[]> {
  if (!(await perfilAtivo())) return [];
  const t = termo.trim().slice(0, 80).replace(/[%_]/g, "");
  if (t.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("estoque_itens")
    .select("id, nome, tipo, sku, imei, quantidade, preco_centavos")
    .eq("ativo", true)
    .or(`nome.ilike.%${t}%,sku.ilike.%${t}%,imei.ilike.%${t}%`)
    .order("nome")
    .limit(LIMITE);
  return ((data ?? []) as {
    id: string;
    nome: string;
    tipo: TipoItem;
    sku: string | null;
    imei: string | null;
    quantidade: number;
    preco_centavos: number;
  }[]).map((i) => ({
    id: i.id,
    nome: i.nome,
    tipo: i.tipo,
    sku: i.sku,
    quantidade: i.quantidade,
    preco_centavos: i.preco_centavos,
    apoio: [
      ROTULO_TIPO_ITEM[i.tipo],
      i.sku ? `SKU ${i.sku}` : i.imei ? `IMEI ${i.imei}` : null,
      `${i.quantidade.toLocaleString("pt-BR")} em estoque`,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
}
