import type { CargoKey, Opcao } from './types';
import analistaData from '@/data/analista.json';
import pesquisadorData from '@/data/pesquisador.json';
import tecnicoData from '@/data/tecnico.json';
import assistenteData from '@/data/assistente.json';

const DATA: Record<CargoKey, Opcao[]> = {
  analista: analistaData as Opcao[],
  pesquisador: pesquisadorData as Opcao[],
  tecnico: tecnicoData as Opcao[],
  assistente: assistenteData as Opcao[],
};

export function getOpcoes(cargo: CargoKey): Opcao[] {
  return DATA[cargo] ?? [];
}

export function getOpcao(cargo: CargoKey, opcaoId: string): Opcao | undefined {
  return DATA[cargo]?.find(o => o.opcao === opcaoId);
}

export const CARGO_LABELS: Record<CargoKey, string> = {
  analista: 'Analista',
  pesquisador: 'Pesquisador',
  tecnico: 'Técnico',
  assistente: 'Assistente',
};

export const CARGO_GROUPS: { id: string; label: string; cargos: CargoKey[] }[] = [
  { id: 'analista', label: 'Analista', cargos: ['analista'] },
  { id: 'pesquisador', label: 'Pesquisador', cargos: ['pesquisador'] },
  { id: 'tecnico-assistente', label: 'Técnico e Assistente', cargos: ['tecnico', 'assistente'] },
];

export function getOpcoesByGroup(groupId: string): Opcao[] {
  const group = CARGO_GROUPS.find(g => g.id === groupId);
  if (!group) return [];
  return group.cargos.flatMap(c => DATA[c]);
}
