import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compile} from './modules.mjs';

function harness(){
 const refs=[],effects=[];let refIndex,effectIndex;
 const document={body:{style:{overflow:'auto'}}};
 const react={useRef(initial){return refs[refIndex++]??={current:initial};},useEffect(callback,deps){const i=effectIndex++,old=effects[i];if(!old||deps.some((v,j)=>old.deps[j]!==v)){old?.cleanup?.();effects[i]={callback,deps};}}};
 const scope={exports:{},document,require:()=>react};vm.runInNewContext(compile('app/use-dialog.ts'),scope);
 const elements=[0,1].map(()=>({open:false,shows:0,closes:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;this.closes++;}}));
 return{elements,document,helpers:scope.exports,render(values){refIndex=effectIndex=0;values.forEach((value,index)=>{scope.exports.useDialog(value).current=elements[index];});for(const effect of effects)if(effect.callback){effect.setup=effect.callback;effect.cleanup=effect.callback();effect.callback=null;}},replay(){for(const effect of effects)effect.cleanup?.();for(const effect of effects)effect.cleanup=effect.setup();}};
}
test('modal lifecycle survives Strict Mode without queuing a stale native close',()=>{
 const ui=harness();ui.render([true]);assert(ui.elements[0].open);assert.equal(ui.document.body.style.overflow,'hidden');
 ui.replay();assert.equal(ui.elements[0].shows,1);assert.equal(ui.elements[0].closes,0);assert.equal(ui.document.body.style.overflow,'hidden');
 ui.render([false]);assert(!ui.elements[0].open);assert.equal(ui.elements[0].closes,1);assert.equal(ui.document.body.style.overflow,'auto');
 ui.render([true]);assert(ui.elements[0].open);assert.equal(ui.elements[0].shows,2);
 ui.render([false]);
});
test('switching overlays retains the scroll lock until the last modal closes',()=>{
 const ui=harness();ui.render([true,false]);ui.render([true,true]);ui.render([false,true]);
 assert.equal(ui.document.body.style.overflow,'hidden');assert(!ui.elements[0].open&&ui.elements[1].open);
 ui.render([false,false]);assert.equal(ui.document.body.style.overflow,'auto');
});
test('backdrop detection excludes dialog padding and child content',()=>{
 const {isDialogBackdrop}=harness().helpers;
 const dialog={getBoundingClientRect:()=>({left:20,right:300,top:20,bottom:400})};
 assert(!isDialogBackdrop({target:dialog,currentTarget:dialog,clientX:30,clientY:30}));
 assert(!isDialogBackdrop({target:{},currentTarget:dialog,clientX:10,clientY:10}));
 assert(isDialogBackdrop({target:dialog,currentTarget:dialog,clientX:10,clientY:30}));
 assert(isDialogBackdrop({target:dialog,currentTarget:dialog,clientX:30,clientY:410}));
});
