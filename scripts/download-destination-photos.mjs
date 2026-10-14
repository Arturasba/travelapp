import fs from 'node:fs/promises';
import sharp from 'sharp';
const HEADERS={'User-Agent':process.env.ATLAS_USER_AGENT??'LithuaniaAtlasPhotoBot/1.0 (OpenAI Codex; https://openai.com/codex/) Node.js'};
const original=JSON.parse(await fs.readFile('app/data/destination-assets.json','utf8'));
const expanded=JSON.parse(await fs.readFile('app/data/expanded-assets.json','utf8'));
await fs.mkdir('.atlas-research',{recursive:true});
let until=0;try{until=JSON.parse(await fs.readFile('.atlas-research/download-after.json','utf8'));}catch{}
async function cooldown(){while(Date.now()<until){console.log('Image provider cooldown:',Math.ceil((until-Date.now())/1000),'seconds remaining');await new Promise(resolve=>setTimeout(resolve,Math.min(50000,until-Date.now())));}}
const names=original.flatMap(record=>[record.image,record.extraImage].filter(Boolean).map(photo=>'File:'+decodeURIComponent(new URL(photo.source).pathname.split('/wiki/File:')[1])));
for(let offset=0;offset<names.length;offset+=20){
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',formatversion:'2',titles:names.slice(offset,offset+20).join('|'),prop:'imageinfo',iiprop:'url|size',iiurlwidth:'2560'}),{headers:HEADERS});
  if(!response.ok)throw Error('Core metadata HTTP '+response.status);
  const result=await response.json();
  for(const record of original)for(const photo of [record.image,record.extraImage].filter(Boolean)){const info=result.query?.pages.find(page=>page.imageinfo?.[0]?.descriptionurl===photo.source)?.imageinfo?.[0];if(info){photo.originalWidth=info.width;photo.originalHeight=info.height;photo.downloadUrl=info.thumburl??info.url;}}
  await new Promise(resolve=>setTimeout(resolve,1500));
}
// Ask for a standard, cached display size instead of fetching every full-size
// original. Commons can return an unscaled original for larger rounded sizes.
const expansionNames=expanded.map(record=>'File:'+decodeURIComponent(new URL(record.image.source).pathname.split('/wiki/File:')[1]));
for(let offset=0;offset<expansionNames.length;offset+=30){
  const response=await fetch('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',formatversion:'2',titles:expansionNames.slice(offset,offset+30).join('|'),prop:'imageinfo',iiprop:'url|size',iiurlwidth:'1920'}),{headers:HEADERS});
  if(!response.ok)throw Error('Photo metadata HTTP '+response.status);
  const result=await response.json();
  for(const record of expanded){const photo=record.image;const info=result.query?.pages.find(page=>page.imageinfo?.[0]?.descriptionurl===photo.source)?.imageinfo?.[0];if(info){photo.downloadUrl=info.thumburl??info.url;photo.targetLongEdge=Math.min(2560,Math.max(info.width,info.height),Math.max(info.thumbwidth??info.width,info.thumbheight??info.height));}}
  await new Promise(resolve=>setTimeout(resolve,1500));
}
await cooldown();
const failures=[];let completed=0;
for(const record of [...original,...expanded])for(const photo of [record.image,record.extraImage].filter(Boolean)){
  const output='public'+photo.src;
  try{
    const expected=photo.targetLongEdge??Math.min(2560,Math.max(photo.originalWidth??photo.width,photo.originalHeight??photo.height));
    try{const m=await sharp(output).metadata();if(Math.max(m.width,m.height)>=expected){photo.width=m.width;photo.height=m.height;completed++;continue;}}catch{}
    const url=photo.downloadUrl??photo.original;
    let done=false;
    for(let attempt=0;attempt<3;attempt++){
      await cooldown();
      const response=await fetch(url,{headers:{...HEADERS,Referer:photo.source},signal:AbortSignal.timeout(90000)});
      if(response.status===429){const wait=Number(response.headers.get('retry-after'))||600;until=Date.now()+wait*1000;await fs.writeFile('.atlas-research/download-after.json',JSON.stringify(until));continue;}
      if(!response.ok)throw Error('Photo HTTP '+response.status);
      const buffer=Buffer.from(await response.arrayBuffer());
      await sharp(buffer).rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).jpeg({quality:92,mozjpeg:true}).toFile(output);
      const m=await sharp(output).metadata();photo.width=m.width;photo.height=m.height;done=true;break;
    }
    if(!done)throw Error('Image provider rate limit persisted');
    completed++;console.log('PHOTO',completed,record.title,photo.width+'x'+photo.height);
    // Uncached thumbnail renders have tighter limits than the metadata API.
    await new Promise(resolve=>setTimeout(resolve,8500));
  }catch(error){failures.push({title:record.title,src:photo.src,error:error.message});console.log('FAILED',record.title,error.message);}
}
await fs.writeFile('app/data/destination-assets.json',JSON.stringify(original,null,2)+'\n');
await fs.writeFile('app/data/expanded-assets.json',JSON.stringify(expanded,null,2)+'\n');
const destinations=JSON.parse(await fs.readFile('app/data/expanded-destinations.json','utf8'));
for(const place of destinations){const asset=expanded.find(record=>record.image.src===place.photos[0].src);place.photos=[asset.image,...(asset.extraImage?[asset.extraImage]:[])].sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height));}
await fs.writeFile('app/data/expanded-destinations.json',JSON.stringify(destinations,null,2)+'\n');
await import('./curate-destination-photos.mjs');
await fs.writeFile('.atlas-research/photo-failures.json',JSON.stringify(failures,null,2));
console.log('COMPLETE',completed,'photos;',failures.length,'failures');
if(failures.length)process.exitCode=1;
