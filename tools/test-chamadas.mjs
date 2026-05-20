// Valida a fórmula slotType contra o Anexo IX (posições 1-45).

const EXPECTED = {
  1: 'AC', 2: 'AC', 3: 'PPP', 4: 'AC', 5: 'PCD',
  6: 'AC', 7: 'AC', 8: 'PPP', 9: 'AC', 10: 'AC',
  11: 'PCD', 12: 'AC', 13: 'PPP', 14: 'AC', 15: 'AC',
  16: 'AC', 17: 'AC', 18: 'PPP', 19: 'AC', 20: 'AC',
  21: 'PCD', 22: 'AC', 23: 'PPP', 24: 'AC', 25: 'AC',
  26: 'AC', 27: 'AC', 28: 'PPP', 29: 'AC', 30: 'AC',
  31: 'PCD', 32: 'AC', 33: 'PPP', 34: 'AC', 35: 'AC',
  36: 'AC', 37: 'AC', 38: 'PPP', 39: 'AC', 40: 'AC',
  41: 'PCD', 42: 'AC', 43: 'PPP', 44: 'AC', 45: 'AC',
};

function slotType(pos, opcaoId) {
  if (pos === 5) return 'PCD';
  if (pos > 1 && pos % 10 === 1) return 'PCD';
  if (pos % 5 === 3) return 'PPP';
  return 'AC';
}

let pass = 0, fail = 0;
for (const [pos, expected] of Object.entries(EXPECTED)) {
  const got = slotType(Number(pos), '40000084');
  if (got === expected) { pass++; }
  else { fail++; console.log(`pos ${pos}: expected ${expected}, got ${got}`); }
}
console.log(`Tabela A: ${pass}/${pass + fail} OK`);

// Now compute call order for the 40000084 opção and verify it generates a sensible sequence
import { gerarChamadas, tabelaOf } from '../web/lib/chamadas.ts';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('../web/data/tecnico.json', 'utf8'));
const op = data.find(o => o.opcao === '40000084');
console.log('\nOpcao 40000084 (TÉCNICO):');
console.log('  Tabela:', tabelaOf('40000084'));
console.log('  Geral count:', op.geral.length);
console.log('  PPP count:', op.ppp.length);
console.log('  PCD count:', op.pcd.length);

const chamadas = gerarChamadas(op, 30);
console.log('\nPrimeiras 30 chamadas:');
chamadas.forEach(c => {
  const tag = `${c.cotaCount}º ${c.slotEfetivo}`;
  const fb = c.fallback ? ' (fallback)' : '';
  console.log(`  ${String(c.posicao).padStart(2)} | ${tag.padEnd(10)} | ${c.candidato.nome} (${c.listaOrigem}: ${c.classificacao || c.candidato.classificacao}º)${fb}`);
});
