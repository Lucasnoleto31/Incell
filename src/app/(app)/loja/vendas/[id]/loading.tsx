export default function CarregandoVenda() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando a venda"
      className="@container px-2 pt-2 pb-6 md:px-3 md:pt-3 lg:pt-3"
    >
      <div className="max-w-[1120px] motion-safe:animate-pulse">
        <div className="h-[24px] w-[80px] rounded-chip bg-cartao" />
        <div className="mt-2 h-[34px] w-[160px] rounded-chip bg-cartao" />
        <div className="mt-1 h-[16px] w-[240px] rounded-chip bg-cartao" />
        <div className="mt-3 grid gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:gap-3">
          <div className="flex flex-col gap-4">
            <div className="h-[200px] rounded-painel bg-cartao" />
            <div className="h-[200px] rounded-painel bg-cartao" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-[120px] rounded-painel bg-cartao" />
            <div className="h-[160px] rounded-painel bg-cartao" />
          </div>
        </div>
      </div>
    </div>
  );
}
