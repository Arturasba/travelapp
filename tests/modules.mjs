import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
export const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const cache=new Map();
export function loadModule(file){
  file=path.resolve(file);
  if(cache.has(file))return cache.get(file);
  if(file.endsWith('.json')){const value=JSON.parse(fs.readFileSync(file,'utf8'));cache.set(file,value);return value;}
  const scope={exports:{},URLSearchParams,require:name=>{if(!name.startsWith('.'))throw Error('Unexpected external module '+name);let target=path.resolve(path.dirname(file),name);if(!path.extname(target))target+='.ts';return loadModule(target);}};
  cache.set(file,scope.exports);vm.runInNewContext(compile(file),scope);return scope.exports;
}
