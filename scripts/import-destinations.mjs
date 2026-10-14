import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { seeds } from './destination-seeds.mjs';

const CACHE = '.atlas-research';
const metadataOnly = process.argv.includes('--metadata-only');
const HEADERS = { 'User-Agent': 'LithuaniaTravelAtlas/1.0 (independent educational travel guide; Wikimedia attribution retained)' };
await fs.mkdir(CACHE,{recursive:true});
const slugify = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const plain = text => (text??'').replace(/<[^>]*>/g,'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#039;',"'").trim();
let lastRequest=0;
async function request(url, binary=false) {
  for(let attempt=0;attempt<7;attempt++) {
    try {
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,1200-(Date.now()-lastRequest))));lastRequest=Date.now();
      const response=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(90000)});
      if(!response.ok){const error=Error(`HTTP ${response.status}`);error.retryAfter=Number(response.headers.get('retry-after'))||15*(attempt+1);throw error;}
      if(binary){if(Number(response.headers.get('content-length'))>35000000)throw Error('Image exceeds import size limit');return Buffer.from(await response.arrayBuffer());}
      return await response.json();
    } catch(error) {if(attempt===6)throw error;console.log('RETRY',new URL(url).hostname,error.message,error.retryAfter??'');await new Promise(resolve=>setTimeout(resolve,error.retryAfter?error.retryAfter*1000:2000*(attempt+1)));}
  }
}
async function cached(name,url) {
  const file=path.join(CACHE,name+'.json');
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{}
  const result=await request(url);await fs.writeFile(file,JSON.stringify(result));return result;
}
function api(base,params){return base+'?'+new URLSearchParams({format:'json',formatversion:'2',...params});}
const researched=[];
for(let offset=0;offset<seeds.length;offset+=12){
  const batch=seeds.slice(offset,offset+12);
  const result=await cached('wiki-'+offset,api('https://en.wikipedia.org/w/api.php',{action:'query',titles:batch.map(item=>item.title).join('|'),redirects:'1',prop:'coordinates|pageimages|images|pageprops|extracts',piprop:'original',imlimit:'20',exintro:'1',explaintext:'1',exsentences:'4',exlimit:'12'}));
  const redirects=new Map((result.query?.redirects??[]).map(item=>[item.from,item.to]));
  const normalized=new Map((result.query?.normalized??[]).map(item=>[item.from,item.to]));
  for(const seed of batch){let title=normalized.get(seed.title)??seed.title;title=redirects.get(title)??title;const page=result.query?.pages.find(item=>item.title===title);if(page&&!page.missing&&page.pageprops?.wikibase_item)researched.push({...seed,page});else console.log('MISSING',seed.title);}
}
const legacy=JSON.parse(await fs.readFile('app/data/destination-assets.json','utf8'));
// Batch public API metadata to stay comfortably below per-client request limits.
for(let offset=0;offset<researched.length;offset+=40){
  const ids=[...new Set(researched.slice(offset,offset+40).map(item=>item.page.pageprops.wikibase_item))];
  const result=await cached('entities-batch-'+offset,api('https://www.wikidata.org/w/api.php',{action:'wbgetentities',ids:ids.join('|'),props:'claims'}));
  for(const id of ids)if(result.entities?.[id])await fs.writeFile(path.join(CACHE,'entity-'+id+'.json'),JSON.stringify({entities:{[id]:result.entities[id]}}));
}
const imageTitles=[];
for(const item of researched){
  const qid=item.page.pageprops.wikibase_item;
  const entity=JSON.parse(await fs.readFile(path.join(CACHE,'entity-'+qid+'.json'),'utf8')).entities[qid];
  const primary=entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  const original=item.page.original?.source?decodeURIComponent(new URL(item.page.original.source).pathname.split('/').at(-1)):null;
  imageTitles.push(...[...new Set([original&&'File:'+original,primary&&'File:'+primary,...(item.page.images??[]).map(image=>image.title)].filter(Boolean))].filter(title=>/\.(jpe?g|png|webp)$/i.test(title)).slice(0,7));
}
const uniqueTitles=[...new Set(imageTitles)];
for(let offset=0;offset<uniqueTitles.length;offset+=30){
  const batch=uniqueTitles.slice(offset,offset+30);
  const result=await cached('images-batch-'+offset,api('https://commons.wikimedia.org/w/api.php',{action:'query',titles:batch.join('|'),prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'2560'}));
  const byTitle=new Map((result.query?.pages??[]).map(page=>[page.title,page]));
  const normalized=new Map((result.query?.normalized??[]).map(item=>[item.from,item.to]));
  for(const title of batch){const page=byTitle.get(normalized.get(title)??title);if(page)await fs.writeFile(path.join(CACHE,'image-'+slugify(title).slice(0,150)+'.json'),JSON.stringify({query:{pages:[page]}}));}
  console.log('PHOTO METADATA',Math.min(offset+30,uniqueTitles.length),'/',uniqueTitles.length);
}
const existingQids=new Set(legacy.map(item=>item.qid));
const seenQids=new Set(existingQids);
const records=[];const photoRecords=[];const failed=[];
const badFile=/\.(svg|gif|pdf|ogg|webm|tif|tiff)$|flag|coat.of.arms|logo|locator|signature|map\b|portrait|herbas|zemelap|žemėlap|coat_of|plan\./i;
async function photoInfo(title) {
  const result=await cached('image-'+slugify(title).slice(0,150),api('https://commons.wikimedia.org/w/api.php',{action:'query',titles:title,prop:'imageinfo',iiprop:'url|size|extmetadata'}));
  return result.query?.pages[0]?.imageinfo?.[0];
}
async function makePhoto(title,src,alt) {
  const info=await photoInfo(title);
  if(!info||Math.max(info.width,info.height)<1600||Math.min(info.width,info.height)<700)return null;
  const meta=info.extmetadata??{};const license=plain(meta.LicenseShortName?.value);
  if(!/^(CC BY(?:-SA)? [0-9.]+|CC0|Public domain)/i.test(license))return null;
  const artist=plain(meta.Artist?.value);if(!artist)return null;
  const url=new URL(info.url);url.search='';
  const output='public'+src;
  if(metadataOnly){const scale=Math.min(1,2560/Math.max(info.width,info.height));return{src,alt,author:artist,license,licenseUrl:meta.LicenseUrl?.value||'https://creativecommons.org/publicdomain/mark/1.0/',source:info.descriptionurl,original:url.href,...(info.thumburl?{downloadUrl:info.thumburl}:{}),width:Math.round(info.width*scale),height:Math.round(info.height*scale),originalWidth:info.width,originalHeight:info.height};}
  try{const m=await sharp(output).metadata();if(Math.max(m.width,m.height)>=Math.min(2560,Math.max(info.width,info.height)))return{src,alt,author:artist,license,licenseUrl:meta.LicenseUrl?.value||'https://creativecommons.org/publicdomain/mark/1.0/',source:info.descriptionurl,original:url.href,width:m.width,height:m.height,originalWidth:info.width,originalHeight:info.height};}catch{}
  const input=await request(url.href,true);
  await sharp(input).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).jpeg({quality:92,mozjpeg:true}).toFile(output);
  const m=await sharp(output).metadata();
  return{src,alt,author:artist,license,licenseUrl:meta.LicenseUrl?.value||'https://creativecommons.org/publicdomain/mark/1.0/',source:info.descriptionurl,original:url.href,width:m.width,height:m.height,originalWidth:info.width,originalHeight:info.height};
}
function practical(seed) {
  const district=seed.category==='cities'||seed.category==='nature';
  const first=district?'This pin is an area reference. Choose the entrance, trailhead or venue you intend to visit before requesting directions.':`Use the ${seed.name} reference pin to orient yourself, then confirm the appropriate visitor entrance locally.`;
  const second=seed.category==='nature'?'Choose a signed route and check local protected-area access information before setting out.':seed.category==='cities'?'Individual museums, churches and attractions have their own visiting arrangements.':seed.category==='coast'?'Choose a specific beach, village or waterfront access point; check local transport arrangements before travelling.':'Check the venue’s current visiting arrangements before travelling; interior access, tickets and events may have separate conditions.';
  return[first,second];
}
for(const item of researched) {
  if(['Europos Parkas','Medininkai Castle'].includes(item.name))continue;
  const qid=item.page.pageprops.wikibase_item;if(seenQids.has(qid))continue;
  try{
    const entity=(await cached('entity-'+qid,api('https://www.wikidata.org/w/api.php',{action:'wbgetentities',ids:qid,props:'claims'}))).entities[qid];
    const point=item.page.coordinates?.[0]??entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const coordinates=point?[point.lat??point.latitude,point.lon??point.longitude]:null;
    if(!coordinates||coordinates[0]<53.85||coordinates[0]>56.5||coordinates[1]<20.9||coordinates[1]>26.9)throw Error('No Lithuanian reference coordinate');
    const primary=entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const original=item.page.original?.source?decodeURIComponent(new URL(item.page.original.source).pathname.split('/').at(-1)):null;
    const candidates=[...new Set([original&&'File:'+original,primary&&'File:'+primary,...(item.page.images??[]).map(image=>image.title)].filter(Boolean))].filter(title=>!badFile.test(title)&&/\.(jpe?g|png|webp)$/i.test(title));
    if(item.name==='Trakai Peninsula Castle')candidates.splice(0,candidates.length,...candidates.filter(title=>title.includes('N_trakai_1pilis')));
    const photos=[];
    for(const title of candidates.slice(0,12)) {
      try{const photo=await makePhoto(title,`/destinations/${qid}${photos.length?'-2':''}.jpg`,`${item.name} — ${plain(title.replace(/^File:/,'').replace(/\.[^.]+$/,'')).replaceAll('_',' ')}`);if(photo&&!photos.some(existing=>existing.source===photo.source)){photos.push(photo);if(photos.length===2)break;}}catch(error){console.log('IMAGE SKIP',item.name,error.message);}
    }
    if(!photos.length)throw Error('No suitable licensed location photograph');
    const slug=slugify(item.name);const reference='https://en.wikipedia.org/wiki/'+encodeURIComponent(item.page.title.replaceAll(' ','_'));
    const reasons=[item.description.split('. ')[0].replace(/\.$/,''),`Explore the ${item.city} area`,{cities:'Historic streets and local life',castles:'Estate and architectural heritage',nature:'A landscape-focused excursion',coast:'Baltic and lagoon-side discoveries',culture:'A cultural stop beyond the main route'}[item.category]];
    records.push({slug,name:item.name,location:item.city+' · Lithuania',category:item.category,cityId:slugify(item.city),coordinates,coordinateSource:'https://www.wikidata.org/wiki/'+qid,coordinateNote:'Sourced reference pin; confirm the appropriate entrance or access point.',description:item.description,reasons,visitorInfo:practical(item),featured:false,hidden:false,photos,sources:[{label:'Location reference',url:reference},{label:'Coordinate reference',url:'https://www.wikidata.org/wiki/'+qid}],reviewed:'2026-10-14'});
    photoRecords.push({title:item.name,qid,coordinates,coordinateSource:'https://www.wikidata.org/wiki/'+qid,image:photos[0],...(photos[1]?{extraImage:photos[1]}:{}),reference});
    seenQids.add(qid);console.log('ADDED',records.length,item.name,photos.map(p=>`${p.width}x${p.height}`).join(' / '));
    await fs.writeFile('app/data/expanded-destinations.json',JSON.stringify(records,null,2)+'\n');
    await fs.writeFile('app/data/expanded-assets.json',JSON.stringify(photoRecords,null,2)+'\n');
  }catch(error){failed.push({title:item.title,error:error.message});console.log('SKIP',item.title,error.message);}
}
await fs.writeFile(path.join(CACHE,'failed.json'),JSON.stringify(failed,null,2));
console.log('TOTAL',legacy.length+records.length,'destinations;',failed.length,'skipped candidates');
await import('./curate-destination-photos.mjs');
// Upgrade existing images in place while retaining their source and attribution.
if(!metadataOnly){for(const record of legacy){for(const key of ['image','extraImage']){const old=record[key];if(!old)continue;try{const file='File:'+decodeURIComponent(new URL(old.source).pathname.split('/wiki/File:')[1]);const upgraded=await makePhoto(file,old.src,old.alt);if(upgraded){record[key]=upgraded;console.log('UPGRADED',record.title,key,upgraded.width,upgraded.height);}}catch(error){console.log('UPGRADE SKIP',record.title,error.message);}}}await fs.writeFile('app/data/destination-assets.json',JSON.stringify(legacy,null,2)+'\n');}
