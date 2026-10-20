/**
 * O vocabulário da Loja (ordens de serviço, estoque e vendas), num lugar só.
 * Arquivo puro (sem servidor e sem "use client"): as páginas, as actions, a
 * casca e a paleta leem daqui. Os valores gravados no banco são os dos enums
 * da migração 0070; o rótulo é o que a tela mostra.
 */

export const CAMINHO_LOJA = "/loja";
export const CAMINHO_ORDENS = `${CAMINHO_LOJA}/ordens`;
export const CAMINHO_ESTOQUE = `${CAMINHO_LOJA}/estoque`;
export const CAMINHO_VENDAS = `${CAMINHO_LOJA}/vendas`;

/* ── Ordens de serviço ─────────────────────────────────────────────────── */

export const STATUS_OS = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "em_reparo",
  "aguardando_peca",
  "pronta",
  "entregue",
  "cancelada",
] as const;

export type StatusOs = (typeof STATUS_OS)[number];

export function ehStatusOs(valor: unknown): valor is StatusOs {
  return typeof valor === "string" && (STATUS_OS as readonly string[]).includes(valor);
}

export const ROTULO_STATUS_OS: Record<StatusOs, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  em_reparo: "Em reparo",
  aguardando_peca: "Aguardando peça",
  pronta: "Pronta",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

/** O tom da etiqueta de status: a cor só na palavra, nunca no fundo. */
export const TOM_STATUS_OS: Record<
  StatusOs,
  "neutro" | "tinta" | "bom" | "atencao" | "erro"
> = {
  aberta: "tinta",
  em_analise: "neutro",
  aguardando_aprovacao: "atencao",
  em_reparo: "neutro",
  aguardando_peca: "atencao",
  pronta: "bom",
  entregue: "neutro",
  cancelada: "erro",
};

/** OS que ainda está na bancada (nem entregue, nem cancelada). */
export const STATUS_OS_ABERTOS: readonly StatusOs[] = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "em_reparo",
  "aguardando_peca",
  "pronta",
];

export function osEmAberto(status: StatusOs): boolean {
  return STATUS_OS_ABERTOS.includes(status);
}

/**
 * Para onde cada status pode ir. A bancada não é um funil rígido (uma OS
 * pronta pode voltar ao reparo se o cliente reclamar na retirada), mas a
 * entregue e a cancelada são finais: dali só a gestão reabre.
 */
export const PROXIMOS_STATUS_OS: Record<StatusOs, readonly StatusOs[]> = {
  aberta: ["em_analise", "aguardando_aprovacao", "em_reparo", "cancelada"],
  em_analise: ["aguardando_aprovacao", "em_reparo", "aguardando_peca", "cancelada"],
  aguardando_aprovacao: ["em_reparo", "aguardando_peca", "cancelada"],
  em_reparo: ["aguardando_peca", "pronta", "aguardando_aprovacao", "cancelada"],
  aguardando_peca: ["em_reparo", "pronta", "cancelada"],
  pronta: ["entregue", "em_reparo"],
  entregue: [],
  cancelada: [],
};

/** As visões da lista de OS: o filtro da URL (?ver=). */
export const VISOES_OS = ["abertas", "prontas", "entregues", "canceladas", "todas"] as const;
export type VisaoOs = (typeof VISOES_OS)[number];

export const ROTULO_VISAO_OS: Record<VisaoOs, string> = {
  abertas: "Na bancada",
  prontas: "Prontas",
  entregues: "Entregues",
  canceladas: "Canceladas",
  todas: "Todas",
};

export function lerVisaoOs(valor: unknown): VisaoOs {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return (VISOES_OS as readonly string[]).includes(String(bruto))
    ? (bruto as VisaoOs)
    : "abertas";
}

/** Os status que cada visão mostra. */
export function statusDaVisaoOs(visao: VisaoOs): readonly StatusOs[] | null {
  switch (visao) {
    case "abertas":
      return STATUS_OS_ABERTOS.filter((s) => s !== "pronta");
    case "prontas":
      return ["pronta"];
    case "entregues":
      return ["entregue"];
    case "canceladas":
      return ["cancelada"];
    case "todas":
      return null;
  }
}

/** "OS 42", com o número no formato brasileiro. */
export function numeroOs(numero: number): string {
  return `OS ${numero.toLocaleString("pt-BR")}`;
}

/* ── Estoque ───────────────────────────────────────────────────────────── */

export const TIPOS_ITEM = ["aparelho", "peca", "acessorio"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

export function ehTipoItem(valor: unknown): valor is TipoItem {
  return typeof valor === "string" && (TIPOS_ITEM as readonly string[]).includes(valor);
}

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  aparelho: "Aparelho",
  peca: "Peça",
  acessorio: "Acessório",
};

export const ROTULO_TIPO_ITEM_PLURAL: Record<TipoItem, string> = {
  aparelho: "Aparelhos",
  peca: "Peças",
  acessorio: "Acessórios",
};

export const CONDICOES = ["novo", "seminovo", "recondicionado"] as const;
export type Condicao = (typeof CONDICOES)[number];

export function ehCondicao(valor: unknown): valor is Condicao {
  return typeof valor === "string" && (CONDICOES as readonly string[]).includes(valor);
}

export const ROTULO_CONDICAO: Record<Condicao, string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  recondicionado: "Recondicionado",
};

export const TIPOS_MOVIMENTO = ["entrada", "saida", "ajuste"] as const;
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number];

export function ehTipoMovimento(valor: unknown): valor is TipoMovimento {
  return (
    typeof valor === "string" &&
    (TIPOS_MOVIMENTO as readonly string[]).includes(valor)
  );
}

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

/** De onde veio o movimento, como a ficha do item mostra. */
export const ROTULO_ORIGEM_MOVIMENTO: Record<string, string> = {
  manual: "Lançamento manual",
  compra: "Compra",
  venda: "Venda",
  os: "Ordem de serviço",
  devolucao: "Devolução",
  inventario: "Inventário",
  estorno: "Estorno",
};

/** O filtro da lista de estoque (?tipo=). */
export function lerTipoItem(valor: unknown): TipoItem | null {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return ehTipoItem(bruto) ? bruto : null;
}

/* ── Vendas ────────────────────────────────────────────────────────────── */

export const STATUS_VENDA = ["aberta", "concluida", "cancelada"] as const;
export type StatusVenda = (typeof STATUS_VENDA)[number];

export const ROTULO_STATUS_VENDA: Record<StatusVenda, string> = {
  aberta: "Em aberto",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const TOM_STATUS_VENDA: Record<StatusVenda, "tinta" | "bom" | "erro"> = {
  aberta: "tinta",
  concluida: "bom",
  cancelada: "erro",
};

export const VISOES_VENDA = ["todas", "abertas", "concluidas", "canceladas"] as const;
export type VisaoVenda = (typeof VISOES_VENDA)[number];

export const ROTULO_VISAO_VENDA: Record<VisaoVenda, string> = {
  todas: "Todas",
  abertas: "Em aberto",
  concluidas: "Concluídas",
  canceladas: "Canceladas",
};

export function lerVisaoVenda(valor: unknown): VisaoVenda {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return (VISOES_VENDA as readonly string[]).includes(String(bruto))
    ? (bruto as VisaoVenda)
    : "todas";
}

export function statusDaVisaoVenda(visao: VisaoVenda): StatusVenda | null {
  switch (visao) {
    case "abertas":
      return "aberta";
    case "concluidas":
      return "concluida";
    case "canceladas":
      return "cancelada";
    case "todas":
      return null;
  }
}

export const FORMAS_PAGAMENTO = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "outro",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export function ehFormaPagamento(valor: unknown): valor is FormaPagamento {
  return (
    typeof valor === "string" &&
    (FORMAS_PAGAMENTO as readonly string[]).includes(valor)
  );
}

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  outro: "Outro",
};

/** "Venda 42". */
export function numeroVenda(numero: number): string {
  return `Venda ${numero.toLocaleString("pt-BR")}`;
}

/* ── Dinheiro ──────────────────────────────────────────────────────────── */

/**
 * O que a pessoa digita num campo de valor ("1.234,56", "1234,56", "1234.56",
 * "R$ 350") em centavos. null quando não é número. Aceita os dois
 * separadores: no celular o teclado numérico às vezes só tem o ponto.
 */
export function lerCentavos(texto: unknown): number | null {
  if (typeof texto !== "string") return null;
  let t = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (!/^[\d.,]+$/.test(t)) return null;
  const virgula = t.lastIndexOf(",");
  const ponto = t.lastIndexOf(".");
  if (virgula >= 0 && ponto >= 0) {
    // Os dois: o último é o decimal, o outro é milhar.
    t = virgula > ponto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgula >= 0) {
    t = t.replace(",", ".");
  } else if (ponto >= 0) {
    // Só ponto: "1.234" e "1.234.567" são milhar; "12.5" e "1234.56",
    // decimal.
    const pontos = (t.match(/\./g) ?? []).length;
    const depois = t.length - ponto - 1;
    if (pontos > 1 || depois === 3) t = t.replace(/\./g, "");
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Centavos como a pessoa digitaria: 123456 → "1.234,56". Vazio para 0
 *  quando `vazioSeZero`. */
export function centavosParaCampo(
  centavos: number | null | undefined,
  vazioSeZero = false,
): string {
  if (centavos === null || centavos === undefined) return "";
  if (vazioSeZero && centavos === 0) return "";
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Um inteiro positivo de um campo ("2"), ou null. */
export function lerInteiro(texto: unknown, minimo = 0): number | null {
  if (typeof texto !== "string") return null;
  const t = texto.trim();
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= minimo ? n : null;
}

/** Um uuid com cara de uuid; o resto vira null antes de ir à consulta. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function lerUuid(valor: unknown): string | null {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return typeof bruto === "string" && UUID.test(bruto) ? bruto : null;
}
