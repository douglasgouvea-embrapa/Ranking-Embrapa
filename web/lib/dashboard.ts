import { CARGO_GROUPS, getOpcoesByGroup } from './data';
import { gerarChamadas } from './chamadas';
import { normalizeName } from './normalize';
import type { ConvocadoRecord, SlotType } from './types';

export type ProximoConvocado = {
  cargoGroup: string;
  opcao: string;
  cargo: string;
  area: string;
  subarea: string;
  proximaPosicao: number;
  proximoNome: string;
  proximaInscricao: string;
  slotEfetivo: SlotType;
  cotaCount: number;
  ultimaPosicaoChamada: number;
  totalConvocacoes: number;
  emAndamento: number;        // status Convocado / Aceitou
  contratados: number;
  desistencias: number;
};

/**
 * Para cada opção, calcula quem é o "próximo da fila" — o primeiro candidato
 * na ordem de convocação que ainda não foi chamado (não consta no Looker).
 *
 * Filtra opções sem nenhuma convocação registrada (provavelmente não houve
 * movimentação) e ordena priorizando opções com convocações "em andamento"
 * (status Convocado / Aceitou), depois por contagem total de movimentação.
 */
export function computeProximosConvocados(convocados: ConvocadoRecord[]): ProximoConvocado[] {
  // Index: opcao → ConvocadoRecord[]
  const byOpcao = new Map<string, ConvocadoRecord[]>();
  for (const c of convocados) {
    if (!c.opcao) continue;
    const arr = byOpcao.get(c.opcao) ?? [];
    arr.push(c);
    byOpcao.set(c.opcao, arr);
  }

  const resultados: ProximoConvocado[] = [];

  for (const group of CARGO_GROUPS) {
    const opcoes = getOpcoesByGroup(group.id);
    for (const opcao of opcoes) {
      const convsOpcao = byOpcao.get(opcao.opcao);
      if (!convsOpcao || convsOpcao.length === 0) continue;

      const calledNames = new Set(convsOpcao.map(c => normalizeName(c.nome)));
      const chamadas = gerarChamadas(opcao);

      let ultimaPosicaoChamada = 0;
      let proximo: typeof chamadas[number] | undefined;
      for (const ch of chamadas) {
        if (calledNames.has(normalizeName(ch.candidato.nome))) {
          ultimaPosicaoChamada = ch.posicao;
        } else if (!proximo) {
          proximo = ch;
        }
      }

      if (!proximo) continue;

      let emAndamento = 0, contratados = 0, desistencias = 0;
      for (const c of convsOpcao) {
        if (c.status === 'Contratado') contratados++;
        else if (c.status === 'Aceitou' || c.status === 'Convocado') emAndamento++;
        else if (c.status === 'Desistente' || c.status === 'Desclassificado' || c.status === 'Não se manifestou') desistencias++;
      }

      resultados.push({
        cargoGroup: group.id,
        opcao: opcao.opcao,
        cargo: opcao.cargo,
        area: opcao.area,
        subarea: opcao.subarea,
        proximaPosicao: proximo.posicao,
        proximoNome: proximo.candidato.nome,
        proximaInscricao: proximo.candidato.inscricao,
        slotEfetivo: proximo.slotEfetivo,
        cotaCount: proximo.cotaCount,
        ultimaPosicaoChamada,
        totalConvocacoes: convsOpcao.length,
        emAndamento,
        contratados,
        desistencias,
      });
    }
  }

  resultados.sort((a, b) => {
    if (b.emAndamento !== a.emAndamento) return b.emAndamento - a.emAndamento;
    return b.totalConvocacoes - a.totalConvocacoes;
  });

  return resultados;
}
