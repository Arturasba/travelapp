import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function createGuide({ initialSlug, reduced = true } = {}) {
  const states=[],refs=[],effects=[],timers=[],listeners=new Map();
  let stateIndex,refIndex,effectIndex;
  const url = new URL(initialSlug ? `/places/${initialSlug}` : '/', 'http://localhost');
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
    exports:{},URLSearchParams,Event,HTMLElement:class{},
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
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href==='/places/puckoriai-outcrop'));
  assert(!guide.find(tree,n=>n.type==='a'&&n.props.href==='/places/trakai-island-castle'));
  guide.find(tree,n=>n.type==='select'&&n.props['aria-label']==='Category').props.onChange({target:{value:'castles'}});
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='h2'&&n.props.children==='No places found.'));
  guide.click(guide.find(tree,n=>n.type==='button'&&n.props.children==='Show all places'));
  tree=guide.render();
  assert(guide.find(tree,n=>n.type==='a'&&n.props.href==='/places/trakai-island-castle'));
});
test('destination links, previous/next controls and keyboard update shareable URLs',()=>{
  const guide=createGuide();let tree=guide.render();
  guide.click(guide.find(tree,n=>n.type==='a'&&n.props.href==='/places/trakai-island-castle'));
  assert.equal(guide.url(),'/places/trakai-island-castle');
  tree=guide.render();
  assert(guide.find(tree,n=>n.props?.['aria-label']==='Previous page').props.disabled);
  guide.click(guide.find(tree,n=>n.props?.['aria-label']==='Next page'));
  assert.equal(guide.url(),'/places/vilnius-old-town');
  tree=guide.render();guide.key('ArrowLeft');
  assert.equal(guide.url(),'/places/trakai-island-castle');
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
  assert.equal(guide.url(),'/places/nida');
  guide.pop('/');tree=guide.render();
  assert(guide.find(tree,n=>n.type==='input'&&n.props.id==='destination-search'));
});
test('rapid page clicks lock during animation and normal links retain modifier behavior',()=>{
  const guide=createGuide({initialSlug:'trakai-island-castle',reduced:false});let tree=guide.render();
  const next=guide.find(tree,n=>n.props?.['aria-label']==='Next page');
  guide.click(next);guide.click(next);
  assert.equal(guide.url(),'/places/vilnius-old-town');
  tree=guide.render();assert(guide.find(tree,n=>n.props?.['aria-label']==='Next page').props.disabled);
  guide.finish();tree=guide.render();assert(!guide.find(tree,n=>n.props?.['aria-label']==='Next page').props.disabled);
  const first=createGuide();tree=first.render();
  first.click(first.find(tree,n=>n.type==='a'&&n.props.href==='/places/trakai-island-castle'),{ctrlKey:true});
  assert.equal(first.url(),'/');
});
test('horizontal swipes navigate while vertical gestures stay on the current destination',()=>{
  const guide=createGuide({initialSlug:'trakai-island-castle'});let tree=guide.render();
  const main=guide.find(tree,n=>n.type==='main');
  main.props.onTouchStart({touches:[{clientX:200,clientY:100}],target:null});
  main.props.onTouchEnd({preventDefault(){},changedTouches:[{clientX:60,clientY:102}]});
  assert.equal(guide.url(),'/places/vilnius-old-town');
  tree=guide.render();const nextMain=guide.find(tree,n=>n.type==='main');
  nextMain.props.onTouchStart({touches:[{clientX:100,clientY:100}],target:null});
  nextMain.props.onTouchEnd({preventDefault(){},changedTouches:[{clientX:90,clientY:300}]});
  assert.equal(guide.url(),'/places/vilnius-old-town');
});

