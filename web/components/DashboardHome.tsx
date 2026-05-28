'use client';

import { useMemo, useState } from 'react';
import type { HistoricoEntry } from '@/lib/snapshot';

type Props = {
  historico: HistoricoEntry[];
  kvAtivo: boolean;
  atualizadoEm: string | null;
};

const PAGE_SIZE = 20;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

export function DashboardHome({ historico, kvAtivo, atualizadoEm }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(historico.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return historico.slice(start, start + PAGE_SIZE);
  }, [historico, safePage]);

  const novos = historico.filter(n => n.tipo === 'novo').length;
  const statusMudou = historico.filter(n => n.tipo === 'status').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-embrapa-ink">Painel</h2>
        <p className="mt-1 text-sm text-gray-600">
          Selecione uma área à esquerda para ver o ranking detalhado, ou acompanhe abaixo o histórico das novidades sincronizadas com o Looker.
        </p>
      </div>

      <section className="rounded-xl ring-1 ring-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-embrapa-ink">Últimas novidades</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {kvAtivo
                ? historico.length > 0
                  ? <>Histórico das últimas {historico.length} mudanças detectadas em sincronizações com o Looker.</>
                  : <>Capturando primeira referência — novidades aparecerão a partir da próxima sincronização.</>
                : <>Histórico não disponível: o Vercel KV não está configurado.</>
              }
            </p>
          </div>
          {historico.length > 0 && (
            <div className="flex gap-2 text-xs">
              {novos > 0 && (
                <span className="pill bg-embrapa-green-light text-embrapa-green-dark">
                  {novos} {novos === 1 ? 'novo' : 'novos'}
                </span>
              )}
              {statusMudou > 0 && (
                <span className="pill bg-embrapa-blue-light text-embrapa-blue">
                  {statusMudou} {statusMudou === 1 ? 'mudança' : 'mudanças'} de status
                </span>
              )}
            </div>
          )}
        </header>

        <div className="px-5 py-4">
          {!kvAtivo ? (
            <KvSetupCallout />
          ) : historico.length === 0 ? (
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
                    <NovidadeBadge tipo={n.tipo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-medium text-embrapa-ink">{n.nome}</div>
                        <div className="text-xs text-gray-400 font-mono shrink-0" title={fmtDateTime(n.detectedAt)}>
                          {fmtDateOnly(n.detectedAt)}
                        </div>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {n.opcao && <span className="font-mono">opção {n.opcao}</span>}
                        {n.tipo === 'novo' && n.colocacao && <> · {n.colocacao}</>}
                        {n.tipo === 'novo' && n.status && <> · <span className="font-medium text-embrapa-ink">{n.status}</span></>}
                        {n.tipo === 'status' && (
                          <> · <span className="text-gray-400 line-through">{n.statusAnterior ?? '—'}</span>
                            <span className="mx-1 text-gray-400">→</span>
                            <span className="font-medium text-embrapa-ink">{n.statusAtual ?? '—'}</span>
                          </>
                        )}
                      </div>
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

function NovidadeBadge({ tipo }: { tipo: 'novo' | 'status' }) {
  if (tipo === 'novo') {
    return (
      <span className="pill bg-embrapa-green-light text-embrapa-green-dark shrink-0">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
        Novo
      </span>
    );
  }
  return (
    <span className="pill bg-embrapa-blue-light text-embrapa-blue shrink-0">
      Status
    </span>
  );
}

function KvSetupCallout() {
  return (
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-medium text-amber-900">
        Histórico desativado — Vercel KV não configurado.
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Para acompanhar quem foi convocado a cada sincronização, conecte um banco
        Vercel KV ao projeto (Storage → Create Database → KV) e redeploy. As env vars
        <span className="mx-1 font-mono">KV_REST_API_URL</span> e
        <span className="mx-1 font-mono">KV_REST_API_TOKEN</span> serão criadas automaticamente.
      </p>
    </div>
  );
}
