// Investigates the Looker Studio dashboard to find data endpoints.
// Logs all network requests, captures responses that look like data,
// and dumps the final rendered DOM to a file for inspection.

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

const URL = 'https://datastudio.google.com/u/0/reporting/081070ee-89c7-4e57-85bc-04d4601aa513/page/qD6ZF';
const OUT_DIR = path.resolve('./looker-probe');
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });

const requests = [];
const responses = [];

page.on('request', req => {
  requests.push({ url: req.url(), method: req.method(), resourceType: req.resourceType() });
});

page.on('response', async res => {
  const url = res.url();
  const ct = res.headers()['content-type'] || '';
  const interesting = (
    url.includes('batchedDataV2') ||
    url.includes('dataservice') ||
    url.includes('analyticsservice') ||
    url.includes('reportembed') ||
    (ct.includes('json') && !url.includes('fonts.gstatic.com'))
  );
  if (interesting) {
    try {
      const text = await res.text();
      responses.push({ url, status: res.status(), contentType: ct, size: text.length, body: text.slice(0, 8000) });
    } catch {}
  }
});

console.log('Opening', URL);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

// Wait extra for any lazy data loads
await new Promise(r => setTimeout(r, 8000));

console.log('Captured', requests.length, 'requests,', responses.length, 'interesting responses');

// Save full request/response logs
fs.writeFileSync(path.join(OUT_DIR, 'requests.json'), JSON.stringify(requests, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'responses.json'), JSON.stringify(responses, null, 2));

// Capture rendered HTML
const html = await page.content();
fs.writeFileSync(path.join(OUT_DIR, 'rendered.html'), html);

// Capture screenshot
await page.screenshot({ path: path.join(OUT_DIR, 'screenshot.png'), fullPage: true });

// Inspect all iframes
const frames = page.frames();
console.log('Frames found:', frames.length);
for (const f of frames) {
  console.log('  -', f.url().slice(0, 120));
}

// Try to read any visible table data from the frames
for (let i = 0; i < frames.length; i++) {
  try {
    const data = await frames[i].evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const tableData = tables.map(t => Array.from(t.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('th,td')).map(c => c.textContent?.trim() ?? '')
      ));
      // Looker often renders tables as divs with specific classes — capture all text in plotting areas
      const allText = document.body.innerText;
      return { tables: tableData, bodyTextLength: allText.length, bodyTextSample: allText.slice(0, 4000) };
    });
    if (data.tables.length || data.bodyTextLength > 200) {
      fs.writeFileSync(path.join(OUT_DIR, `frame-${i}.json`), JSON.stringify(data, null, 2));
      console.log(`Frame ${i}: ${data.tables.length} tables, ${data.bodyTextLength} chars body text`);
    }
  } catch (e) {
    console.log(`Frame ${i} eval failed:`, e.message);
  }
}

await browser.close();
console.log('Done. Outputs in', OUT_DIR);
