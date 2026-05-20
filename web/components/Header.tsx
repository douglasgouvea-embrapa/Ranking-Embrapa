export function Header({ convocadosCount, atualizadoEm }: { convocadosCount: number; atualizadoEm: string | null }) {
  const dataFormatada = atualizadoEm
    ? new Date(atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
    : '—';

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-embrapa-blue via-embrapa-blue-dark to-embrapa-green text-white">
      <div className="absolute inset-0 opacity-10" aria-hidden="true">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-12 md:py-16">
        <div className="flex items-center gap-3 text-sm font-medium text-emerald-200">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          Concurso Embrapa · Edital 2024
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          Acompanhamento de Convocações
        </h1>
        <p className="mt-3 max-w-2xl text-base text-blue-100 md:text-lg">
          Consulte a classificação dos aprovados em cada cargo e o status de convocação,
          atualizado a partir da fonte oficial.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <div className="rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
            <span className="font-semibold">{convocadosCount}</span> convocados registrados
          </div>
          <div className="rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm ring-1 ring-white/20">
            Atualizado em <span className="font-semibold">{dataFormatada}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
