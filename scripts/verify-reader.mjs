import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run against next dev to catch stylesheet-loader and route regressions.
const base = process.argv[2] || 'http://localhost:3000';
const assetRecords = JSON.parse(await readFile('app/data/destination-assets.json', 'utf8'));
const response = await fetch(base);
assert.equal(response.status, 200);
const html = await response.text();
const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap(match => match[1].split(/\s+/));
assert(!classes.some(value => value === 'undefined'), 'CSS Module exports must never be undefined');
const cssPaths = [...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match => match[1]);
assert(cssPaths.length > 0);
const css = (await Promise.all(cssPaths.map(async path => {
  const result = await fetch(new URL(path.replaceAll('&amp;', '&'), base));
  assert.equal(result.status, 200);
  return result.text();
}))).join('\n');
const photoClass = classes.find(value => value.endsWith('__fullPhoto'));
assert(photoClass && css.includes(`.${photoClass}`), 'photograph CSS must match the rendered class');
assert(html.includes('position:relative'), 'fill image parent must be positioned');
const source = await readFile('app/discovery-guide.tsx', 'utf8');
for (const name of new Set([...source.matchAll(/styles\.([A-Za-z]+)/g)].map(match => match[1]))) {
  assert(css.includes(`__${name}`), `missing compiled guide class: ${name}`);
}
assert(html.includes('destination-search') && html.includes('Curated starter collection'));
for (const record of assetRecords) {
  for (const photo of [record.image, record.extraImage].filter(Boolean)) {
    const result = await fetch(new URL(photo.src, base));
    assert.equal(result.status, 200, `photo must load: ${photo.src}`);
    assert(result.headers.get('content-type')?.startsWith('image/'));
    assert((await result.arrayBuffer()).byteLength > 10000);
  }
}
const destinationSource = await readFile('app/destinations.ts', 'utf8');
const slugs = [...destinationSource.matchAll(/slug:\s*"([^"]+)"/g)].map(match => match[1]);
assert(slugs.length >= 15);
for (const slug of slugs) {
  const result = await fetch(`${base}/places/${slug}`);
  assert.equal(result.status, 200);
  const page = await result.text();
  assert(page.includes('Before you go') && page.includes('Sources &amp; photography'), `${slug} must render the destination, not just the shell`);
}
const missing = await fetch(`${base}/places/not-a-real-place`);
assert.equal(missing.status, 404);
const optimized = await fetch(`${base}/_next/image?url=%2Fdestinations%2FQ1482013.jpg&w=1920&q=75`);
assert.equal(optimized.status,200);
const journal = await fetch(`${base}/journal`);
assert.equal(journal.status,200);
console.log('PASS: guide CSS Module mappings, positioned images, 30 local photos, all 15 destination deep links, 404 handling, image optimization, and preserved journal.');
