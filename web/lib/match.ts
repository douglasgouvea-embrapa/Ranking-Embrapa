import { normalizeName } from './normalize';
import type { Chamada, ConvocadoRecord, SlotType } from './types';

/**
 * Match entre chamadas (geradas a partir do ranking do PDF) e registros de
 * convocados (vindos do Looker). Acontece em duas passadas:
 *
 *  1. Match exato por nome normalizado.
 *  2. Fallback: para chamadas não encontradas, varre os convocados restantes
 *     da mesma opção e considera match se a colocação no Looker (ex.: "1º PPP")
 *     bate com (cotaCount, slotEfetivo) da chamada E o nome difere em ≤ 3
 *     caracteres (Levenshtein). A sanity check pela posição evita falsos
 *     positivos entre nomes parecidos por coincidência.
 *
 * Cada conv só pode ser usado por uma chamada — a passada 1 trava todos os
 * matches óbvios antes da 2 começar.
 */

const FUZZY_MAX_DISTANCE = 3;

export function levenshtein(a: string, b: string, maxDist = FUZZY_MAX_DISTANCE): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Early exit: linha inteira já excedeu o limite — distância só pode crescer.
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export type ColocacaoParsed = { pos: number; slot: SlotType };

/**
 * Faz parse de strings como "1º PPP", "10ª AC", "5º PCD".
 * Tolerante a variações (º/ª/o/°, espaços, maiúsculas, "PcD").
 */
export function parseColocacao(s: string | undefined): ColocacaoParsed | null {
  if (!s) return null;
  const m = s.match(/(\d+)\s*[ºªo°]?\s*(ac|ppp|pcd)/i);
  if (!m) return null;
  const pos = parseInt(m[1], 10);
  const slotRaw = m[2].toUpperCase();
  const slot = (slotRaw === 'PCD' ? 'PCD' : slotRaw === 'PPP' ? 'PPP' : 'AC') as SlotType;
  if (!Number.isFinite(pos) || pos <= 0) return null;
  return { pos, slot };
}

/**
 * Resolve, para cada chamada da opção, qual ConvocadoRecord corresponde.
 * Retorna Map keyed by inscrição do candidato (única e estável).
 */
export function matchChamadasComConvocados(
  chamadas: Chamada[],
  convocados: ConvocadoRecord[],
): Map<string, ConvocadoRecord> {
  const result = new Map<string, ConvocadoRecord>();
  const usedConvs = new Set<number>();

  // Passada 1: match exato por nome normalizado.
  const convsByNome = new Map<string, number[]>();
  convocados.forEach((c, i) => {
    const k = normalizeName(c.nome);
    const arr = convsByNome.get(k) ?? [];
    arr.push(i);
    convsByNome.set(k, arr);
  });

  for (const ch of chamadas) {
    const k = normalizeName(ch.candidato.nome);
    const candidates = convsByNome.get(k);
    if (!candidates) continue;
    const idx = candidates.find(i => !usedConvs.has(i));
    if (idx !== undefined) {
      result.set(ch.candidato.inscricao, convocados[idx]);
      usedConvs.add(idx);
    }
  }

  // Passada 2: fuzzy por posição (cotaCount + slot) + nome com ≤ 3 chars de diff.
  for (const ch of chamadas) {
    if (result.has(ch.candidato.inscricao)) continue;
    const nomeNorm = normalizeName(ch.candidato.nome);
    let bestIdx = -1;
    let bestDist = FUZZY_MAX_DISTANCE + 1;
    for (let i = 0; i < convocados.length; i++) {
      if (usedConvs.has(i)) continue;
      const conv = convocados[i];
      const parsed = parseColocacao(conv.colocacao);
      if (!parsed) continue;
      if (parsed.pos !== ch.cotaCount || parsed.slot !== ch.slotEfetivo) continue;
      const d = levenshtein(nomeNorm, normalizeName(conv.nome), FUZZY_MAX_DISTANCE);
      if (d <= FUZZY_MAX_DISTANCE && d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d === 0) break;
      }
    }
    if (bestIdx >= 0) {
      result.set(ch.candidato.inscricao, convocados[bestIdx]);
      usedConvs.add(bestIdx);
    }
  }

  return result;
}
