import lookerQuery from './looker-query.json';
import type { ConvocadoRecord } from './types';

const LOOKER_ENDPOINT = 'https://datastudio.google.com/batchedDataV2?appVersion=20260508_0101';
const REPORT_URL = 'https://datastudio.google.com/reporting/081070ee-89c7-4e57-85bc-04d4601aa513/page/qD6ZF';

type LookerResponse = {
  dataResponse: Array<{
    dataSubset: Array<{
      dataset: {
        tableDataset: {
          totalCount: number;
          size: number;
          column: Array<{ nullIndex: number[]; stringColumn?: { values: string[] } }>;
        };
      };
    }>;
  }>;
};

export async function fetchConvocadosFromLooker(): Promise<{
  convocados: ConvocadoRecord[];
  total: number;
  fetchedAt: string;
}> {
  // Clone the query and bump pagination to capture all rows in one shot
  const body = JSON.parse(JSON.stringify(lookerQuery));
  body.dataRequest[0].datasetSpec.paginateInfo = { startRow: 1, rowsCount: 5001 };

  const res = await fetch(LOOKER_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': '*/*',
      'referer': REPORT_URL,
      'origin': 'https://datastudio.google.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Looker respondeu ${res.status}`);

  const raw = await res.text();
  // Looker prefixes responses with )]}' to prevent JSON hijacking — strip it
  const json = raw.startsWith(")]}'") ? raw.slice(4) : raw;
  const parsed = JSON.parse(json) as LookerResponse;

  const ds = parsed.dataResponse?.[0]?.dataSubset?.[0]?.dataset?.tableDataset;
  if (!ds) throw new Error('Looker retornou estrutura inesperada');

  const total = ds.totalCount ?? 0;
  // Columns in order: COLOCAÇÃO, NOME, OPÇÃO, STATUS, UNIDADE, LOTAÇÃO
  const cols = ds.column;
  const rows = cols[0]?.stringColumn?.values?.length ?? 0;

  const getCol = (idx: number) => {
    const col = cols[idx];
    const values = col?.stringColumn?.values ?? [];
    const nullSet = new Set(col?.nullIndex ?? []);
    // nullIndex are indices in the *output* (final dense array). Looker uses sparse encoding:
    // when nullIndex=[5,9,10], the stringColumn.values array doesn't include rows 5,9,10 —
    // we need to interleave nulls back in to get the correct dense array of length `rows`.
    const dense: (string | null)[] = [];
    let valueIdx = 0;
    for (let i = 0; i < rows; i++) {
      if (nullSet.has(i)) dense.push(null);
      else dense.push(values[valueIdx++] ?? null);
    }
    return dense;
  };

  const colocacaoCol = getCol(0);
  const nomeCol = getCol(1);
  const opcaoCol = getCol(2);
  const statusCol = getCol(3);
  const unidadeCol = getCol(4);
  const lotacaoCol = getCol(5);

  const convocados: ConvocadoRecord[] = [];
  for (let i = 0; i < rows; i++) {
    const nome = nomeCol[i];
    if (!nome) continue;
    convocados.push({
      nome,
      opcao: opcaoCol[i] ?? undefined,
      colocacao: colocacaoCol[i] ?? undefined,
      status: (statusCol[i] ?? undefined) as ConvocadoRecord['status'],
      unidade: unidadeCol[i] ?? undefined,
      lotacao: lotacaoCol[i] ?? undefined,
    });
  }

  return { convocados, total, fetchedAt: new Date().toISOString() };
}
