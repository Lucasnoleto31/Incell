import { Button } from "@/components/ui/button";
import { CAMINHO_ESTOQUE } from "@/lib/loja";
import { LinkVoltarAdmin } from "../../../admin/subpagina";

export default function ItemNaoEncontrado() {
  return (
    <div className="px-2 pt-2 pb-6 md:px-3 md:pt-3 lg:pt-3">
      <div className="mb-1.5">
        <LinkVoltarAdmin href={CAMINHO_ESTOQUE} rotulo="Estoque" />
      </div>
      <div className="max-w-[68ch] rounded-painel bg-cartao p-2.5">
        <h1 className="tipo-titulo-3 text-tinta">Item não encontrado</h1>
        <p className="mt-0.5 tipo-corpo text-texto-2">
          O link pode estar errado ou o item pode ter sido apagado.
        </p>
        <Button href={CAMINHO_ESTOQUE} variant="secondary" size="sm" className="mt-1.5">
          Ir para o estoque
        </Button>
      </div>
    </div>
  );
}
