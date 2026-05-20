export type Candidate = {
  inscricao: string;
  nome: string;
  nota: number;
  classificacao: number;
};

export type Opcao = {
  opcao: string;
  cargo: string;
  area: string;
  subarea: string;
  geral: Candidate[];
  pcd: Candidate[];
  ppp: Candidate[];
};

export type CargoKey = 'analista' | 'pesquisador' | 'tecnico' | 'assistente';

export type ListaKey = 'geral' | 'pcd' | 'ppp';

export type SlotType = 'AC' | 'PPP' | 'PCD';

export type Chamada = {
  posicao: number;
  slotOriginal: SlotType;
  slotEfetivo: SlotType;
  cotaCount: number;
  fallback: boolean;
  candidato: Candidate;
  listaOrigem: 'geral' | 'ppp' | 'pcd';
};

export type Vagas = { ac: number; ppp: number; pcd: number; total: number };

export type OpcaoComChamadas = Opcao & {
  tabela: 'A' | 'B' | 'C';
  chamadas: Chamada[];
  vagas: Vagas | null;
};

export type ConvocadoStatus = 'Contratado' | 'Aceitou' | 'Desistente' | string;

export type ConvocadoRecord = {
  nome: string;
  opcao?: string;
  colocacao?: string;
  status?: ConvocadoStatus;
  unidade?: string;
  lotacao?: string;
};
