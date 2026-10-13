import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const assets = JSON.parse(fs.readFileSync('app/data/destination-assets.json','utf8'));
const compiled = ts.transpileModule(fs.readFileSync('app/destinations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const scope = { exports:{}, require:()=>assets };
vm.runInNewContext(compiled,scope);
const { destinations, filterDestinations, getDestination } = scope.exports;

test('collection has at least 15 unique real destinations, sourced pins and licensed photos', async () => {
  assert(destinations.length >= 15);
  assert.equal(new Set(destinations.map(place=>place.slug)).size,destinations.length);
  assert.equal(new Set(destinations.map(place=>place.category)).size,5);
  for(const place of destinations) {
    assert(place.name && place.location && place.description && place.reasons.length >= 3 && place.visitorInfo.length >= 2);
    assert(place.coordinates[0] > 53 && place.coordinates[0] < 57);
    assert(place.coordinates[1] > 20 && place.coordinates[1] < 27);
    assert(place.coordinateSource.startsWith('https://') && place.sources.length >= 2);
    assert(place.photos.length >= 2, `${place.name} needs a real gallery`);
    for(const photo of place.photos) {
      assert(photo.author && /CC BY|Public domain|CC0/.test(photo.license));
      assert(photo.source.startsWith('https://commons.wikimedia.org/'));
      assert(photo.licenseUrl.startsWith('http'));
      const metadata = await sharp('public'+photo.src).metadata();
      assert(Math.max(metadata.width,metadata.height) >= 1000);
    }
  }
});
test('accent-insensitive, multiword search finds real places and combines with category', () => {
  assert.equal(filterDestinations('Puckoriai','all','all')[0].slug,'puckoriai-outcrop');
  assert.equal(filterDestinations('pazaislis kaunas','all','all')[0].slug,'pazaislis-monastery');
  assert.equal(filterDestinations('trakai','nature','all').length,0);
  assert.equal(filterDestinations('   ','castles','all').length,3);
  assert.equal(filterDestinations('not a real place','all','all').length,0);
});
test('popular and hidden collections are explicit editorial flags', () => {
  const popular = filterDestinations('','all','popular');
  const hidden = filterDestinations('','all','hidden');
  assert(popular.length > 0 && popular.every(place=>place.featured));
  assert(hidden.length > 0 && hidden.every(place=>place.hidden));
  assert(hidden.some(place=>place.slug==='cold-war-museum'));
  assert.equal(getDestination('unknown-slug'),undefined);
});

test('city and town filters are explicit and nonempty, including Druskininkai',()=>{
  for(const city of scope.exports.cities){
    const matches=filterDestinations('','all','all',city.id);
    assert(matches.length>0,`empty navigation for ${city.label}`);
    assert(matches.every(place=>place.cityId===city.id));
  }
  assert.equal(filterDestinations('','all','all','druskininkai')[0].slug,'druskininkai');
  assert.equal(filterDestinations('','castles','all','vilnius')[0].slug,'gediminas-tower');
  assert(destinations.every(place=>place.cityId!=='all'));
});
