import { unstable_cache } from 'next/cache';
import { LOOKER_NAME_CORRECTIONS } from './name-corrections';
import { normalizeName } from './normalize';

/**
 * Histórico de novidades vindo do site arjonilla87.github.io/embrapa-site,
 * que monitora o mesmo Looker Studio que usamos e mantém um diff completo
 * datado das mudanças (insert/update/remove) registradas a cada checagem.
 *
 * Filtramos apenas eventos "Convocado(Novo)" — STATUS=Convocado & EVENTO=NOVO —
 * que correspondem aos candidatos recém-convocados que ainda não apareciam
 * na sincronização anterior.
 */

const HISTORICO_URL = 'https://arjonilla87.github.io/embrapa-site/data/complete_diff_history.json';
export const HISTORICO_CACHE_TAG = 'historico-externo';

const CORRECTIONS_INDEX = new Map(
  LOOKER_NAME_CORRECTIONS.map(c => [`${c.opcao}|${normalizeName(c.nomeErrado)}`, c.nomeCerto]),
);

export type HistoricoEntry = {
  id: string;
  detectedAt: string;       // ISO 8601 com offset -03:00
  detectedAtLabel: string;  // "27/05/2026 - 16:59:43" (rótulo original)
  tipo: 'novo';
  nome: string;
  opcao?: string;
  status: string;
  colocacao?: string;
  cargo?: string;
  subarea?: string;
  unidade?: string;
};

type RawEntry = {
  'DATA / HORA': string;
  'COLOCAÇÃO'?: string;
  NOME: string;
  'OPÇÃO'?: string;
  CARGO?: string;
  'SUBÁREA'?: string;
  STATUS: string;
  UNIDADE?: string;
  LOTAÇÃO?: string;
  EVENTO: string;
  ALTERACOES?: string;
};

function parseBRDateTime(raw: string): string {
  // "27/05/2026 - 16:59:43" → "2026-05-27T16:59:43-03:00"
  const [datePart, timePart] = raw.split(' - ');
  if (!datePart || !timePart) return new Date().toISOString();
  const [dd, mm, yyyy] = datePart.split('/');
  if (!dd || !mm || !yyyy) return new Date().toISOString();
  return `${yyyy}-${mm}-${dd}T${timePart}-03:00`;
}

function applyNameCorrection(opcao: string | undefined, nome: string): string {
  if (!opcao) return nome;
  return CORRECTIONS_INDEX.get(`${opcao}|${normalizeName(nome)}`) ?? nome;
}

async function fetchHistorico(): Promise<HistoricoEntry[]> {
  const res = await fetch(HISTORICO_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao buscar histórico externo: ${res.status}`);
  const raw = await res.json() as RawEntry[];

  return raw
    .filter(r => r.STATUS === 'Convocado' && r.EVENTO === 'NOVO')
    .map(r => ({
      id: `${r['DATA / HORA']}|${r['OPÇÃO'] ?? ''}|${normalizeName(r.NOME)}`,
      detectedAt: parseBRDateTime(r['DATA / HORA']),
      detectedAtLabel: r['DATA / HORA'],
      tipo: 'novo' as const,
      nome: applyNameCorrection(r['OPÇÃO'], r.NOME),
      opcao: r['OPÇÃO'],
      status: r.STATUS,
      colocacao: r['COLOCAÇÃO'],
      cargo: r.CARGO,
      subarea: r['SUBÁREA'],
      unidade: r.UNIDADE,
    }))
    .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export const getCachedHistorico = unstable_cache(
  fetchHistorico,
  ['historico-externo'],
  { revalidate: 600, tags: [HISTORICO_CACHE_TAG] },
);
