import fs from 'node:fs/promises';

// Editorial review of the imported source filenames. A page image alone does
// not prove that a photograph depicts the attraction named by the article.
const places=JSON.parse(await fs.readFile('app/data/expanded-destinations.json','utf8'));
const assets=JSON.parse(await fs.readFile('app/data/expanded-assets.json','utf8'));
const visitorLinks=JSON.parse(await fs.readFile('app/data/visitor-links.json','utf8'));
const overrides=JSON.parse(await fs.readFile('app/data/photo-overrides.json','utf8'));
const cacheFiles=await fs.readdir('.atlas-research').catch(()=>[]);
const wikiPages=(await Promise.all(cacheFiles.filter(file=>/^wiki-\d+\.json$/.test(file)).map(async file=>JSON.parse(await fs.readFile('.atlas-research/'+file,'utf8')).query?.pages??[]))).flat();
const excluded=new Set(['Europos Parkas','Medininkai Castle']);
const historic=/Album_Wilenskie|Napoleon_Orda|Battle_of_Marijampol|J\.Bu[lł]hak|1937/i;
const reviewed=[];
const reviewedAssets=[];
for(const place of places){
  if(excluded.has(place.name))continue;
  const asset=assets.find(item=>[item.image,item.extraImage].some(photo=>photo?.src===place.photos[0].src));
  let candidates=[asset.image,asset.extraImage].filter(photo=>photo&&!historic.test(decodeURIComponent(photo.source)));
  const preferred=overrides.find(record=>record.qid===asset.qid);
  if(preferred)candidates=[preferred.image];
  if(place.name==='Trakai Peninsula Castle')candidates=candidates.filter(photo=>decodeURIComponent(photo.source).includes('N_trakai_1pilis'));
  if(place.name==='Meteliai Regional Park')candidates=candidates.filter(photo=>decodeURIComponent(photo.source).includes('Dus'));
  if(!candidates.length)throw Error('No reviewed photograph: '+place.name);
  // One strong photograph per new destination; preserve the original galleries.
  const selected=candidates.sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height))[0];
  const {src,alt,author,license,licenseUrl,source,width,height}=selected;
  const photo={src,alt,author,license,licenseUrl,source,width,height};
  const page=wikiPages.find(page=>page.pageprops?.wikibase_item===asset.qid);
  const coordinateSource=page?.coordinates?.some(point=>point.lat===place.coordinates[0]&&point.lon===place.coordinates[1])?asset.reference:place.coordinateSource;
  const sources=place.sources.filter(source=>source.label!=='Visitor information').map(source=>source.label==='Coordinate reference'?{label:'Wikidata reference',url:'https://www.wikidata.org/wiki/'+asset.qid}:source);
  const official=visitorLinks.find(link=>link.qid===asset.qid);
  if(official)sources.push({label:'Visitor information',url:official.url});
  reviewed.push({...place,coordinateSource,photos:[photo],sources});
  const record={...asset};delete record.extraImage;
  reviewedAssets.push({...record,coordinateSource,image:selected});
}
await fs.writeFile('app/data/expanded-destinations.json',JSON.stringify(reviewed,null,2)+'\n');
await fs.writeFile('app/data/expanded-assets.json',JSON.stringify(reviewedAssets,null,2)+'\n');
console.log('Reviewed collection:',16+reviewed.length,'destinations');
