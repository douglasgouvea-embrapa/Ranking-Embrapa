import fs from 'node:fs';
import { PDFParse } from 'pdf-parse';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const parser = new PDFParse({ data: buf });
const data = await parser.getText();
console.log('=== PAGES:', data.numpages, '===');
const lines = data.text.split('\n').filter(l => l.trim());
console.log('FIRST 60 LINES:');
lines.slice(0, 60).forEach((l, i) => console.log(String(i).padStart(3), '|', l));
console.log('\n--- LAST 20 LINES ---');
lines.slice(-20).forEach((l, i) => console.log(String(lines.length - 20 + i).padStart(3), '|', l));
console.log('\nTOTAL LINES:', lines.length);
