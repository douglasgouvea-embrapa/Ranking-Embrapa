import type { Vagas } from '@/lib/types';

type Props = {
  vagas: Vagas | null;
  chamados: { ac: number; ppp: number; pcd: number };
};

const COTAS: { key: 'ac' | 'ppp' | 'pcd'; label: string; barClass: string; trackClass: string; numClass: string }[] = [
  {
    key: 'ac',
    label: 'Ampla Concorrência',
    barClass: 'bg-embrapa-blue',
    trackClass: 'bg-embrapa-blue/10',
    numClass: 'text-embrapa-blue',
  },
  {
    key: 'ppp',
    label: 'Pretos e Pardos',
    barClass: 'bg-embrapa-green',
    trackClass: 'bg-embrapa-green/10',
    numClass: 'text-embrapa-green-dark',
  },
  {
    key: 'pcd',
    label: 'Pessoas com Deficiência',
    barClass: 'bg-orange-500',
    trackClass: 'bg-orange-100',
    numClass: 'text-orange-600',
  },
];

export function VagasChart({ vagas, chamados }: Props) {
  if (!vagas) return null;

  const totalVagas = vagas.total;
  const totalChamados = chamados.ac + chamados.ppp + chamados.pcd;

  return (
    <section className="mb-6 rounded-2xl border border-embrapa-blue/10 bg-gradient-to-br from-white to-embrapa-blue-light/30 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-embrapa-blue/70">
            Vagas e convocações
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Cota oficial do edital × convocações registradas no Looker
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-embrapa-ink">
            {totalChamados}<span className="text-gray-400">/{totalVagas}</span>
          </div>
          <div className="text-xs text-gray-500">total</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {COTAS.map(cota => {
          const total = vagas[cota.key];
          const feitos = chamados[cota.key];
          const pct = total > 0 ? Math.min(100, (feitos / total) * 100) : 0;
          const excedeu = feitos > total;

          return (
            <div key={cota.key} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {cota.label}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${cota.numClass}`}>{feitos}</span>
                <span className="text-sm text-gray-400">/ {total} {total === 1 ? 'vaga' : 'vagas'}</span>
              </div>
              <div className={`mt-3 h-2 overflow-hidden rounded-full ${cota.trackClass}`}>
                {total > 0 && (
                  <div
                    className={`h-full ${cota.barClass} transition-all`}
                    style={{ width: `${pct}%` }}
                    aria-label={`${pct.toFixed(0)}% preenchido`}
                  />
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
                <span>{total > 0 ? `${pct.toFixed(0)}%` : '—'}</span>
                {excedeu && (
                  <span className="font-semibold text-orange-600" title="Convocações acima do número de vagas — cadastro de reserva em uso">
                    +{feitos - total} reserva
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
