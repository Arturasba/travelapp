import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compile,loadModule} from './modules.mjs';
const planner=loadModule('app/route-planner.ts');
const {getDestination,destinations}=loadModule('app/destinations.ts');

test('shared routes validate IDs, remove duplicates and respect the mobile waypoint limit',()=>{
 const slugs=destinations.slice(0,7).map(place=>place.slug);
 const route=planner.readRoute('/lt?route=invalid,'+slugs[0]+','+slugs.join(','));
 assert.deepEqual(Array.from(route),Array.from(slugs.slice(0,5)));
 const url=planner.withRoute('/lt?city=vilnius&q=pilis&map=all',slugs);
 assert.equal(new URL(url,'http://localhost').searchParams.get('city'),'vilnius');
 assert.equal(planner.readRoute(url).length,5);
 assert.equal(planner.withRoute('/en?route='+slugs[0]+'&q=castle',[]),'/en?q=castle');
 assert.equal(planner.readRoute('/en?route=%3Cscript%3E').length,0);
});
test('ordered driving/walking directions preserve intermediate stops and venue addresses',()=>{
 const stops=['vilnius-old-town','neringa-restaurant','trakai-island-castle'].map(getDestination);
 const url=new URL(planner.routeDirectionsUrl(stops,'walking'));
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('api'),'1');
 assert.equal(url.searchParams.get('origin'),stops[0].coordinates.join(','));
 assert.equal(url.searchParams.get('destination'),stops[2].coordinates.join(','));
 assert.equal(url.searchParams.get('waypoints'),'Gedimino pr. 23, Vilnius, Lithuania');
 assert.equal(url.searchParams.get('travelmode'),'walking');
 assert.equal(planner.routeDirectionsUrl(stops.slice(0,1)),null);
 assert.equal(planner.routeDirectionsUrl(destinations.slice(0,6)),null);
 const moved=planner.moveRouteStop(stops.map(p=>p.slug),1,-1);
 assert.equal(moved[0],'neringa-restaurant');assert.equal(stops[0].slug,'vilnius-old-town');
 assert.deepEqual(Array.from(planner.moveRouteStop(moved,0,-1)),Array.from(moved));
});

function createPanel(locale='en',initial=[]){
 const states=[],effects=[],refs=[];let stateIndex,refIndex,effectIndex,stops=initial,open=true,viewed=false;
 const jsx=(type,props)=>({type,props});const css=new Proxy({},{get:(_,key)=>String(key)});
 const react={useState(initial){const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useRef(initial){return refs[refIndex++]??={current:initial};},useMemo:fn=>fn(),useEffect(callback,deps){const i=effectIndex++;const old=effects[i];if(!old||deps.some((v,j)=>old.deps[j]!==v)){old?.cleanup?.();effects[i]={callback,deps};}}};
 const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}};
 const document={body:{style:{overflow:'auto'}}};
 const scope={exports:{},document,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name.endsWith('.css')?css:name==='./locale-context'?{useLocale:()=>locale}:loadModule('app/'+name.slice(2)+'.ts')};
 vm.runInNewContext(compile('app/route-planner-panel.tsx'),scope);
 const walk=node=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(walk)]:[];
 return{dialog,document,render(){stateIndex=refIndex=effectIndex=0;const tree=scope.exports.default({open,stops:stops.map(getDestination),onChange:ids=>{stops=ids;},onClose:()=>{open=false;},onViewMap:()=>{viewed=true;}});tree.props.ref.current=dialog;for(const effect of effects)if(effect.callback){effect.cleanup=effect.callback();effect.callback=null;}return tree;},find:(tree,p)=>walk(tree).find(p),click(node){assert(node);assert(!node.props.disabled);node.props.onClick({});},ids:()=>stops,viewed:()=>viewed};
}
for(const locale of ['en','lt'])test(`${locale}: planner searches, adds, reorders, removes, exports and closes accessibly`,()=>{
 const ui=createPanel(locale,['trakai-island-castle']);let tree=ui.render();
 assert(ui.dialog.open);assert.equal(ui.document.body.style.overflow,'hidden');
 ui.find(tree,n=>n.type==='input').props.onChange({target:{value:'Neringa'}});tree=ui.render();
 ui.click(ui.find(tree,n=>n.props['aria-label']?.endsWith(': Neringa')));tree=ui.render();
 assert.deepEqual(Array.from(ui.ids()),['trakai-island-castle','neringa-restaurant']);
 ui.click(ui.find(tree,n=>n.props['aria-label']===(locale==='lt'?'Perkelti aukščiau: Neringa':'Move earlier: Neringa')));tree=ui.render();
 assert.equal(ui.ids()[0],'neringa-restaurant');
 ui.click(ui.find(tree,n=>n.type==='button'&&n.props.children===(locale==='lt'?'Pėsčiomis':'Walking')));tree=ui.render();
 assert.equal(new URL(ui.find(tree,n=>n.type==='a').props.href).searchParams.get('travelmode'),'walking');
 ui.click(ui.find(tree,n=>n.type==='button'&&n.props.children===(locale==='lt'?'Rodyti maršrutą žemėlapyje':'View route on map')));assert(ui.viewed());
 ui.click(ui.find(tree,n=>n.props['aria-label']===(locale==='lt'?'Pašalinti stotelę: Neringa':'Remove stop: Neringa')));tree=ui.render();assert.equal(ui.ids().length,1);
 ui.click(ui.find(tree,n=>n.props['aria-label']===(locale==='lt'?'Uždaryti maršruto planavimą':'Close route planner')));ui.render();assert(!ui.dialog.open);assert.equal(ui.document.body.style.overflow,'auto');
});
test('full routes block additional stops without losing the chosen itinerary',()=>{
 const ids=destinations.slice(0,5).map(p=>p.slug),ui=createPanel('en',ids);let tree=ui.render();
 ui.find(tree,n=>n.type==='input').props.onChange({target:{value:'Neringa'}});tree=ui.render();
 assert(ui.find(tree,n=>n.props['aria-label']==='Add to route: Neringa').props.disabled);
 assert.deepEqual(ui.ids(),ids);
});
