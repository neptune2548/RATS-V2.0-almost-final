import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'file:///C:/Users/nattapol-se/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';

const root = path.resolve('docs/manuals');
const input = path.join(root, 'screenshots_v2');
const output = path.join(root, 'screenshots_annotated');
await fs.mkdir(output, { recursive: true });

const esc = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function annotate(filename, markers, crop = null) {
  const source = path.join(input, filename);
  const base = crop ? sharp(source).extract(crop) : sharp(source);
  const sourceBuffer = await base.png().toBuffer();
  const image = sharp(sourceBuffer);
  const meta = await image.metadata();
  const overlay = markers.map(({ n, cx, cy, tx, ty }) => `
    <path d="M ${cx + 17} ${cy} L ${tx} ${ty}" stroke="#dc2626" stroke-width="5" fill="none" marker-end="url(#arrow)"/>
    <circle cx="${cx}" cy="${cy}" r="19" fill="#dc2626" stroke="#ffffff" stroke-width="4"/>
    <text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${esc(String(n))}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
    <defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="4" orient="auto"><path d="M0,0 L0,8 L10,4 z" fill="#dc2626"/></marker></defs>
    ${overlay}
  </svg>`;
  const out = path.join(output, filename.replace('_clean', '_annotated'));
  await sharp(sourceBuffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out);
  console.log(out);
}

await annotate('01_login_clean.png', [
  { n: 1, cx: 28, cy: 130, tx: 118, ty: 130 },
  { n: 2, cx: 28, cy: 182, tx: 118, ty: 182 },
  { n: 3, cx: 28, cy: 234, tx: 118, ty: 234 },
  { n: 4, cx: 335, cy: 274, tx: 275, ty: 274 },
]);

await annotate('02_operator_wb83_clean.png', [
  { n: 1, cx: 28, cy: 32, tx: 220, ty: 32 },
  { n: 2, cx: 28, cy: 205, tx: 205, ty: 205 },
  { n: 3, cx: 802, cy: 205, tx: 640, ty: 205 },
  { n: 4, cx: 802, cy: 325, tx: 645, ty: 325 },
  { n: 5, cx: 802, cy: 470, tx: 650, ty: 470 },
], { left: 430, top: 55, width: 830, height: 610 });

await annotate('03_production_readiness_clean.png', [
  { n: 1, cx: 35, cy: 56, tx: 140, ty: 56 },
  { n: 2, cx: 35, cy: 115, tx: 270, ty: 115 },
  { n: 3, cx: 805, cy: 115, tx: 645, ty: 115 },
  { n: 4, cx: 805, cy: 25, tx: 750, ty: 25 },
], { left: 0, top: 0, width: 840, height: 290 });
