import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './modules.mjs';
const data=loadModule('app/destinations.ts');const i18n=loadModule('app/i18n.ts');const navigation=loadModule('app/guide-navigation.ts');
test('every destination has Lithuanian content and retains its identity, pins and photo licensing',()=>{
 const translations=JSON.parse(fs.readFileSync('app/data/destinations.lt.json','utf8'));
 assert.equal(Object.keys(translations).length,data.destinations.length);
 for(const original of data.destinations){const place=i18n.localizeDestination(original,'lt');assert(place.description&&place.reasons.length>=3&&place.visitorInfo.length>=2);assert.equal(place.slug,original.slug);assert.equal(place.coordinates,original.coordinates);assert.equal(place.photos.length,original.photos.length);assert(place.photos.every((p,i)=>p.author===original.photos[i].author&&p.source===original.photos[i].source));assert(data.filterDestinations(place.name,'all','all').some(p=>p.slug===place.slug));}
 assert.equal(i18n.localizeDestination(data.getDestination('trakai-island-castle'),'lt').name,'Trakų salos pilis');
});
test('localized routing preserves every filter and validates invalid categories',()=>{
 const filters={query:'Trakų',city:'trakai',category:'castles',collection:'hidden'};
 const url=navigation.guideUrl(filters,{map:'trakai-island-castle'},'lt');assert(url.startsWith('/lt?'));assert.equal(new URL(url,'http://localhost').searchParams.get('q'),'Trakų');
 const parsed=navigation.readFilters(url);assert.equal(parsed.city,'trakai');assert.equal(parsed.collection,'hidden');assert.equal(parsed.category,'castles');
 assert.equal(navigation.readFilters('/lt?category=broken&city=broken').category,'all');
});
test('Lithuanian place counts use readable singular, plural and teen forms',()=>{
 for(const [count,word] of [[1,'vieta'],[2,'vietos'],[10,'vietų'],[11,'vietų'],[21,'vieta'],[114,'vietų']])assert.equal(i18n.placeWord(count,'lt'),word);
});
