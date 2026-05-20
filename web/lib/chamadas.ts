import type { Opcao, Candidate } from './types';

/**
 * Implementa a ordem de convocação do Anexo IX do Edital nº 01/2024 da Embrapa.
 *
 * Tabela A (padrão, 169 opções): sequência AC AC PPP AC PCD AC AC PPP AC AC PCD ...
 *   - PPP nas posições onde pos % 5 == 3 (3, 8, 13, 18, ...)
 *   - PCD nas posições pos == 5 ou (pos > 1 e pos % 10 == 1) → 5, 11, 21, 31, 41, ...
 *   - AC nas demais.
 *
 * Tabela B (17 opções): mesmas regras da Tabela A, mas posição 2 é PPP (sorteio).
 *
 * Tabela C (2 opções): mesmas regras da Tabela A, mas uma PCD extra na posição
 *   correspondente ao total de vagas do edital (10 para 40001565, 16 para 40002278).
 */

export const TABELA_B_CODES = new Set<string>([
  // Pesquisador
  '40000065', '40000116', '40000271', '40000786', '40000894',
  '40001001', '40001179', '40006431',
  // Analista
  '40000202', '40000353', '40000408', '40000616', '40000909',
  '40001355', '40001642', '40002284', '40003476',
]);

export const TABELA_C_INFO: Record<string, { extraPcdAt: number }> = {
  '40001565': { extraPcdAt: 10 }, // Pesquisador — 6 AC + 2 PPP + 2 PCD = 10
  '40002278': { extraPcdAt: 16 }, // Analista — 10 AC + 3 PPP + 3 PCD = 16
};

export type SlotType = 'AC' | 'PPP' | 'PCD';

export function tabelaOf(opcaoId: string): 'A' | 'B' | 'C' {
  if (TABELA_C_INFO[opcaoId]) return 'C';
  if (TABELA_B_CODES.has(opcaoId)) return 'B';
  return 'A';
}

export function slotType(pos: number, opcaoId: string): SlotType {
  const tc = TABELA_C_INFO[opcaoId];
  if (tc && pos === tc.extraPcdAt) return 'PCD';

  if (TABELA_B_CODES.has(opcaoId) && pos === 2) return 'PPP';

  if (pos === 5) return 'PCD';
  if (pos > 1 && pos % 10 === 1) return 'PCD';
  if (pos % 5 === 3) return 'PPP';
  return 'AC';
}

export type Chamada = {
  posicao: number;            // posição unificada na ordem de convocação (1, 2, 3...)
  slotOriginal: SlotType;     // o que o Anexo IX diz para esta posição
  slotEfetivo: SlotType;      // o que efetivamente foi convocado (muda só em fallback)
  cotaCount: number;          // 1, 2, 3 — o "Nº" dentro da cota efetiva (ex.: 1º AC, 3º PPP)
  fallback: boolean;          // true quando a cota original estava esgotada
  candidato: Candidate;
  listaOrigem: 'geral' | 'ppp' | 'pcd';
};

export function gerarChamadas(opcao: Opcao, maxPositions?: number): Chamada[] {
  // O algoritmo termina sozinho quando as 3 listas estão esgotadas. Default = geral.length + 50 (margem).
  const limit = maxPositions ?? (opcao.geral.length + 50);
  const { geral, ppp, pcd } = opcao;
  const called = new Set<string>();
  const chamadas: Chamada[] = [];

  let geralIdx = 0, pppIdx = 0, pcdIdx = 0;
  let acCount = 0, pppCount = 0, pcdCount = 0;

  const advance = (arr: Candidate[], idx: number) => {
    while (idx < arr.length && called.has(arr[idx].inscricao)) idx++;
    return idx;
  };

  for (let pos = 1; pos <= limit; pos++) {
    const slot = slotType(pos, opcao.opcao);
    let candidate: Candidate | undefined;
    let listaOrigem: 'geral' | 'ppp' | 'pcd' = 'geral';
    let slotEfetivo: SlotType = slot;
    let cotaCount = 0;
    let fallback = false;

    if (slot === 'PPP') {
      pppIdx = advance(ppp, pppIdx);
      if (pppIdx < ppp.length) {
        candidate = ppp[pppIdx++];
        listaOrigem = 'ppp';
        pppCount++;
        cotaCount = pppCount;
      } else {
        // PPP esgotado → cai para AC
        geralIdx = advance(geral, geralIdx);
        if (geralIdx < geral.length) {
          candidate = geral[geralIdx++];
          slotEfetivo = 'AC';
          acCount++;
          cotaCount = acCount;
          fallback = true;
        }
      }
    } else if (slot === 'PCD') {
      pcdIdx = advance(pcd, pcdIdx);
      if (pcdIdx < pcd.length) {
        candidate = pcd[pcdIdx++];
        listaOrigem = 'pcd';
        pcdCount++;
        cotaCount = pcdCount;
      } else {
        geralIdx = advance(geral, geralIdx);
        if (geralIdx < geral.length) {
          candidate = geral[geralIdx++];
          slotEfetivo = 'AC';
          acCount++;
          cotaCount = acCount;
          fallback = true;
        }
      }
    } else {
      geralIdx = advance(geral, geralIdx);
      if (geralIdx < geral.length) {
        candidate = geral[geralIdx++];
        acCount++;
        cotaCount = acCount;
      }
    }

    if (!candidate) break;
    called.add(candidate.inscricao);

    chamadas.push({
      posicao: pos,
      slotOriginal: slot,
      slotEfetivo,
      cotaCount,
      fallback,
      candidato: candidate,
      listaOrigem,
    });
  }

  return chamadas;
}
