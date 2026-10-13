import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function createGuide({ initialSlug, initialPath = "/?view=places", reduced = true } = {}) {
  const states=[],refs=[],effects=[],timers=[],listeners=new Map();
  let stateIndex,refIndex,effectIndex;
  const url = new URL(initialSlug ? `/places/${initialSlug}` : initialPath, 'http://localhost');
  const events = {
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},
  };
  const react={
    useState(initial){const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=refIndex++;return refs[i]||=( {current:initial} );},
    useCallback:callback=>callback, useMemo:callback=>callback(),
    useSyncExternalStore:(_subscribe,snapshot)=>snapshot(),
    useEffect(callback,deps){const i=effectIndex++;const old=effects[i];if(!old||!deps||deps.some((d,j)=>old.deps[j]!==d)){old?.cleanup?.();effects[i]={callback,deps};}},
  };
  const jsx=(type,props)=>({type,props});
  const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const data={exports:{},require:()=>JSON.parse(fs.readFileSync('app/data/destination-assets.json','utf8'))};
  vm.runInNewContext(compile('app/destinations.ts'),data);
  const navigation={exports:{},URLSearchParams,require:()=>data.exports};
  vm.runInNewContext(compile('app/guide-navigation.ts'),navigation);
  const css=new Proxy({},{get:(_target,key)=>key==='__esModule'?false:String(key)});
  const scope={
    exports:{},URLSearchParams,Event,HTMLElement:class{},document:{title:""},
    window:{...events,location:url,matchMedia:query=>({matches:query.includes('prefers-reduced-motion')?reduced:false}),history:{pushState(_state,_unused,path){url.href=new URL(path,url).href;},replaceState(_state,_unused,path){url.href=new URL(path,url).href;}}},
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:name==='./destinations'?data.exports:name==='./guide-navigation'?navigation.exports:name==='next/dynamic'?()=>function MapStub(){}:name.endsWith('.css')?css:()=>null,
  };
  vm.runInNewContext(compile('app/discovery-guide.tsx'),scope);
  const walk=node=>{if(!node||typeof node!=='object')return[];const children=node.props?.children;return[node,...(Array.isArray(children)?children.flat(Infinity):[children]).flatMap(walk)];};
  const render=()=>{stateIndex=refIndex=effectIndex=0;const tree=scope.exports.default({initialSlug});for(const effect of effects)if(effect.callback){effect.cleanup=effect.callback();effect.callback=null;}return tree;};
  const click=(node,extra={})=>node.props.onClick({button:0,preventDefault(){},...extra});
  return{ render,click,find:(tree,predicate)=>walk(tree).find(predicate),all:(tree,predicate)=>walk(tree).filter(predicate),url:()=>url.pathname+url.search,finish:()=>{while(timers.length)timers.shift()();},key:key=>events.dispatchEvent({type:'keydown',key,target:null,preventDefault(){}}),pop:path=>{url.href=new URL(path,url).href;events.dispatchEvent({type:'popstate'});} };
}

test('search and category filters update the discovery index, including empty results',()=>{
  const guide=createGuide();let tree=guide.render();
  guide.find(tree,n=>n.type==='input').props.onChange({target:{value:'Puckoriai'}});
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/puckoriai-outcrop')));
  assert(!guide.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/trakai-island-castle')));
  guide.find(tree,n=>n.type==='select'&&n.props['aria-label']==='Category').props.onChange({target:{value:'castles'}});
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='h2'&&n.props.children==='No places found.'));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Show all places'));
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/trakai-island-castle')));
});
test('destination links, previous/next controls and keyboard update shareable URLs',()=>{
  const guide=createGuide();let tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/trakai-island-castle')));
  assert.equal(guide.url(),'/places/trakai-island-castle?from=places');
  tree=guide.render();
  assert(guide.find(tree,n=>n.props?.['aria-label']==='Previous place').props.disabled);
  guide.click(guide.find(tree,n=>n.props?.['aria-label']==='Next place'));
  assert.equal(guide.url(),'/places/vilnius-old-town?from=places');
  tree=guide.render();guide.key('ArrowLeft');
  assert.equal(guide.url(),'/places/trakai-island-castle?from=places');
});
test('map focus follows new marker selections and the popup opens a destination',()=>{
  const guide=createGuide({initialSlug:'trakai-island-castle'});let tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Show on map'));
  assert.equal(guide.url(),'/?map=trakai-island-castle');
  tree=guide.render();let map=guide.find(tree,n=>n.type?.name==='MapStub');
  assert.equal(map.props.focusedSlug,'trakai-island-castle');
  map.props.onSelect('nida');
  tree=guide.render();map=guide.find(tree,n=>n.type?.name==='MapStub');
  assert.equal(map.props.focusedSlug,'nida');
  map.props.onOpen('nida');
  assert.equal(guide.url(),'/places/nida?from=map');
  guide.pop('/');tree=guide.render();
  assert(guide.find(tree,n=>n.type==='input'&&n.props.id==='destination-search'));
});
test('rapid page clicks lock during animation and normal links retain modifier behavior',()=>{
  const guide=createGuide({initialSlug:'trakai-island-castle',reduced:false});let tree=guide.render();
  const next=guide.find(tree,n=>n.props?.['aria-label']==='Next place');
  guide.click(next);guide.click(next);
  assert.equal(guide.url(),'/places/vilnius-old-town?from=map');
  tree=guide.render();assert(guide.find(tree,n=>n.props?.['aria-label']==='Next place').props.disabled);
  guide.finish();tree=guide.render();assert(!guide.find(tree,n=>n.props?.['aria-label']==='Next place').props.disabled);
  const first=createGuide();tree=first.render();
  first.click(first.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/trakai-island-castle')),{ctrlKey:true});
  assert.equal(first.url(),'/?view=places');
});
test('horizontal swipes navigate while vertical gestures stay on the current destination',()=>{
  const guide=createGuide({initialSlug:'trakai-island-castle'});let tree=guide.render();
  const main=guide.find(tree,n=>n.type==='main');
  main.props.onTouchStart({touches:[{clientX:200,clientY:100}],target:null});
  main.props.onTouchEnd({preventDefault(){},changedTouches:[{clientX:60,clientY:102}]});
  assert.equal(guide.url(),'/places/vilnius-old-town?from=map');
  tree=guide.render();const nextMain=guide.find(tree,n=>n.type==='main');
  nextMain.props.onTouchStart({touches:[{clientX:100,clientY:100}],target:null});
  nextMain.props.onTouchEnd({preventDefault(){},changedTouches:[{clientX:90,clientY:300}]});
  assert.equal(guide.url(),'/places/vilnius-old-town?from=map');
});



test('every requested town is a working filter with real results and map/list context is preserved',()=>{
  const names=['Vilnius','Kaunas','Klaipėda','Šiauliai','Trakai','Druskininkai','Nida','Palanga'];
  for(const name of names){
    const guide=createGuide();let tree=guide.render();
    const button=guide.find(tree,n=>n.type==='button'&&n.props.children?.[0]?.props?.children===name);
    assert(button,`missing sidebar location ${name}`);
    guide.click(button);tree=guide.render();
    assert(guide.url().includes('city='));
    const links=guide.all(tree,n=>n.type==='a'&&n.props.href?.startsWith('/places/'));
    assert(links.length>0,`${name} must never open an empty city filter`);
    assert(!guide.find(tree,n=>n.props.className?.includes('turnSurface')),'city filters must be immediate');
    guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Explore the map'));
    assert(guide.url().includes('city=')&&guide.url().includes('map=all'));
    tree=guide.render();
    const map=guide.find(tree,n=>n.type?.name==='MapStub');
    assert(map.props.places.length>0);
    guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Browse places'));
    assert(guide.url().includes('city=')&&!guide.url().includes('map='));
  }
});
test('directions use the actual destination pin and discovery has no page-turn controls',()=>{
  const guide=createGuide();let tree=guide.render();
  assert(!guide.find(tree,n=>n.props?.['aria-label']==='Next place'));
  guide.click(guide.find(tree,n=>n.type==='a'&&n.props.href.startsWith('/places/trakai-island-castle')));
  tree=guide.render();
  const directions=guide.find(tree,n=>n.type==='a'&&n.props.children==='Get directions ↗');
  const url=new URL(directions.props.href);
  assert.equal(url.searchParams.get('api'),'1');
  assert(url.searchParams.get('destination').startsWith('54.6525,'));
});

test('homepage opens the atlas; search, city results, destination return, and journal keep context',()=>{
  const guide=createGuide({initialPath:'/'});let tree=guide.render();
  assert(guide.find(tree,n=>n.type?.name==='MapStub'));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children?.[0]?.props?.children==='Vilnius'));
  tree=guide.render();
  let map=guide.find(tree,n=>n.type?.name==='MapStub');
  assert.equal(map.props.places.length,3);
  map.props.onOpen('vilnius-old-town');tree=guide.render();
  const back=guide.find(tree,n=>n.type==='button'&&n.props.children==='\u2190 Back to Explore');
  guide.click(back);tree=guide.render();
  assert(guide.url().includes('city=vilnius')&&guide.url().includes('map=vilnius-old-town'));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Clear filters \u00d7'));
  tree=guide.render();guide.find(tree,n=>n.type==='input').props.onChange({target:{value:'Trakai'}});
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href?.startsWith('/places/trakai-island-castle')));
  map=guide.find(tree,n=>n.type?.name==='MapStub');
  assert(map.props.places.some(place=>place.slug==='trakai-island-castle'));
  const book=guide.find(tree,n=>n.props.children==='Open travel book');
  assert.equal(new URL(book.props.href,'http://localhost').searchParams.get('returnTo'),guide.url());
  guide.pop('/?city=vilnius&map=all');tree=guide.render();
  assert.equal(guide.find(tree,n=>n.type?.name==='MapStub').props.places.length,3);
});

test('map gestures never trigger destination page-turn navigation',()=>{
  const guide=createGuide({initialPath:'/?map=all'});const tree=guide.render();
  const main=guide.find(tree,n=>n.type==='main');
  main.props.onTouchStart({touches:[{clientX:220,clientY:100}],target:null});
  main.props.onTouchEnd({changedTouches:[{clientX:50,clientY:105}],preventDefault(){assert.fail('map swipes must remain native');}});
  guide.key('ArrowRight');
  assert.equal(guide.url(),'/?map=all');
});
