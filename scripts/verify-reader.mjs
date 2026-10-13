import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run against next dev or next start to catch stylesheet-loader and route regressions.
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
const guideClass = classes.find(value => value.endsWith('_guide'));
assert(guideClass && css.includes(`.${guideClass}`), 'atlas CSS must match the rendered class');
const guidePrefix = guideClass.slice(0, -'guide'.length);
assert(html.includes('Lithuania, an open atlas.') && html.includes('Loading the map'), 'homepage must open into the atlas');
const source = await readFile('app/discovery-guide.tsx', 'utf8');
for (const name of new Set([...source.matchAll(/styles\.([A-Za-z]+)/g)].map(match => match[1]))) {
  assert(css.includes(`.${guidePrefix}${name}`), `missing compiled guide class: ${name}`);
}
assert(html.includes('destination-search') && html.includes('Curated starter collection'));
for (const city of ['Vilnius','Kaunas','Klaipėda','Šiauliai','Trakai','Druskininkai','Nida','Palanga']) {
  assert(html.includes(city), `missing city navigation: ${city}`);
}
const font = await fetch(`${base}/fonts/InterVariable.woff2`);
assert.equal(font.status,200);
assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0,4).toString(),'wOF2');
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
  assert(page.includes('Before you go') && page.includes('Sources &amp; photography') && page.includes('Get directions'), `${slug} must render practical destination content`);
}
const missing = await fetch(`${base}/places/not-a-real-place`);
const missingHtml = await missing.text();
// Next can begin streaming a partial shell before notFound resolves (HTTP 200).
// Both paths must render the real not-found UI and prohibit indexing.
assert([200,404].includes(missing.status) && missingHtml.includes('noindex') && missingHtml.includes('This page could not be found'), 'unknown destinations must render an unindexable not-found page');
const optimized = await fetch(`${base}/_next/image?url=%2Fdestinations%2FQ1482013.jpg&w=1920&q=75`);
assert.equal(optimized.status,200);
const journal = await fetch(`${base}/journal`);
assert.equal(journal.status,200);
const journalHtml = await journal.text();
assert(journalHtml.includes('Back to Explore'), 'journal needs a visible return action');
assert(journalHtml.includes('position:relative'), 'journal fill image parent must be positioned');
assert(css.includes('touch-action:none') || css.includes('touch-action: none'), 'map must own touch gestures');
console.log(`PASS: guide CSS, city navigation, local Inter font, ${assetRecords.length * 2} photos, all ${slugs.length} destination routes and directions, 404 handling, image optimization, and preserved journal.`);
