import { Redis } from '@upstash/redis';
import { normalizeName } from './normalize';
import type { ConvocadoRecord } from './types';

/**
 * Snapshot do estado dos convocados — usado para detectar novidades entre
 * sincronizações com o Looker.
 *
 * Estratégia: cada sincronização nova compara seus dados com o snapshot
 * salvo anteriormente, calcula a lista de novidades, e salva tudo junto
 * (entries + novidades). Assim novidades reflete sempre "o que mudou na
 * última sincronização", e múltiplas leituras dentro do mesmo ciclo de
 * cache não recomputam nem sobrescrevem nada.
 *
 * Persiste no Vercel KV (Upstash Redis). Se as env vars não estiverem
 * configuradas, vira no-op: novidades sempre [] e o app segue funcionando.
 */

const SNAPSHOT_KEY = 'ranking:convocados:snapshot:v2';

export type SnapshotEntry = {
  key: string;     // "opcao|normalized_nome"
  nome: string;
  opcao?: string;
  status?: string;
  colocacao?: string;
};

export type Novidade =
  | { tipo: 'novo'; nome: string; opcao?: string; status?: string; colocacao?: string }
  | { tipo: 'status'; nome: string; opcao?: string; statusAnterior?: string; statusAtual?: string; colocacao?: string };

export type StoredSnapshot = {
  entries: SnapshotEntry[];
  total: number;
  fetchedAt: string;
  novidades: Novidade[];
  previousFetchedAt: string | null;
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

function diffEntries(current: SnapshotEntry[], previous: SnapshotEntry[]): Novidade[] {
  const previousMap = new Map(previous.map(e => [e.key, e]));
  const novidades: Novidade[] = [];
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
    return (await redis.get<StoredSnapshot>(SNAPSHOT_KEY)) ?? null;
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
  novidades: Novidade[];
  snapshotAnterior: { fetchedAt: string; total: number } | null;
};

/**
 * Reconcilia o snapshot persistido com os dados atuais do Looker.
 *
 * - Se nunca houve snapshot (primeira execução com KV ligado): salva o atual
 *   sem novidades.
 * - Se o fetchedAt atual é mais novo que o do snapshot: é uma sincronização
 *   nova → calcula novidades vs snapshot salvo, persiste tudo.
 * - Caso contrário (mesma sincronização que gerou o snapshot): apenas retorna
 *   as novidades já persistidas.
 */
export async function reconcileSnapshot(
  convocados: ConvocadoRecord[],
  total: number,
  fetchedAt: string,
): Promise<DiffOutput> {
  const stored = await readStoredSnapshot();
  const currentEntries = toEntries(convocados);

  // Mesma sincronização que já gerou o snapshot atual → reusa novidades.
  if (stored && stored.fetchedAt === fetchedAt) {
    return {
      novidades: stored.novidades,
      snapshotAnterior: stored.previousFetchedAt
        ? { fetchedAt: stored.previousFetchedAt, total: stored.entries.length }
        : null,
    };
  }

  // Sincronização nova (ou primeiríssima): calcula diff vs snapshot salvo,
  // persiste o novo. Se não havia snapshot anterior, novidades = [].
  const novidades = stored ? diffEntries(currentEntries, stored.entries) : [];
  const novoSnapshot: StoredSnapshot = {
    entries: currentEntries,
    total,
    fetchedAt,
    novidades,
    previousFetchedAt: stored?.fetchedAt ?? null,
  };
  await writeStoredSnapshot(novoSnapshot);

  return {
    novidades,
    snapshotAnterior: stored ? { fetchedAt: stored.fetchedAt, total: stored.total } : null,
  };
}

export function isKvConfigured(): boolean {
  return getRedis() !== null;
}
