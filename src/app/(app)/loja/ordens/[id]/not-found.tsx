import { Button } from "@/components/ui/button";
import { CAMINHO_ORDENS } from "@/lib/loja";
import { LinkVoltarAdmin } from "../../../admin/subpagina";

/** OS que não abre: id errado, apagada ou fora do que a pessoa vê. */
export default function OrdemNaoEncontrada() {
  return (
    <div className="px-2 pt-2 pb-6 md:px-3 md:pt-3 lg:pt-3">
      <div className="mb-1.5">
        <LinkVoltarAdmin href={CAMINHO_ORDENS} rotulo="Ordens de serviço" />
      </div>
      <div className="max-w-[68ch] rounded-painel bg-cartao p-2.5">
        <h1 className="tipo-titulo-3 text-tinta">Ordem de serviço não encontrada</h1>
        <p className="mt-0.5 tipo-corpo text-texto-2">
          O link pode estar errado ou a OS pode ter sido apagada.
        </p>
        <Button href={CAMINHO_ORDENS} variant="secondary" size="sm" className="mt-1.5">
          Ir para as ordens de serviço
        </Button>
      </div>
    </div>
  );
}
