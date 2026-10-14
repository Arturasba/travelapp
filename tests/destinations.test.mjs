import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const compiled = ts.transpileModule(fs.readFileSync('app/destinations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const expanded=JSON.parse(fs.readFileSync('app/data/expanded-destinations.json','utf8'));
const scope = { exports:{}, require:name=>JSON.parse(fs.readFileSync('app/'+name.replace(/^\.\//,''),'utf8')) };
vm.runInNewContext(compiled,scope);
const { destinations, filterDestinations, getDestination } = scope.exports;

test('collection has at least 100 unique real destinations, sourced pins and licensed photos', async () => {
  assert(destinations.length >= 100);
  assert.equal(new Set(destinations.map(place=>place.slug)).size,destinations.length);
  assert.equal(new Set(destinations.map(place=>place.category)).size,6);
  for(const place of destinations) {
    assert(place.name && place.location && place.description && place.reasons.length >= 3 && place.visitorInfo.length >= 2);
    assert(place.coordinates[0] > 53 && place.coordinates[0] < 57);
    assert(place.coordinates[1] > 20 && place.coordinates[1] < 27);
    assert(place.coordinateSource.startsWith('https://') && place.sources.length >= 2);
    if(place.category!=='restaurants')assert(place.photos.length >= 1, `${place.name} needs a real photograph`);
    else assert(place.address&&place.cuisine&&place.sources.some(source=>source.label==='Visitor information'));
    for(const photo of place.photos) {
      assert(photo.author && /CC BY|Public domain|CC0/.test(photo.license));
      assert(photo.source.startsWith('https://commons.wikimedia.org/'));
      assert(photo.licenseUrl.startsWith('http'));
      const metadata = await sharp('public'+photo.src).metadata();
      assert(Math.max(metadata.width,metadata.height) >= 1000);
      assert.equal(metadata.width,photo.width,`${place.name}: published width must match the real photograph`);
      assert.equal(metadata.height,photo.height,`${place.name}: published height must match the real photograph`);
      if(expanded.some(item=>item.slug===place.slug))assert(Math.max(metadata.width,metadata.height)>=1600,`${place.name}: imported photographs must retain sufficient resolution`);
    }
  }
});

test('every destination can be found by its own name within its real town and category',()=>{
  for(const place of destinations){
    const plain=place.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    assert(filterDestinations(plain,place.category,'all',place.cityId).some(item=>item.slug===place.slug),`unsearchable place: ${place.name}`);
  }
});
test('accent-insensitive, multiword search finds real places and combines with category', () => {
  assert.equal(filterDestinations('Puckoriai','all','all')[0].slug,'puckoriai-outcrop');
  assert.equal(filterDestinations('pazaislis kaunas','all','all')[0].slug,'pazaislis-monastery');
  assert(filterDestinations('trakai','nature','all').some(place=>place.slug==='trakai-historical-national-park'));
  assert(filterDestinations('   ','castles','all').length >= 15);
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

test('nearby places use sorted geographic distance and exclude the current destination',()=>{
  const {distanceKm,nearbyDestinations}=scope.exports;
  assert.equal(distanceKm([54,25],[54,25]),0);
  assert(Math.abs(distanceKm([0,0],[0,1])-111.195)<0.01);
  assert.equal(distanceKm([54,25],[55,24]),distanceKm([55,24],[54,25]));
  assert(Number.isFinite(distanceKm([0,0],[0,180])));
  const nearby=nearbyDestinations('vilnius-old-town');
  assert.equal(nearby.length,3);
  assert.equal(nearby[0].distanceKm,Math.min(...destinations.filter(place=>place.slug!=='vilnius-old-town').map(place=>distanceKm(getDestination('vilnius-old-town').coordinates,place.coordinates))));
  assert(nearby.every((item,index)=>item.place.slug!=='vilnius-old-town'&&getDestination(item.place.slug)&&(!index||item.distanceKm>=nearby[index-1].distanceKm)));
  assert.equal(nearbyDestinations('unknown').length,0);
  assert.equal(nearbyDestinations('nida',0).length,0);
});
