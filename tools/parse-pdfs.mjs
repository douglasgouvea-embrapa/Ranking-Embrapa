import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'web', 'data');

const FILES = [
  { file: 'Pesquisador.pdf', cargo: 'pesquisador' },
  { file: 'Analista.pdf', cargo: 'analista' },
  { file: 'Técnico e Assistente.pdf', cargo: 'tecnico-assistente' },
];

const LIST_PCD_MARKER = /Resultado final dos\(as\) candidatos\(as\) com defici[eê]ncia/i;
const LIST_PPP_MARKER = /Resultado final dos\(as\) candidatos\(as\) pretos\(as\) e pardos\(as\)/i;
// Códigos de opção têm sempre 8 dígitos (40XXXXXX). Aceitamos dígitos extras
// antes do `:` para tolerar typos no PDF (ex.: "OPÇÃO 400039956:" no edital
// do Assistente Laboratório/Seropédica é na verdade 40003995).
const OPCAO_HEADER = /OPÇÃO\s+(\d{8})\d*\s*:\s*([^–\n]+?)\s*[–-]\s*ÁREA\s*:\s*([^–\n]*?)(?:\s*[–-]\s*SUBÁREA\s*:\s*([^\n]+))?$/im;

function cleanText(raw) {
  // Remove page footers like "-- 1 of 38 --"
  let cleaned = raw.replace(/--\s*\d+\s+of\s+\d+\s*--/g, ' ');
  // Collapse line breaks inside paragraphs — join everything into one stream
  cleaned = cleaned.replace(/\r\n/g, '\n');
  // Replace newlines with spaces, but keep a marker before "OPÇÃO" so we can split later
  cleaned = cleaned.replace(/\n/g, ' ');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function splitIntoOpcoes(text) {
  // Códigos de opção têm 8 dígitos. Permitimos dígitos extras antes do `:` para
  // tolerar typos do PDF (ver comentário em OPCAO_HEADER).
  const re = /OPÇÃO\s+\d{8}\d*\s*:/g;
  const sections = [];
  const matches = [...text.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push(text.slice(start, end));
  }
  return sections;
}

function parseHeader(section) {
  // OPÇÃO XXXXXXX: CARGO – ÁREA: X – SUBÁREA: Y. (then candidates)
  // Match up to the first comma followed by an inscrição (10XXXXXXX) — that's where candidates start.
  const headerMatch = section.match(/^OPÇÃO\s+(\d{8})\d*\s*:\s*(.*?)(?=\s+10\d{6,7}\s*,)/s);
  if (!headerMatch) return null;
  const opcao = headerMatch[1];
  const rest = headerMatch[2];
  // Parse cargo / área / subárea
  let cargo = '';
  let area = '';
  let subarea = '';
  const dashSplit = rest.split(/\s+[–-]\s+/);
  if (dashSplit.length >= 1) cargo = dashSplit[0].trim();
  if (dashSplit.length >= 2) {
    const areaPart = dashSplit[1].replace(/^ÁREA\s*:\s*/i, '').trim();
    area = areaPart;
  }
  if (dashSplit.length >= 3) {
    const subareaPart = dashSplit[2].replace(/^SUBÁREA\s*:\s*/i, '').trim();
    subarea = subareaPart;
  }
  return { opcao, cargo, area, subarea };
}

function parseCandidates(block) {
  // Each candidate: "10XXXXXXX, Nome do Candidato, 99.99, 1"
  // Separated by " / " or final "."
  // Use a regex to extract tuples
  const re = /(10\d{6,7})\s*,\s*([^,]+?)\s*,\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*,\s*(\d{1,4})(?=\s*[/.]|\s*$)/g;
  const candidates = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    candidates.push({
      inscricao: m[1],
      nome: m[2].trim().replace(/\s+/g, ' '),
      nota: parseFloat(m[3].replace(',', '.')),
      classificacao: parseInt(m[4], 10),
    });
  }
  return candidates;
}

function parseSection(section) {
  const header = parseHeader(section);
  if (!header) return null;

  // The body starts after the header
  const bodyStart = section.search(/10\d{6,7}\s*,/);
  if (bodyStart === -1) return null;
  const body = section.slice(bodyStart);

  // Find PcD and PPP markers
  const pcdIdx = body.search(LIST_PCD_MARKER);
  const pppIdx = body.search(LIST_PPP_MARKER);

  let geralBlock, pcdBlock, pppBlock;

  if (pcdIdx === -1 && pppIdx === -1) {
    geralBlock = body;
  } else if (pcdIdx !== -1 && pppIdx !== -1) {
    geralBlock = body.slice(0, pcdIdx);
    pcdBlock = body.slice(pcdIdx, pppIdx);
    pppBlock = body.slice(pppIdx);
  } else if (pcdIdx !== -1) {
    geralBlock = body.slice(0, pcdIdx);
    pcdBlock = body.slice(pcdIdx);
  } else {
    geralBlock = body.slice(0, pppIdx);
    pppBlock = body.slice(pppIdx);
  }

  return {
    ...header,
    geral: parseCandidates(geralBlock || ''),
    pcd: parseCandidates(pcdBlock || ''),
    ppp: parseCandidates(pppBlock || ''),
  };
}

async function parsePdf(filePath) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  return cleanText(data.text);
}

function inferCargo(cargoText) {
  const upper = cargoText.toUpperCase();
  if (upper.includes('PESQUISADOR')) return 'pesquisador';
  if (upper.includes('ANALISTA')) return 'analista';
  if (upper.includes('ASSISTENTE')) return 'assistente';
  if (upper.includes('TÉCNICO') || upper.includes('TECNICO')) return 'tecnico';
  return 'desconhecido';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const all = {
    pesquisador: [],
    analista: [],
    tecnico: [],
    assistente: [],
  };

  for (const { file } of FILES) {
    const fp = path.join(ROOT, file);
    console.log(`Parsing ${file}...`);
    const text = await parsePdf(fp);
    const sections = splitIntoOpcoes(text);
    console.log(`  found ${sections.length} OPÇÕES`);

    for (const sec of sections) {
      const parsed = parseSection(sec);
      if (!parsed) continue;
      const cargoKey = inferCargo(parsed.cargo);
      if (!all[cargoKey]) all[cargoKey] = [];
      all[cargoKey].push(parsed);
    }
  }

  // Write one file per cargo + an index
  for (const cargo of Object.keys(all)) {
    const sorted = all[cargo].sort((a, b) => a.area.localeCompare(b.area) || a.subarea.localeCompare(b.subarea));
    const outFile = path.join(OUT_DIR, `${cargo}.json`);
    fs.writeFileSync(outFile, JSON.stringify(sorted, null, 2), 'utf8');
    console.log(`Wrote ${outFile} — ${sorted.length} opções, ${sorted.reduce((s, o) => s + o.geral.length + o.pcd.length + o.ppp.length, 0)} candidatos`);
  }

  const index = Object.fromEntries(
    Object.entries(all).map(([cargo, opcoes]) => [
      cargo,
      opcoes.map(o => ({
        opcao: o.opcao,
        area: o.area,
        subarea: o.subarea,
        totalGeral: o.geral.length,
        totalPcd: o.pcd.length,
        totalPpp: o.ppp.length,
      })),
    ]),
  );
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log('Wrote index.json');
}

main().catch(e => { console.error(e); process.exit(1); });
