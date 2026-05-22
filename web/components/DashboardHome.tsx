'use client';

import { useMemo, useState } from 'react';
import { normalizeName } from '@/lib/normalize';
import type { Novidade } from '@/lib/snapshot';
import type { ProximoConvocado } from '@/lib/dashboard';

type Props = {
  novidades: Novidade[];
  snapshotAnterior: { fetchedAt: string; total: number } | null;
  proximos: ProximoConvocado[];
  kvAtivo: boolean;
  atualizadoEm: string | null;
  total: number;
  onSelectOpcao: (cargoGroup: string, opcao: string) => void;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

export function DashboardHome({
  novidades, snapshotAnterior, proximos, kvAtivo, atualizadoEm, total, onSelectOpcao,
}: Props) {
  const [busca, setBusca] = useState('');
  const [apenasEmAndamento, setApenasEmAndamento] = useState(false);

  const novos = novidades.filter(n => n.tipo === 'novo');
  const statusMudou = novidades.filter(n => n.tipo === 'status');

  const proximosFiltrados = useMemo(() => {
    const q = normalizeName(busca);
    let list = proximos;
    if (apenasEmAndamento) list = list.filter(p => p.emAndamento > 0);
    if (q) {
      list = list.filter(p =>
        normalizeName(`${p.area} ${p.subarea} ${p.cargo} ${p.opcao} ${p.proximoNome}`).includes(q),
      );
    }
    return list;
  }, [proximos, busca, apenasEmAndamento]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-embrapa-ink">Painel</h2>
        <p className="mt-1 text-sm text-gray-600">
          Selecione uma área à esquerda para ver o ranking detalhado, ou acompanhe abaixo as novidades e quem está prestes a ser convocado.
        </p>
      </div>

      {/* Card: Últimas novidades */}
      <section className="rounded-xl ring-1 ring-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-embrapa-ink">Últimas novidades</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {snapshotAnterior
                ? <>Desde a sincronização anterior em <span className="font-mono">{fmtDate(snapshotAnterior.fetchedAt)}</span></>
                : kvAtivo
                  ? <>Capturando primeira referência — novidades aparecerão a partir da próxima sincronização.</>
                  : <>Histórico não disponível: o Vercel KV não está configurado.</>
              }
            </p>
          </div>
          {novidades.length > 0 && (
            <div className="flex gap-2 text-xs">
              {novos.length > 0 && (
                <span className="pill bg-embrapa-green-light text-embrapa-green-dark">
                  {novos.length} {novos.length === 1 ? 'novo' : 'novos'}
                </span>
              )}
              {statusMudou.length > 0 && (
                <span className="pill bg-embrapa-blue-light text-embrapa-blue">
                  {statusMudou.length} {statusMudou.length === 1 ? 'mudança' : 'mudanças'} de status
                </span>
              )}
            </div>
          )}
        </header>

        <div className="px-5 py-4">
          {!kvAtivo ? (
            <KvSetupCallout />
          ) : novidades.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma mudança desde a última sincronização.
              {atualizadoEm && (
                <> Atualizado em <span className="font-mono">{fmtDate(atualizadoEm)}</span>.</>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {novidades.slice(0, 20).map((n, i) => (
                <li key={i} className="flex items-start gap-3 py-3">
                  <NovidadeBadge tipo={n.tipo} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-embrapa-ink">{n.nome}</div>
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
          )}
          {novidades.length > 20 && (
            <p className="mt-2 text-xs text-gray-400">
              Mostrando 20 de {novidades.length} mudanças.
            </p>
          )}
        </div>
      </section>

      {/* Card: Próximos da fila */}
      <section className="rounded-xl ring-1 ring-gray-200 bg-white">
        <header className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-embrapa-ink">Próximos da fila</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Primeiro aprovado aguardando convocação em cada opção que já teve movimentação.
                {total > 0 && <> {proximos.length} opções listadas.</>}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={apenasEmAndamento}
                onChange={e => setApenasEmAndamento(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-embrapa-green focus:ring-embrapa-green/40"
              />
              Apenas com convocação em andamento
            </label>
          </div>
          <input
            type="search"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por área, cargo, opção ou nome do próximo..."
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-embrapa-green focus:outline-none focus:ring-2 focus:ring-embrapa-green/20"
          />
        </header>

        <div className="max-h-[600px] overflow-y-auto">
          {proximosFiltrados.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              {proximos.length === 0
                ? 'Nenhuma opção com convocação registrada ainda.'
                : 'Nenhum resultado para o filtro.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {proximosFiltrados.map(p => (
                <li key={p.opcao}>
                  <button
                    onClick={() => onSelectOpcao(p.cargoGroup, p.opcao)}
                    className="group w-full px-5 py-3 text-left transition hover:bg-embrapa-blue-light/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-mono text-embrapa-blue/70">
                          {p.opcao} · {p.cargo}
                        </div>
                        <div className="mt-0.5 font-medium text-embrapa-ink group-hover:text-embrapa-blue">
                          {p.area}
                        </div>
                        {p.subarea && <div className="text-xs text-gray-500">{p.subarea}</div>}
                        <div className="mt-2 flex items-baseline gap-2 text-sm">
                          <span className="text-xs text-gray-400">aguardando:</span>
                          <span className="font-mono text-xs text-embrapa-blue">{p.proximaPosicao}º</span>
                          <SlotMini slot={p.slotEfetivo} cota={p.cotaCount} />
                          <span className="truncate font-medium text-embrapa-ink">{p.proximoNome}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                        {p.emAndamento > 0 && (
                          <span className="pill bg-yellow-50 text-yellow-700">
                            {p.emAndamento} em andamento
                          </span>
                        )}
                        {p.contratados > 0 && (
                          <span className="pill bg-embrapa-green-light text-embrapa-green-dark">
                            {p.contratados} contratado{p.contratados > 1 ? 's' : ''}
                          </span>
                        )}
                        {p.desistencias > 0 && (
                          <span className="pill bg-red-50 text-red-600">
                            {p.desistencias} desist./desclass.
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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

function SlotMini({ slot, cota }: { slot: 'AC' | 'PPP' | 'PCD'; cota: number }) {
  const cls = slot === 'AC'
    ? 'bg-embrapa-blue-light text-embrapa-blue'
    : slot === 'PPP'
      ? 'bg-embrapa-green-light text-embrapa-green-dark'
      : 'bg-orange-50 text-orange-700';
  return (
    <span className={`pill ${cls}`}>
      {cota}º {slot === 'PCD' ? 'PcD' : slot}
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
