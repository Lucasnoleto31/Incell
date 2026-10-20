import { Search } from "lucide-react";
import { CAMPO } from "@/components/app/form-styles";
import { cn } from "@/lib/utils";

/**
 * A busca das listas da Loja: formulário GET que leva o termo na URL
 * (?busca=), com os outros filtros da tela em campos escondidos. Sem
 * JavaScript funciona igual; a lista é do servidor.
 */
export function BuscaLista({
  acao,
  valor,
  ocultos = {},
  placeholder,
  className,
}: {
  acao: string;
  valor: string;
  ocultos?: Record<string, string>;
  placeholder: string;
  className?: string;
}) {
  return (
    <form action={acao} method="get" role="search" className={cn("relative", className)}>
      {Object.entries(ocultos).map(([nome, v]) => (
        <input key={nome} type="hidden" name={nome} value={v} />
      ))}
      <label htmlFor="busca" className="sr-only">
        Buscar
      </label>
      <Search
        size={18}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1.5 -translate-y-1/2 text-texto-3"
      />
      <input
        id="busca"
        name="busca"
        type="search"
        defaultValue={valor}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(CAMPO, "w-full pl-[40px] @3xl:w-[320px]")}
      />
    </form>
  );
}
