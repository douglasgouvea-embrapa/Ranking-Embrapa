'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { normalizeName } from '@/lib/normalize';
import { matchChamadasComConvocados } from '@/lib/match';
import type { OpcaoComChamadas, ConvocadoRecord, SlotType } from '@/lib/types';
import type { Novidade } from '@/lib/snapshot';
import type { ProximoConvocado } from '@/lib/dashboard';
import { VagasChart } from './VagasChart';
import { DashboardHome } from './DashboardHome';

export type OpcaoSummary = {
  opcao: string;
  cargo: string;
  area: string;
  subarea: string;
  totalGeral: number;
  totalPcd: number;
  totalPpp: number;
};

type Props = {
  groups: { id: string; label: string; opcoes: OpcaoSummary[] }[];
};

export function Explorer({ groups }: Props) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [opcaoId, setOpcaoId] = useState<string>('');
  const [searchOpcao, setSearchOpcao] = useState('');
  const [searchNome, setSearchNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | SlotType>('todos');

  const [convocadosPorOpcao, setConvocadosPorOpcao] = useState<Map<string, ConvocadoRecord[]>>(new Map());
  const [convocadosLoading, setConvocadosLoading] = useState(true);
  const [convocadosTotal, setConvocadosTotal] = useState(0);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [novidades, setNovidades] = useState<Novidade[]>([]);
  const [snapshotAnterior, setSnapshotAnterior] = useState<{ fetchedAt: string; total: number } | null>(null);
  const [proximos, setProximos] = useState<ProximoConvocado[]>([]);
  const [kvAtivo, setKvAtivo] = useState(true);

  const [opcaoData, setOpcaoData] = useState<OpcaoComChamadas | null>(null);
  const [opcaoLoading, setOpcaoLoading] = useState(false);

  const loadConvocados = useCallback(async (force = false) => {
    setConvocadosLoading(true);
    setSyncError(null);
    try {
      const url = force ? '/api/convocados?force=1' : '/api/convocados';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json() as {
        convocados: ConvocadoRecord[];
        total: number;
        atualizadoEm: string;
        novidades?: Novidade[];
        snapshotAnterior?: { fetchedAt: string; total: number } | null;
        proximos?: ProximoConvocado[];
        kvAtivo?: boolean;
      };
      const byOpcao = new Map<string, ConvocadoRecord[]>();
      for (const c of data.convocados) {
        if (c.opcao) {
          const arr = byOpcao.get(c.opcao) ?? [];
          arr.push(c);
          byOpcao.set(c.opcao, arr);
        }
      }
      setConvocadosPorOpcao(byOpcao);
      setConvocadosTotal(data.total ?? 0);
      setAtualizadoEm(data.atualizadoEm ?? null);
      setNovidades(data.novidades ?? []);
      setSnapshotAnterior(data.snapshotAnterior ?? null);
      setProximos(data.proximos ?? []);
      setKvAtivo(data.kvAtivo ?? false);
    } catch {
      setSyncError('Não foi possível sincronizar com o Looker.');
    } finally {
      setConvocadosLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => { loadConvocados(false); }, [loadConvocados]);

  const handleSync = async () => {
    setSyncing(true);
    await loadConvocados(true);
  };

  useEffect(() => {
    if (!opcaoId) { setOpcaoData(null); return; }
    let abort = false;
    setOpcaoLoading(true);
    setOpcaoData(null);
    setFiltroTipo('todos');
    fetch(`/api/opcao/${groupId}/${opcaoId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: OpcaoComChamadas | null) => { if (!abort) setOpcaoData(data); })
      .catch(() => {})
      .finally(() => { if (!abort) setOpcaoLoading(false); });
    return () => { abort = true; };
  }, [groupId, opcaoId]);

  const currentGroup = groups.find(g => g.id === groupId)!;

  const filteredOpcoes = useMemo(() => {
    const q = normalizeName(searchOpcao);
    if (!q) return currentGroup.opcoes;
    return currentGroup.opcoes.filter(o =>
      normalizeName(`${o.area} ${o.subarea} ${o.cargo} ${o.opcao}`).includes(q),
    );
  }, [currentGroup.opcoes, searchOpcao]);

  // Resolve, para a opção atual, qual convocado corresponde a cada chamada.
  // Match em 2 passadas (exato + fuzzy por posição+nome) — ver lib/match.ts.
  const matchPorInscricao = useMemo(() => {
    if (!opcaoData) return new Map<string, ConvocadoRecord>();
    const convs = convocadosPorOpcao.get(opcaoData.opcao) ?? [];
    return matchChamadasComConvocados(opcaoData.chamadas, convs);
  }, [opcaoData, convocadosPorOpcao]);

  const findConvocado = useCallback(
    (inscricao: string): ConvocadoRecord | undefined => matchPorInscricao.get(inscricao),
    [matchPorInscricao],
  );

  const chamadasFiltradas = useMemo(() => {
    if (!opcaoData) return [];
    const q = normalizeName(searchNome);
    return opcaoData.chamadas.filter(ch => {
      if (filtroTipo !== 'todos' && ch.slotEfetivo !== filtroTipo) return false;
      if (q) {
        return normalizeName(ch.candidato.nome).includes(q) || ch.candidato.inscricao.includes(searchNome);
      }
      return true;
    });
  }, [opcaoData, searchNome, filtroTipo]);

  const stats = useMemo(() => {
    if (!opcaoData) return { contratados: 0, aceitos: 0, desistentes: 0, aguardando: 0 };
    let contratados = 0, aceitos = 0, desistentes = 0, aguardando = 0;
    for (const ch of opcaoData.chamadas) {
      const conv = findConvocado(ch.candidato.inscricao);
      if (!conv) aguardando++;
      else if (conv.status === 'Contratado') contratados++;
      else if (conv.status === 'Aceitou') aceitos++;
      else if (conv.status === 'Desistente') desistentes++;
    }
    return { contratados, aceitos, desistentes, aguardando };
  }, [opcaoData, findConvocado]);

  const contagemPorTipo = useMemo(() => {
    if (!opcaoData) return { AC: 0, PPP: 0, PCD: 0 };
    return opcaoData.chamadas.reduce(
      (acc, ch) => ({ ...acc, [ch.slotEfetivo]: acc[ch.slotEfetivo] + 1 }),
      { AC: 0, PPP: 0, PCD: 0 },
    );
  }, [opcaoData]);

  const chamadosPorCota = useMemo(() => {
    if (!opcaoData) return { ac: 0, ppp: 0, pcd: 0 };
    const lista = convocadosPorOpcao.get(opcaoData.opcao) ?? [];
    const counts = { ac: 0, ppp: 0, pcd: 0 };
    for (const c of lista) {
      // Desistentes, Desclassificados e "Não se manifestou" liberam a vaga — não ocupam posição.
      if (c.status === 'Desistente' || c.status === 'Desclassificado' || c.status === 'Não se manifestou') continue;
      const coloc = c.colocacao?.toUpperCase() ?? '';
      if (coloc.includes('PPP')) counts.ppp++;
      else if (coloc.includes('PCD')) counts.pcd++;
      else if (coloc.includes('AC')) counts.ac++;
    }
    return counts;
  }, [opcaoData, convocadosPorOpcao]);

  const dataFormatada = atualizadoEm
    ? new Date(atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
    : '—';

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Sync bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-black/5">
        <div className="flex items-center gap-3 text-sm">
          <div className={`h-2 w-2 rounded-full ${syncError ? 'bg-red-500' : 'bg-embrapa-green'} ${convocadosLoading ? 'animate-pulse' : ''}`} />
          <div>
            <div className="font-semibold text-embrapa-ink">
              {convocadosTotal} convocações sincronizadas
            </div>
            <div className="text-xs text-gray-500">
              {syncError ? syncError : <>Última sincronização: <span className="font-mono">{dataFormatada}</span></>}
            </div>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-full bg-embrapa-green px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-embrapa-green-dark disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 0 0-14.93-3M4 16a8 8 0 0 0 14.93 3" />
          </svg>
          {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
      </div>

      {/* Cargo selector */}
      <div className="flex flex-wrap gap-2">
        {groups.map(g => {
          const active = g.id === groupId;
          return (
            <button
              key={g.id}
              onClick={() => { setGroupId(g.id); setOpcaoId(''); setSearchOpcao(''); }}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-embrapa-blue text-white shadow-soft'
                  : 'bg-white text-embrapa-blue ring-1 ring-embrapa-blue/15 hover:bg-embrapa-blue-light'
              }`}
            >
              {g.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-embrapa-blue/10'}`}>
                {g.opcoes.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Opção list */}
        <aside className="rounded-2xl bg-white shadow-soft ring-1 ring-black/5">
          <div className="border-b border-gray-100 p-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-embrapa-blue/70">
              Buscar área ou subárea
            </label>
            <input
              type="search"
              value={searchOpcao}
              onChange={e => setSearchOpcao(e.target.value)}
              placeholder="ex. ciência de alimentos, gestão..."
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-embrapa-green focus:outline-none focus:ring-2 focus:ring-embrapa-green/20"
            />
            <p className="mt-2 text-xs text-gray-500">
              {filteredOpcoes.length} de {currentGroup.opcoes.length} opções
            </p>
          </div>
          <ul className="max-h-[600px] overflow-y-auto p-2">
            {filteredOpcoes.map(o => {
              const active = o.opcao === opcaoId;
              return (
                <li key={o.opcao}>
                  <button
                    onClick={() => setOpcaoId(o.opcao)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? 'bg-embrapa-green-light ring-1 ring-embrapa-green'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-embrapa-blue/70">{o.opcao}</span>
                      <span className="text-xs text-gray-400">{o.cargo}</span>
                    </div>
                    <div className="mt-0.5 font-medium text-embrapa-ink">{o.area}</div>
                    {o.subarea && <div className="text-xs text-gray-500">{o.subarea}</div>}
                  </button>
                </li>
              );
            })}
            {filteredOpcoes.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-gray-500">
                Nenhuma opção encontrada.
              </li>
            )}
          </ul>
        </aside>

        {/* Ranking detail */}
        <main className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-black/5">
          {!opcaoId ? (
            <DashboardHome
              novidades={novidades}
              snapshotAnterior={snapshotAnterior}
              proximos={proximos}
              kvAtivo={kvAtivo}
              atualizadoEm={atualizadoEm}
              total={convocadosTotal}
              onSelectOpcao={(grp, op) => {
                setGroupId(grp);
                setOpcaoId(op);
              }}
            />
          ) : opcaoLoading ? (
            <LoadingState />
          ) : !opcaoData ? (
            <ErrorState />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-embrapa-blue/70">
                    OPÇÃO {opcaoData.opcao} · {opcaoData.cargo}
                    <span className="rounded bg-embrapa-blue/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase">
                      Tabela {opcaoData.tabela}
                    </span>
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-embrapa-ink">{opcaoData.area}</h2>
                  {opcaoData.subarea && (
                    <p className="mt-0.5 text-base text-gray-600">{opcaoData.subarea}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {stats.contratados > 0 && (
                      <span className="pill bg-embrapa-green-light text-embrapa-green-dark">
                        {stats.contratados} contratados
                      </span>
                    )}
                    {stats.aceitos > 0 && (
                      <span className="pill bg-embrapa-blue-light text-embrapa-blue">
                        {stats.aceitos} aceitos
                      </span>
                    )}
                    {stats.desistentes > 0 && (
                      <span className="pill bg-red-50 text-red-600">
                        {stats.desistentes} desistentes
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {opcaoData.chamadas.length} na ordem de convocação
                  </span>
                </div>
              </div>

              {/* Vagas chart */}
              <div className="mt-6">
                <VagasChart vagas={opcaoData.vagas} chamados={chamadosPorCota} />
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                <TipoFilterButton
                  active={filtroTipo === 'todos'}
                  onClick={() => setFiltroTipo('todos')}
                  label="Todos"
                  count={opcaoData.chamadas.length}
                />
                <TipoFilterButton
                  active={filtroTipo === 'AC'}
                  onClick={() => setFiltroTipo('AC')}
                  label="Ampla Concorrência"
                  count={contagemPorTipo.AC}
                  color="blue"
                />
                <TipoFilterButton
                  active={filtroTipo === 'PPP'}
                  onClick={() => setFiltroTipo('PPP')}
                  label="Pretos e Pardos"
                  count={contagemPorTipo.PPP}
                  color="green"
                />
                <TipoFilterButton
                  active={filtroTipo === 'PCD'}
                  onClick={() => setFiltroTipo('PCD')}
                  label="PcD"
                  count={contagemPorTipo.PCD}
                  color="orange"
                />
              </div>

              {/* Search */}
              <div className="mt-4">
                <input
                  type="search"
                  value={searchNome}
                  onChange={e => setSearchNome(e.target.value)}
                  placeholder="Buscar por nome ou número de inscrição..."
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-embrapa-green focus:outline-none focus:ring-2 focus:ring-embrapa-green/20"
                />
              </div>

              {/* Table */}
              <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-gray-200">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-embrapa-blue text-white">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">#</th>
                        <th className="px-3 py-3 text-left font-semibold">Vaga</th>
                        <th className="px-3 py-3 text-left font-semibold">Nome</th>
                        <th className="px-3 py-3 text-left font-semibold">Inscrição</th>
                        <th className="px-3 py-3 text-right font-semibold">Nota</th>
                        <th className="px-3 py-3 text-center font-semibold">Status</th>
                        <th className="px-3 py-3 text-left font-semibold">Unidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {chamadasFiltradas.map(ch => {
                        const conv = findConvocado(ch.candidato.inscricao);
                        return (
                          <tr key={ch.posicao} className="transition hover:bg-embrapa-blue-light/40">
                            <td className="px-3 py-3 font-mono font-semibold text-embrapa-blue">{ch.posicao}º</td>
                            <td className="px-3 py-3">
                              <SlotBadge slot={ch.slotEfetivo} cotaCount={ch.cotaCount} fallback={ch.fallback} />
                            </td>
                            <td className="px-3 py-3 font-medium text-embrapa-ink">{ch.candidato.nome}</td>
                            <td className="px-3 py-3 font-mono text-xs text-gray-600">{ch.candidato.inscricao}</td>
                            <td className="px-3 py-3 text-right font-mono">{ch.candidato.nota.toFixed(2)}</td>
                            <td className="px-3 py-3 text-center"><StatusBadge conv={conv} loading={convocadosLoading} /></td>
                            <td className="px-3 py-3 text-xs text-gray-600">
                              {conv?.unidade ? (
                                <>
                                  <div className="font-medium">{conv.unidade}</div>
                                  {conv.lotacao && <div className="text-gray-400">{conv.lotacao}</div>}
                                </>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {chamadasFiltradas.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                            {searchNome ? 'Nenhum candidato encontrado para a busca.' : 'Nenhuma chamada nesta categoria.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TipoFilterButton({
  active, onClick, label, count, color,
}: {
  active: boolean; onClick: () => void; label: string; count: number;
  color?: 'blue' | 'green' | 'orange';
}) {
  const colorClasses = {
    blue: 'data-[active=true]:bg-embrapa-blue data-[active=true]:text-white text-embrapa-blue',
    green: 'data-[active=true]:bg-embrapa-green data-[active=true]:text-white text-embrapa-green-dark',
    orange: 'data-[active=true]:bg-orange-500 data-[active=true]:text-white text-orange-600',
  }[color ?? 'blue'];

  return (
    <button
      data-active={active}
      onClick={onClick}
      disabled={count === 0}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        color ? colorClasses : active ? 'bg-embrapa-ink text-white' : 'text-gray-600'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-black/10'}`}>{count}</span>
    </button>
  );
}

function SlotBadge({ slot, cotaCount, fallback }: { slot: SlotType; cotaCount: number; fallback: boolean }) {
  const styles: Record<SlotType, string> = {
    AC: 'bg-embrapa-blue-light text-embrapa-blue',
    PPP: 'bg-embrapa-green-light text-embrapa-green-dark',
    PCD: 'bg-orange-50 text-orange-700',
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`pill ${styles[slot]}`}>
        {cotaCount}º {slot === 'PCD' ? 'PcD' : slot}
      </span>
      {fallback && (
        <span
          title="Cota original esgotada — vaga reverteu para AC"
          className="text-xs text-gray-400"
        >
          ↺
        </span>
      )}
    </span>
  );
}

function StatusBadge({ conv, loading }: { conv: ConvocadoRecord | undefined; loading: boolean }) {
  if (loading) return <span className="pill bg-gray-100 text-gray-400">Carregando...</span>;
  if (!conv) return <span className="pill bg-gray-100 text-gray-500">Aguardando</span>;
  switch (conv.status) {
    case 'Contratado':
      return (
        <span className="pill bg-embrapa-green-light text-embrapa-green-dark">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" /></svg>
          Contratado
        </span>
      );
    case 'Aceitou':
      return <span className="pill bg-embrapa-blue-light text-embrapa-blue">Aceitou</span>;
    case 'Convocado':
      return <span className="pill bg-yellow-50 text-yellow-700">Convocado</span>;
    case 'Não se manifestou':
      return <span className="pill bg-orange-50 text-orange-700">Não se manifestou</span>;
    case 'Desistente':
      return <span className="pill bg-red-50 text-red-600">Desistente</span>;
    case 'Desclassificado':
      return <span className="pill bg-red-100 text-red-800">Desclassificado</span>;
    default:
      return <span className="pill bg-gray-100 text-gray-700">{conv.status ?? 'Convocado'}</span>;
  }
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-embrapa-green-light border-t-embrapa-green" />
      <p className="mt-4 text-sm text-gray-500">Calculando ordem de convocação...</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-red-600">
      <p>Não foi possível carregar esta opção.</p>
    </div>
  );
}
