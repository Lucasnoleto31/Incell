export default function CarregandoItem() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando o item"
      className="@container px-2 pt-2 pb-6 md:px-3 md:pt-3 lg:pt-3"
    >
      <div className="max-w-[1120px] motion-safe:animate-pulse">
        <div className="h-[24px] w-[96px] rounded-chip bg-cartao" />
        <div className="mt-2 h-[34px] w-[280px] rounded-chip bg-cartao" />
        <div className="mt-1 h-[16px] w-[200px] rounded-chip bg-cartao" />
        <div className="mt-3 grid gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @4xl:gap-3">
          <div className="flex flex-col gap-4">
            <div className="h-[96px] rounded-painel bg-cartao" />
            <div className="h-[280px] rounded-painel bg-cartao" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-[200px] rounded-painel bg-cartao" />
            <div className="h-[240px] rounded-painel bg-cartao" />
          </div>
        </div>
      </div>
    </div>
  );
}
