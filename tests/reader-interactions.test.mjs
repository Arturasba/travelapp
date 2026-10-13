import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the component's event handlers without adding a test-only browser dependency.
// Layout/CSS is separately verified against the actual development server.
function createReader({ mobile = false, reduced = false, initialPath = "/journal" } = {}) {
  const url = new URL(initialPath, "http://localhost");
  const events = { addEventListener(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); }, removeEventListener(event, fn) { listeners.get(event)?.delete(fn); }, dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); } };
  const states = [], refs = [], effects = [], timers = [], listeners = new Map();
  let stateIndex, refIndex, effectIndex;
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useCallback(callback) { return callback; },
    useSyncExternalStore(_subscribe, snapshot) { return snapshot(); },
    useEffect(callback, deps) {
      const index = effectIndex++;
      const previous = effects[index];
      if (!previous || deps.some((value, i) => previous.deps[i] !== value)) {
        previous?.cleanup?.();
        effects[index] = { deps, callback };
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const runtime = { jsx, jsxs: jsx, Fragment: 'fragment' };
  const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const navigation = { exports: {} };
  vm.runInNewContext(compile('app/book-navigation.ts'), navigation);
  const data = { exports: {}, require: () => ({ src: '/test.jpg' }) };
  vm.runInNewContext(compile('app/book-data.ts'), data);
  const scope = {
    exports: {}, HTMLElement: class {}, URL, URLSearchParams, Event,
    window: { ...events, location: url, history: { pushState(_state,_unused,path) { url.href = new URL(path, url).href; } }, matchMedia: query => ({ matches: query.includes("prefers-reduced-motion") ? reduced : mobile }) },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? runtime : name === './book-navigation' ? navigation.exports : name === './book-data' ? data.exports : name === './guide-navigation' ? { exploreReturnUrl: value => value?.startsWith('/?') ? value : '/' } : {},
  };
  vm.runInNewContext(compile('app/travel-journal.tsx'), scope);
  const render = () => {
    stateIndex = refIndex = effectIndex = 0;
    const tree = scope.exports.default();
    for (const effect of effects) if (effect.callback) { effect.cleanup = effect.callback(); effect.callback = null; }
    return tree;
  };
  const walk = node => {
    if (!node || typeof node !== 'object') return [];
    const children = node.props?.children;
    return [node, ...(Array.isArray(children) ? children.flat(Infinity) : [children]).flatMap(walk)];
  };
  return {
    render,
    find: (tree, label) => walk(tree).find(node => node.props?.['aria-label'] === label),
    chapter: (tree, index) => walk(tree).filter(node => node.type === 'button' && 'aria-current' in node.props)[index],
    main: tree => walk(tree).find(node => node.type === 'main'),
    finish: () => { while (timers.length) timers.shift()(); },
    key: key => events.dispatchEvent({ type: 'keydown', key, target: null, preventDefault() {} }),
    page: () => Number(url.searchParams.get("page") ?? 0),
    url: () => url.pathname + url.search,
    pop: path => { url.href = new URL(path, url).href; events.dispatchEvent({ type: "popstate" }); },
    link: tree => walk(tree).find(node => node.props?.children === "\u2190 Back to Explore"),
    turning: () => states[0],
  };
}

test('visible controls and chapter menu navigate real reader state with a rapid-click lock', () => {
  const reader = createReader();
  let tree = reader.render();
  assert(reader.find(tree, 'Previous page').props.disabled);
  const next = reader.find(tree, 'Next page').props.onClick;
  next(); next();
  assert.equal(reader.page(), 2);
  tree = reader.render();
  assert(reader.find(tree, 'Next page').props.disabled);
  reader.finish(); tree = reader.render();
  reader.chapter(tree, 4).props.onClick();
  assert.equal(reader.page(), 8);
  reader.finish(); tree = reader.render();
  assert(reader.find(tree, 'Next page').props.disabled);
  reader.find(tree, 'Previous page').props.onClick();
  assert.equal(reader.page(), 6);
});

test('global keyboard works before focus and respects the first and last pages', () => {
  const reader = createReader({ reduced: true });
  reader.render();
  reader.key('ArrowLeft'); assert.equal(reader.page(), 0);
  reader.key('ArrowRight'); assert.equal(reader.page(), 2);
  reader.key('End'); assert.equal(reader.page(), 8);
  reader.key('ArrowRight'); assert.equal(reader.page(), 8);
  reader.key('Home'); assert.equal(reader.page(), 0);
  assert.equal(reader.turning(), null);
});

test('mobile swipes turn individual pages and vertical scrolling does not change pages', () => {
  const reader = createReader({ mobile: true, reduced: true });
  let tree = reader.render();
  reader.find(tree, 'Next page').props.onClick();
  assert.equal(reader.page(), 1);
  tree = reader.render();
  const main = reader.main(tree);
  main.props.onTouchStart({ touches: [{ clientX: 200, clientY: 100 }] });
  main.props.onTouchEnd({ changedTouches: [{ clientX: 70, clientY: 105 }] });
  assert.equal(reader.page(), 2);
  tree = reader.render();
  const nextMain = reader.main(tree);
  nextMain.props.onTouchStart({ touches: [{ clientX: 100, clientY: 100 }] });
  nextMain.props.onTouchEnd({ changedTouches: [{ clientX: 90, clientY: 250 }] });
  assert.equal(reader.page(), 2);
  reader.key('End'); assert.equal(reader.page(), 9);
});

test('journal restores shared pages, handles browser history, and retains the exploration return URL', () => {
  const returnTo = '/?city=vilnius&map=vilnius-old-town';
  const reader = createReader({ initialPath: `/journal?page=4&returnTo=${encodeURIComponent(returnTo)}` });
  let tree = reader.render();
  assert.equal(reader.page(), 4);
  assert.equal(reader.link(tree).props.href, returnTo);
  reader.find(tree, 'Next page').props.onClick();
  assert.equal(reader.page(), 6);
  reader.pop(`/journal?page=4&returnTo=${encodeURIComponent(returnTo)}`);
  tree = reader.render();
  assert.equal(reader.turning(), null);
  assert.equal(reader.page(), 4);
  assert.equal(reader.link(tree).props.href, returnTo);
  reader.key('ArrowLeft');
  assert.equal(reader.page(), 2);
});
