'use client';

import { useMemo, useState } from 'react';
import type { HistoricoEntry } from '@/lib/historico';

type Props = {
  historico: HistoricoEntry[];
  atualizadoEm: string | null;
};

const PAGE_SIZE = 20;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

export function DashboardHome({ historico, atualizadoEm }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(historico.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return historico.slice(start, start + PAGE_SIZE);
  }, [historico, safePage]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-embrapa-ink">Painel</h2>
        <p className="mt-1 text-sm text-gray-600">
          Selecione uma área à esquerda para ver o ranking detalhado, ou acompanhe abaixo o histórico das novas convocações registradas no Looker.
        </p>
      </div>

      <section className="rounded-xl ring-1 ring-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-embrapa-ink">Últimas novidades</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {historico.length > 0
                ? <>Histórico completo de novos convocados detectados no Looker.</>
                : <>Nenhuma convocação registrada ainda.</>
              }
            </p>
          </div>
          {historico.length > 0 && (
            <span className="pill bg-embrapa-green-light text-embrapa-green-dark text-xs">
              {historico.length} {historico.length === 1 ? 'convocação' : 'convocações'}
            </span>
          )}
        </header>

        <div className="px-5 py-4">
          {historico.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma novidade registrada até o momento.
              {atualizadoEm && (
                <> Última sincronização: <span className="font-mono">{fmtDateTime(atualizadoEm)}</span>.</>
              )}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {pageItems.map(n => (
                  <li key={n.id} className="flex items-start gap-3 py-3">
                    <NovidadeBadge />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-medium text-embrapa-ink">{n.nome}</div>
                        <div className="text-xs text-gray-400 font-mono shrink-0" title={n.detectedAtLabel}>
                          {fmtDateOnly(n.detectedAt)}
                        </div>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {n.opcao && <span className="font-mono">opção {n.opcao}</span>}
                        {n.colocacao && <> · {n.colocacao}</>}
                        {n.cargo && <> · {n.cargo}</>}
                        <> · <span className="font-medium text-embrapa-ink">{n.status}</span></>
                      </div>
                      {(n.subarea || n.unidade) && (
                        <div className="mt-0.5 text-xs text-gray-400">
                          {n.subarea}{n.subarea && n.unidade && ' · '}{n.unidade}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav className="mt-4 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-embrapa-blue transition hover:bg-embrapa-blue-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs text-gray-500">
                    Página <span className="font-mono">{safePage}</span> de <span className="font-mono">{totalPages}</span>
                    <span className="ml-2 text-gray-400">({historico.length} no total)</span>
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-embrapa-blue transition hover:bg-embrapa-blue-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima →
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function NovidadeBadge() {
  return (
    <span className="pill bg-embrapa-green-light text-embrapa-green-dark shrink-0">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      Novo
    </span>
  );
}
