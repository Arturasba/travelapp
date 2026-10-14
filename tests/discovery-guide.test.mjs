import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compile,loadModule} from './modules.mjs';

function createGuide({locale='en',initialSlug,initialPath=`/${locale}?view=places`,storage=new Map(),compact=false}={}){
  const states=[],refs=[],effects=[],listeners=new Map();let stateIndex,refIndex,effectIndex;
  const url=new URL(initialSlug?`/${locale}/places/${initialSlug}`:initialPath,'http://localhost');
  const events={addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event);}};
  const react={useState(initial){const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=refIndex++;return refs[i]??={current:initial};},useCallback:fn=>fn,useMemo:fn=>fn(),useSyncExternalStore:(_subscribe,snapshot)=>snapshot(),useEffect(callback,deps){const i=effectIndex++;const old=effects[i];if(!old||!deps||deps.some((d,j)=>old.deps[j]!==d)){old?.cleanup?.();effects[i]={callback,deps};}}};
  const jsx=(type,props)=>({type,props});
  const css=new Proxy({},{get:(_target,key)=>key==='__esModule'?false:String(key)});
  const document={title:'',body:{style:{}},activeElement:null};
  const dialogs={exports:{},document,require:()=>react};vm.runInNewContext(compile('app/use-dialog.ts'),dialogs);
  const scope={exports:{},Event,URLSearchParams,HTMLElement:class{},document,window:{...events,location:url,matchMedia:()=>({matches:compact}),history:{pushState(_state,_unused,path){url.href=new URL(path,url).href;},replaceState(_state,_unused,path){url.href=new URL(path,url).href;}}},require:name=>name==='./use-dialog'?dialogs.exports:name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:name==='./locale-context'?{useLocale:()=>locale}:name==='./route-planner-panel'?function PlannerStub(){}:name==='next/dynamic'?()=>function MapStub(){}:name.endsWith('.css')?css:name==='next/image'?()=>null:loadModule('app/'+name.replace(/^\.\//,'')+'.ts')};
  vm.runInNewContext(compile('app/discovery-guide.tsx'),scope);
  const walk=node=>{if(!node||typeof node!=='object')return[];const c=node.props?.children;return[node,...(Array.isArray(c)?c.flat(Infinity):[c]).flatMap(walk)];};
  const render=()=>{stateIndex=refIndex=effectIndex=0;const tree=scope.exports.default({initialSlug});for(const node of walk(tree))if(node.type==='dialog'&&node.props.ref&&!node.props.ref.current)node.props.ref.current={open:false,showModal(){this.open=true;},close(){this.open=false;},getBoundingClientRect(){return{left:20,top:20,right:300,bottom:400};}};for(const effect of effects)if(effect.callback){effect.cleanup=effect.callback();effect.callback=null;}return tree;};
  return {render,document,storage,find:(tree,predicate)=>walk(tree).find(predicate),all:(tree,predicate)=>walk(tree).filter(predicate),click:(node,extra={})=>{assert(node,'expected a working control');node.props.onClick({button:0,preventDefault(){},...extra});},url:()=>url.pathname+url.search,key:key=>events.dispatchEvent({type:'keydown',key}),pop:path=>{url.href=new URL(path,url).href;events.dispatchEvent({type:'popstate'});}};
}

for(const locale of ['en','lt']){
 test(`${locale}: search, category filters, empty results and reset work together`,()=>{
  const guide=createGuide({locale});let tree=guide.render();
  guide.find(tree,n=>n.type==='input').props.onChange({target:{value:locale==='lt'?'Puckoriu':'Puckoriai'}});tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith(`/${locale}/places/puckoriai-outcrop`)));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children===(locale==='lt'?'Pilys ir dvarai':'Castles')));tree=guide.render();
  assert(guide.find(tree,n=>n.type==='h2'&&n.props.children===(locale==='lt'?'Vietų nerasta.':'No places found.')));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children===(locale==='lt'?'Rodyti visas vietas':'Show all places')));tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith(`/${locale}/places/trakai-island-castle`)));
 });
 test(`${locale}: city, selected marker, destination and browser back preserve context`,()=>{
  const guide=createGuide({locale,initialPath:`/${locale}`});let tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children?.[0]?.props?.children==='Vilnius'));tree=guide.render();
  let map=guide.find(tree,n=>n.type?.name==='MapStub');assert(map.props.places.length>15);assert(map.props.places.every(place=>place.cityId==='vilnius'));
  map.props.onSelect('vilnius-old-town');tree=guide.render();
  assert(guide.find(tree,n=>n.type==='h2'&&n.props.children===(locale==='lt'?'Vilniaus senamiestis':'Vilnius Old Town')));
  guide.click(guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith(`/${locale}/places/vilnius-old-town`)));tree=guide.render();
  assert(guide.url().includes('city=vilnius')&&guide.url().includes('from=map'));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children?.[1]===(locale==='lt'?'Grįžti į paiešką':'Back to Explore')));tree=guide.render();
  map=guide.find(tree,n=>n.type?.name==='MapStub');assert.equal(map.props.focusedSlug,'vilnius-old-town');
  guide.pop(`/${locale}?city=kaunas&map=all`);tree=guide.render();assert(guide.find(tree,n=>n.type?.name==='MapStub').props.places.every(place=>place.cityId==='kaunas'));
 });
 test(`${locale}: food shortcut exposes seven sourced venues with working details and directions`,()=>{
  const guide=createGuide({locale,initialPath:`/${locale}?q=Trakai&city=trakai&map=all`});let tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children===(locale==='lt'?'Kur pavalgyti':'Where to eat')));tree=guide.render();
  const map=guide.find(tree,n=>n.type?.name==='MapStub');assert.equal(map.props.places.length,7);assert(map.props.places.every(place=>place.category==='restaurants'));assert(!guide.url().includes('q='));
  map.props.onSelect('lokys-restaurant');tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith(`/${locale}/places/lokys-restaurant`)));tree=guide.render();
  const directions=guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith('https://www.google.com/maps/dir/'));
  assert(new URL(directions.props.href).searchParams.get('destination').includes('Stiklių g. 8'));
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href==='https://lokys.lt/en/'));
  assert(!guide.find(tree,n=>n.type==='dialog'&&n.props['data-gallery']),'venues without licensed photography must not have a fake gallery');
 });
 test(`${locale}: locating a bilingual search result dismisses the result overlay`,()=>{
  const guide=createGuide({locale,initialPath:`/${locale}`});let tree=guide.render();
  guide.find(tree,n=>n.type==='input').props.onChange({target:{value:'Trakai'}});tree=guide.render();
  assert(guide.find(tree,n=>n.type==='ul'&&n.props['aria-label']===(locale==='lt'?'Rastos vietos':'Matching places')));
  const locator=guide.find(tree,n=>n.type==='button'&&n.props['aria-label']===(locale==='lt'?'Rodyti žemėlapyje: Trakų salos pilis':'Locate Trakai Island Castle on the map'));
  guide.click(locator);tree=guide.render();assert(!guide.find(tree,n=>n.type==='ul'&&n.props['aria-label']===(locale==='lt'?'Rastos vietos':'Matching places')));
  assert(guide.url().includes('q=Trakai')&&guide.url().includes('map=trakai-island-castle'));
 });
}

test('language links retain destination, selected pin, search and filter state',()=>{
 const guide=createGuide({initialPath:'/en/places/trakai-island-castle?q=Trakai&city=trakai&from=map'});const tree=guide.render();
 const link=guide.find(tree,n=>n.type==='a'&&n.props.hrefLang==='lt');
 assert.equal(link.props.href,'/lt/places/trakai-island-castle?q=Trakai&city=trakai&from=map');
 const mapGuide=createGuide({locale:'lt',initialPath:'/lt?q=Vilnius&map=vilnius-old-town&category=cities'});
 assert.equal(mapGuide.find(mapGuide.render(),n=>n.type==='a'&&n.props.hrefLang==='en').props.href,'/en?q=Vilnius&map=vilnius-old-town&category=cities');
});

test('destination browsing retains normal links and no book keyboard or swipe navigation',()=>{
 const guide=createGuide({initialSlug:'trakai-island-castle'});let tree=guide.render();
 guide.key('ArrowRight');assert.equal(guide.url(),'/en/places/trakai-island-castle');
 const main=guide.find(tree,n=>n.type==='main');assert.equal(main.props.onTouchStart,undefined);assert.equal(main.props.onTouchEnd,undefined);
 guide.click(guide.find(tree,n=>n.props['aria-label']==='Next place'));assert.equal(guide.url(),'/en/places/vilnius-old-town?from=map');
 tree=guide.render();assert(!guide.find(tree,n=>n.props.href?.includes('/journal')));
 const list=createGuide();tree=list.render();list.click(list.find(tree,n=>n.type==='a'&&n.props.href?.startsWith('/en/places/trakai-island-castle')),{ctrlKey:true});assert.equal(list.url(),'/en?view=places');
});

for(const locale of ['en','lt'])for(const initialPath of ['/'+locale,'/'+locale+'?view=places','/'+locale+'/places/trakai-island-castle'])test(locale+': useful links dismiss consistently from '+initialPath,()=>{
 const guide=createGuide({locale,initialPath});let tree=guide.render();
 const trigger=()=>guide.find(tree,n=>n.type==='button'&&n.props['aria-controls']==='travel-essentials');
 const panel=()=>guide.find(tree,n=>n.props.id==='travel-essentials');
 guide.click(trigger());tree=guide.render();assert(trigger().props['aria-expanded']);assert(panel().props.ref.current.open);assert.equal(guide.document.body.style.overflow,'hidden');
 assert.equal(guide.all(panel(),n=>n.type==='a').length,5);
 const close=guide.find(panel(),n=>n.props['aria-label']===(locale==='lt'?'Uždaryti kelionės informaciją':'Close travel essentials'));
 assert(guide.find(close,n=>n.type==='span'&&n.props.children===(locale==='lt'?'Uždaryti':'Close')),'dismissal must have a visible localized label');
 guide.click(guide.find(panel(),n=>n.props['aria-label']===(locale==='lt'?'Uždaryti kelionės informaciją':'Close travel essentials')));tree=guide.render();assert(!panel().props.ref.current.open);assert(!trigger().props['aria-expanded']);
 guide.click(trigger());tree=guide.render();panel().props.onCancel();tree=guide.render();assert(!panel().props.ref.current.open);
 guide.click(trigger());tree=guide.render();const element=panel().props.ref.current;
 panel().props.onClick({target:element,currentTarget:element,clientX:35,clientY:35});tree=guide.render();assert(panel().props.ref.current.open,'inside padding must not dismiss');
 panel().props.onClick({target:element,currentTarget:element,clientX:5,clientY:5});tree=guide.render();assert(!panel().props.ref.current.open,'backdrop must dismiss');
 guide.click(trigger());tree=guide.render();guide.pop('/'+locale+'?city=vilnius&map=all');tree=guide.render();assert(!panel().props.ref.current.open,'browser back dismisses stale panels');
});

test('photograph padding stays open, backdrop dismisses and body scrolling restores',()=>{
 const guide=createGuide({initialSlug:'trakai-island-castle'});let tree=guide.render();
 guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children?.[0]==='View full photograph'));tree=guide.render();
 const panel=()=>guide.find(tree,n=>n.type==='dialog'&&n.props['data-gallery']);const element=panel().props.ref.current;
 assert(element.open);assert.equal(guide.document.body.style.overflow,'hidden');
 panel().props.onClick({target:element,currentTarget:element,clientX:35,clientY:35});tree=guide.render();assert(element.open);
 panel().props.onClick({target:element,currentTarget:element,clientX:5,clientY:5});tree=guide.render();assert(!element.open);assert.notEqual(guide.document.body.style.overflow,'hidden');
});

for(const locale of ['en','lt'])test(locale+': ordered route survives discovery, language switching and browser history',()=>{
 const guide=createGuide({locale,initialSlug:'trakai-island-castle'});let tree=guide.render();
 guide.click(guide.find(tree,n=>n.type==='button'&&n.props['aria-label']?.startsWith(locale==='lt'?'Pridėti į maršrutą:':'Add to route:')));tree=guide.render();
 assert.equal(new URL(guide.url(),'http://localhost').searchParams.get('route'),'trakai-island-castle');
 guide.click(guide.find(tree,n=>n.props['aria-label']===(locale==='lt'?'Kita vieta':'Next place')));tree=guide.render();
 guide.click(guide.find(tree,n=>n.props['aria-label']?.startsWith(locale==='lt'?'Pridėti į maršrutą:':'Add to route:')));tree=guide.render();
 let planner=guide.find(tree,n=>n.type?.name==='PlannerStub');assert.equal(planner.props.stops.length,2);
 const original=guide.url();planner.props.onChange(['vilnius-old-town','trakai-island-castle']);tree=guide.render();
 assert(guide.find(tree,n=>n.props.hrefLang===(locale==='lt'?'en':'lt')).props.href.includes('route=vilnius-old-town%2Ctrakai-island-castle'));
 planner=guide.find(tree,n=>n.type?.name==='PlannerStub');planner.props.onViewMap();tree=guide.render();
 const map=guide.find(tree,n=>n.type?.name==='MapStub');assert.equal(map.props.routePlaces[0].slug,'vilnius-old-town');assert(map.props.fitRouteRequest>0);
 guide.pop(original);tree=guide.render();assert.equal(guide.find(tree,n=>n.type?.name==='PlannerStub').props.stops[0].slug,'trakai-island-castle');
 assert(!guide.find(tree,n=>n.props['aria-label']?.startsWith('Save ')));
});
