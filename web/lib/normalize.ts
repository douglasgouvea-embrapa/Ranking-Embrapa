export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildConvocadoIndex(records: { nome: string }[]): Set<string> {
  return new Set(records.map(r => normalizeName(r.nome)));
}
