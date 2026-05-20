// Lê "Cargos de cada Tabela.md" e produz web/data/vagas.json com a contagem oficial
// de AC/PPP/PcD por opção (Anexo II + retificações do sorteio).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'Cargos de cada Tabela.md');
const OUT = path.join(ROOT, 'web', 'data', 'vagas.json');

const md = fs.readFileSync(SRC, 'utf8');

// Linhas com opções têm o formato: | 40XXXXXXX | Cargo | ... | AC | PPP | PcD | Total |
// AC/PPP/PcD são números ou "*" (zero).
const re = /^\|\s*(40\d{6,7})\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d*]+)\s*\|\s*([\d*]+)\s*\|\s*([\d*]+)\s*\|\s*([\d*]+)\s*\|/gm;

const vagas = {};
let m;
while ((m = re.exec(md)) !== null) {
  const [, opcao, ac, ppp, pcd, total] = m;
  const toNum = s => s === '*' ? 0 : parseInt(s, 10);
  vagas[opcao] = {
    ac: toNum(ac),
    ppp: toNum(ppp),
    pcd: toNum(pcd),
    total: toNum(total),
  };
}

fs.writeFileSync(OUT, JSON.stringify(vagas, null, 2), 'utf8');
console.log(`Wrote ${OUT} — ${Object.keys(vagas).length} opções`);
