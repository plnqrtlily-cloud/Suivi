// Squelette affiché dès qu'on touche un onglet ou un lien, le temps que la
// page arrive : la navigation répond tout de suite au lieu de rester figée.
export function PageSkeleton({ wide = false }: { wide?: boolean }) {
  const block = "animate-pulse rounded-2xl bg-white/80";
  return (
    <div className="min-h-screen bg-[#f2f4f3]" aria-busy="true" aria-label="Chargement">
      <div className="h-[61px] border-b border-line bg-white" />
      <div className={`mx-auto flex flex-col gap-3 px-4 pt-6 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="h-4 w-32 animate-pulse rounded bg-white/80" />
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/80" />
        <div className={`${block} mt-3 h-14`} />
        <div className={`${block} h-16`} />
        <div className={`${block} h-48`} />
        <div className={`${block} h-20`} />
      </div>
    </div>
  );
}
