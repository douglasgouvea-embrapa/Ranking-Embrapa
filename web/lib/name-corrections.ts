/**
 * Correções manuais de erros de digitação nos nomes do Looker Studio.
 *
 * O Looker é mantido pelo RH e às vezes tem typos nos nomes (ex.: "OLIVIERA"
 * em vez de "OLIVEIRA"). Como nosso match é por (opção + nome normalizado),
 * um typo faz o candidato aparecer como "Aguardando" no sistema mesmo
 * estando convocado/contratado no Looker.
 *
 * Como adicionar uma correção:
 *   - Pegue o nome ERRADO como aparece no Looker
 *   - Adicione a entrada com a opção e o nome certo (igual ao PDF)
 *   - Os nomes são normalizados antes do match (sem acentos, minúsculas),
 *     então pode usar a grafia visual mesmo.
 */

export const LOOKER_NAME_CORRECTIONS: Array<{
  opcao: string;
  nomeErrado: string;
  nomeCerto: string;
}> = [
  {
    opcao: '40002042',
    nomeErrado: 'ANA ALICE ANDRADE OLIVIERA',
    nomeCerto: 'Ana Alice Andrade Oliveira',
  },
];
