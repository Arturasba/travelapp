import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadModule } from '../tests/modules.mjs';

// Rendered HTTP checks, not physical browser gesture tests.
const base=process.argv[2]||'http://localhost:3000';
const {destinations}=loadModule('app/destinations.ts');
const {localizeDestination,translator}=loadModule('app/i18n.ts');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#x27;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const source=await readFile('app/discovery-guide.tsx','utf8')+await readFile('app/route-planner-panel.tsx','utf8');
for(const locale of ['en','lt']){
  const t=translator(locale);
  const response=await fetch(`${base}/${locale}`);
  assert.equal(response.status,200);
  const html=await response.text();
  assert(html.includes(`<html lang="${locale}"`),'document language must match route');
  for(const text of ['Explore the map','Browse places','Where to eat','Search places','Travel essentials','Plan your route'])assert(html.includes(escape(t(text))),`missing ${locale} control: ${text}`);
  assert(html.includes('destination-search')&&html.includes('hrefLang="lt"'),'search and language switch must be discoverable');
  assert(!html.includes('Open travel book')&&!html.includes('Saved places')&&!html.includes('undefined"'),'no retired controls or undefined CSS exports');
  for(const city of ['Vilnius','Kaunas','Klaipėda','Šiauliai','Trakai','Druskininkai','Nida','Palanga'])assert(html.includes(city),`missing town ${city}`);
  const classes=[...html.matchAll(/class="([^"]*)"/g)].flatMap(match=>match[1].split(/\s+/));
  const cssPaths=[...html.matchAll(/href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match=>match[1]);
  const css=(await Promise.all(cssPaths.map(async path=>{const result=await fetch(new URL(path.replaceAll('&amp;','&'),base));assert.equal(result.status,200);return result.text();}))).join('\n');
  const guideClass=classes.find(value=>value.endsWith('_guide'));
  assert(guideClass&&css.includes(`.${guideClass}`),'scoped CSS must match rendered exports');
  const prefix=guideClass.slice(0,-'guide'.length);
  for(const name of new Set([...source.matchAll(/styles\.([A-Za-z]+)/g)].map(match=>match[1])))assert(css.includes(`.${prefix}${name}`),`missing compiled class ${name}`);
  assert(/touch-action:\s*none/.test(css),'map canvas must own touch gestures');
  for(const place of destinations){
    const localized=localizeDestination(place,locale);
    const result=await fetch(`${base}/${locale}/places/${place.slug}`);
    assert.equal(result.status,200,`${locale}/${place.slug}`);
    const page=await result.text();
    assert(page.includes(escape(localized.name)),`missing localized name ${place.slug}`);
    for(const label of ['Before you go','Get directions','Explore nearby','Add to route','Show on map'])assert(page.includes(escape(t(label))),`missing ${locale} practical action ${label}`);
    if(place.category==='restaurants'){
      assert(page.includes(escape(place.address))&&page.includes(escape(t('Menu & visitor information'))),'food venues need address and menu');
      assert(!page.includes(escape(t('View full photograph'))),'no invented restaurant photograph');
    }else assert(page.includes('position:relative')&&page.includes(escape(t('View full photograph'))),'photograph needs a positioned parent and full viewer');
  }
  const missing=await fetch(`${base}/${locale}/places/not-a-real-place`);
  const missingHtml=await missing.text();
  // A streamed loading shell can send the not-found client boundary instead of its HTML.
  assert([200,404].includes(missing.status)&&missingHtml.includes('noindex')&&missingHtml.includes(`<html lang="${locale}"`)&&(missingHtml.includes(escape(t('This place could not be found.')))||missingHtml.includes('NEXT_HTTP_ERROR_FALLBACK;404')),'unknown places need an unindexable localized not-found boundary');
}
for(const [path,target] of [['/?q=Trakai','/en?q=Trakai'],['/places/trakai-island-castle?city=trakai','/en/places/trakai-island-castle?city=trakai'],['/journal','/en'],['/lt/journal','/lt']]){
  const response=await fetch(`${base}${path}`,{redirect:'manual'});
  assert([307,308].includes(response.status),`legacy redirect ${path}`);
  const url=new URL(response.headers.get('location'),base);assert.equal(url.pathname+url.search,target);
}
assert.equal((await fetch(`${base}/de`)).status,404,'unsupported locale must not render a broken atlas');
let photos=0;
for(const place of destinations)for(const photo of place.photos){
  const result=await fetch(new URL(photo.src,base));assert.equal(result.status,200,photo.src);
  assert(result.headers.get('content-type')?.startsWith('image/'));assert((await result.arrayBuffer()).byteLength>10000);photos++;
}
for(const [path,signature] of [['InterVariable.woff2','wOF2'],['NewsreaderVariable.ttf',null]]){
  const result=await fetch(`${base}/fonts/${path}`);assert.equal(result.status,200);const bytes=Buffer.from(await result.arrayBuffer());
  if(signature)assert.equal(bytes.subarray(0,4).toString(),signature);else assert.equal(bytes.readUInt32BE(0),0x00010000);
}
for(const name of ['Inter','Newsreader']){const result=await fetch(`${base}/fonts/${name}-LICENSE.txt`);assert.equal(result.status,200);assert((await result.text()).includes('SIL Open Font License'));}
const photo=destinations[0].photos[0];
for(const quality of [85,90]){const result=await fetch(`${base}/_next/image?url=${encodeURIComponent(`${photo.src}?v=${photo.width}-${photo.height}`)}&w=1920&q=${quality}`);assert.equal(result.status,200,`optimized quality ${quality}`);}
console.log(`PASS: English/Lithuanian shells, ${destinations.length*2} localized place routes, ${photos} licensed photos, restaurant details, fonts/CSS, legacy redirects, not-found handling and image optimization.`);
