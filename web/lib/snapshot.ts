import { Redis } from '@upstash/redis';
import { normalizeName } from './normalize';
import type { ConvocadoRecord } from './types';

/**
 * Snapshot do estado dos convocados — mantém o estado da última sincronização
 * (para diff) e um histórico paginável das novidades de todas as syncs
 * anteriores (cap em HISTORICO_CAP, mais novas primeiro).
 *
 * Persiste no Vercel KV (Upstash Redis). Se as env vars não estiverem
 * configuradas, vira no-op: histórico sempre [] e o app segue funcionando.
 */

const SNAPSHOT_KEY = 'ranking:convocados:snapshot:v3';
const HISTORICO_CAP = 100;

export type SnapshotEntry = {
  key: string;     // "opcao|normalized_nome"
  nome: string;
  opcao?: string;
  status?: string;
  colocacao?: string;
};

export type HistoricoEntry =
  | { id: string; detectedAt: string; tipo: 'novo'; nome: string; opcao?: string; status?: string; colocacao?: string }
  | { id: string; detectedAt: string; tipo: 'status'; nome: string; opcao?: string; statusAnterior?: string; statusAtual?: string; colocacao?: string };

type Diff =
  | { tipo: 'novo'; nome: string; opcao?: string; status?: string; colocacao?: string }
  | { tipo: 'status'; nome: string; opcao?: string; statusAnterior?: string; statusAtual?: string; colocacao?: string };

export type StoredSnapshot = {
  entries: SnapshotEntry[];
  total: number;
  fetchedAt: string;
  historico: HistoricoEntry[];
};

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function entryKey(opcao: string | undefined, nome: string): string {
  return `${opcao ?? ''}|${normalizeName(nome)}`;
}

function toEntries(convocados: ConvocadoRecord[]): SnapshotEntry[] {
  return convocados.map(c => ({
    key: entryKey(c.opcao, c.nome),
    nome: c.nome,
    opcao: c.opcao,
    status: c.status,
    colocacao: c.colocacao,
  }));
}

function diffEntries(current: SnapshotEntry[], previous: SnapshotEntry[]): Diff[] {
  const previousMap = new Map(previous.map(e => [e.key, e]));
  const novidades: Diff[] = [];
  for (const cur of current) {
    const prev = previousMap.get(cur.key);
    if (!prev) {
      novidades.push({
        tipo: 'novo',
        nome: cur.nome,
        opcao: cur.opcao,
        status: cur.status,
        colocacao: cur.colocacao,
      });
    } else if (prev.status !== cur.status) {
      novidades.push({
        tipo: 'status',
        nome: cur.nome,
        opcao: cur.opcao,
        statusAnterior: prev.status,
        statusAtual: cur.status,
        colocacao: cur.colocacao,
      });
    }
  }
  return novidades;
}

async function readStoredSnapshot(): Promise<StoredSnapshot | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const stored = await redis.get<Partial<StoredSnapshot>>(SNAPSHOT_KEY);
    if (!stored) return null;
    return {
      entries: stored.entries ?? [],
      total: stored.total ?? 0,
      fetchedAt: stored.fetchedAt ?? '',
      historico: stored.historico ?? [],
    };
  } catch (err) {
    console.error('[snapshot] erro lendo KV:', err);
    return null;
  }
}

async function writeStoredSnapshot(snapshot: StoredSnapshot): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(SNAPSHOT_KEY, snapshot);
  } catch (err) {
    console.error('[snapshot] erro escrevendo KV:', err);
  }
}

export type DiffOutput = {
  historico: HistoricoEntry[];
};

/**
 * Reconcilia o snapshot persistido com os dados atuais do Looker.
 *
 * - Primeira execução com KV ligado: salva o atual sem adicionar ao histórico.
 * - Sincronização nova (fetchedAt mudou): calcula diff vs snapshot salvo,
 *   anexa cada novidade ao histórico (com detectedAt = fetchedAt), persiste.
 * - Mesma sincronização (fetchedAt igual): retorna o histórico salvo sem
 *   recomputar nem reescrever.
 */
export async function reconcileSnapshot(
  convocados: ConvocadoRecord[],
  total: number,
  fetchedAt: string,
): Promise<DiffOutput> {
  const stored = await readStoredSnapshot();
  const currentEntries = toEntries(convocados);

  if (stored && stored.fetchedAt === fetchedAt) {
    return { historico: stored.historico };
  }

  const novidades = stored ? diffEntries(currentEntries, stored.entries) : [];
  const novasEntradas: HistoricoEntry[] = novidades.map((n, i) => ({
    ...n,
    id: `${fetchedAt}-${i}`,
    detectedAt: fetchedAt,
  }));

  const historicoAtualizado = [...novasEntradas, ...(stored?.historico ?? [])].slice(0, HISTORICO_CAP);

  const novoSnapshot: StoredSnapshot = {
    entries: currentEntries,
    total,
    fetchedAt,
    historico: historicoAtualizado,
  };
  await writeStoredSnapshot(novoSnapshot);

  return { historico: historicoAtualizado };
}

export function isKvConfigured(): boolean {
  return getRedis() !== null;
}
