import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {loadModule} from './modules.mjs';

// Exercise Leaflet integration and lifecycle, without claiming browser gesture QA.
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target:ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const clusters={exports:{}};vm.runInNewContext(compile('app/map-clusters.ts'),clusters);
const place = { slug: 'vilnius-old-town', name: 'Vilnius Old Town', location: 'Vilnius', category: 'cities', coordinates: [54.68, 25.28], photos: [{ src: '/test.jpg', alt: 'Vilnius', author: 'Author', license: 'CC BY', source: 'https://example.org' }] };
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

function createMap(sessionStorage = storage()) {
  const refs = [], effects = [], createdMarkers = [], selected = [], opened = [], lines = [];
  const events = new Map();
  let refIndex, effectIndex, center = { lat: 55.25, lng: 23.8 }, zoom = 7, fits = 0;
  const emit = name => { for (const fn of events.get(name) ?? []) fn(); };
  const instance = {
    zoomControl:{options:{},remove(){},addTo(){}},
    setView(value, level) { center = Array.isArray(value) ? { lat: value[0], lng: value[1] } : value; zoom = level; emit('moveend'); return this; },
    fitBounds(bounds) { this.lastBounds = bounds; fits++; center = { lat: 55.2, lng: 23.8 }; zoom = 7; emit('moveend'); return this; },
    getCenter: () => center, getZoom: () => zoom,
    fire(name) { emit(name); return this; },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return this; },
    off(name, fn) { events.get(name)?.delete(fn); }, invalidateSize() {}, remove() {}, closePopup() {},
  };
  let options;
  const L = {
    map(_node, settings) { options = settings; return instance; },
    tileLayer: () => ({ addTo() { return this; }, on() {}, redraw() {} }),
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {}, remove() {} }),
    polyline(coords,options) { const line={coords,options,addTo(){return this;}};lines.push(line);return line; },
    divIcon: value => value, latLngBounds: value => value,
    DomEvent: { disableClickPropagation(node) { node.clickIsolated = true; }, disableScrollPropagation(node) { node.scrollIsolated = true; } },
    marker(coords,options) {
      const marker = { coords, options, handlers: {}, bindPopup(node, settings) { this.preview = node; this.popup = { options: settings }; return this; },
        on(name, callback) { this.handlers[name] = callback; return this; }, addTo() {}, getLatLng() { return { lat: coords[0], lng: coords[1] }; }, getPopup() { return this.popup; }, openPopup() { this.opened = true; } };
      createdMarkers.push(marker); return marker;
    },
  };
  const viewport = { exports: {}, sessionStorage };
  vm.runInNewContext(compile('app/map-viewport.ts'), viewport);
  const react = {
    useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useState(initial) { return [initial, () => {}]; },
    useEffect(callback, deps) { const index = effectIndex++; const previous = effects[index]; if (!previous || deps.some((item, i) => item !== previous.deps[i])) { previous?.cleanup?.(); effects[index] = { callback, deps }; } },
  };
  const jsx = (type, props) => ({ type, props });
  const scope = {
    exports: {}, window: { matchMedia: () => ({ matches: true }) }, ResizeObserver: class { observe() {} disconnect() {} },
    document: { createElement: tag => ({ tag, children: [], handlers: {}, append(...children) { this.children.push(...children); }, addEventListener(name, callback) { this.handlers[name] = callback; } }) },
    require: name => name === 'leaflet' ? L : name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } :
      name === 'next/image' ? { getImageProps: props => ({ props }) } : name === './map-viewport' ? viewport.exports :
      name === './i18n' ? loadModule('app/i18n.ts') : name === './map-clusters' ? clusters.exports : name === './destinations' ? { categories: [], destinations: Array(114) } : {},
  };
  vm.runInNewContext(compile('app/destination-map.tsx'), scope);
  const defaultProps = { places: [place], viewportKey: 'all', focusedSlug: null, destinationHref: slug => `/places/${slug}?city=vilnius&from=map`, onSelect: slug => selected.push(slug), onOpen: slug => opened.push(slug) };
  return {
    render(patch = {}) {
      refIndex = effectIndex = 0;
      const tree = scope.exports.default({ ...defaultProps, ...patch });
      tree.props.children[0].props.ref.current = {};
      for (const effect of effects) if (effect.callback) { effect.cleanup = effect.callback(); effect.callback = null; }
      return tree;
    },
    unmount() { for (const effect of effects) effect.cleanup?.(); },
    viewport: viewport.exports, sessionStorage, instance, markers: createdMarkers, selected, opened, lines,
    options: () => options, fits: () => fits,
  };
}

test('map enables native mouse/touch handlers, preserves gesture lifecycles, and selects a preview', () => {
  const map = createMap(); const tree = map.render();
  for (const handler of ['scrollWheelZoom', 'dragging', 'touchZoom', 'zoomControl', 'keyboard']) assert.equal(map.options()[handler], true);
  let stopped = 0;
  tree.props.onWheel({ stopPropagation() { stopped++; } });
  assert.equal(stopped, 1);
  for (const handler of ['onTouchStart', 'onTouchEnd', 'onKeyDown']) assert.equal(tree.props[handler], undefined, 'Leaflet document handlers must receive the full gesture lifecycle');
  assert.equal(tree.props.onMouseMove, undefined, 'document drag events must keep reaching Leaflet');
  const marker = map.markers[0]; marker.handlers.click();
  assert.deepEqual(map.selected, [place.slug]);
  assert.equal(marker.preview,undefined,'React owns the single preview; pins must not download another photo');
});

test('Lithuanian map controls and accessible labels are localized',()=>{
  const map=createMap();const tree=map.render({locale:'lt'});
  assert.equal(map.instance.zoomControl.options.zoomInTitle,'Priartinti');
  assert.equal(map.instance.zoomControl.options.zoomOutTitle,'Atitolinti');
  assert(tree.props.children.some(node=>node?.props?.children==='Rodyti visą Lietuvą'));
});

test('route overlay follows chosen order, keeps pins clickable and fits only on request',()=>{
  const map=createMap(),second={...place,slug:'nida',name:'Nida',coordinates:[55.3,21.0]};
  const routePlaces=[place,second];map.render({routePlaces});
  assert.equal(map.lines.length,1);assert.equal(map.lines[0].options.interactive,false);
  assert.equal(map.lines[0].options.dashArray,'6 9');
  assert.equal(map.lines[0].coords[0],place.coordinates);
  const pins=map.markers.filter(marker=>marker.options.icon.className==='route-stop-pin');
  assert.equal(pins.length,2);assert(pins[1].options.icon.html.includes('2'));
  pins[1].handlers.click();assert.equal(map.selected[0],'nida');
  const initialFits=map.fits();map.render({routePlaces});assert.equal(map.fits(),initialFits);
  map.render({routePlaces,fitRouteRequest:1});assert.equal(map.fits(),initialFits+1);
  map.render({routePlaces,fitRouteRequest:1});assert.equal(map.fits(),initialFits+1);
  map.unmount();
});

test('selected places focus once; panned camera survives rerenders and leaving exploration', () => {
  const map = createMap(); map.render({ focusedSlug: place.slug });
  assert.equal(map.instance.getZoom(), 15);
  map.instance.setView([55.8, 24.2], 9);
  const fits = map.fits(); map.render({ focusedSlug: place.slug });
  assert.equal(map.fits(), fits); assert.equal(map.instance.getZoom(), 9);
  map.unmount();
  const returned = createMap(map.sessionStorage); returned.render({ focusedSlug: place.slug });
  assert.equal(returned.instance.getZoom(), 9);
  assert.equal(returned.instance.getCenter().lat, 55.8);
  assert.equal(returned.markers[0].popup,undefined,'restoring a selection must not trigger popup autopanning');
});

test('clusters conserve every destination and expose individual pins at street level',()=>{
  const places=[place,{...place,slug:'cathedral',coordinates:[54.6801,25.2801]},{...place,slug:'coast',coordinates:[55.7,21.1]}];
  const grouped=clusters.exports.clusterPlaces(places,7);
  assert(grouped.some(group=>group.places.length===2));
  assert.equal(grouped.flatMap(group=>group.places).length,places.length);
  assert.equal(clusters.exports.clusterPlaces(places,15).length,places.length);
  const map=createMap();map.render({places});
  const fits=map.fits();map.markers[0].handlers.click();
  assert.equal(map.fits(),fits+1,'group click zooms into its destinations');
  assert.equal(map.selected.length,0,'a group is not a destination selection');
});

test('reset shows Lithuania even with filtered results; invalid/blocked storage is harmless', () => {
  const map = createMap(); const tree = map.render({ focusedSlug: place.slug });
  const reset = tree.props.children.find(node => node?.props?.children === 'Reset to Lithuania');
  reset.props.onClick();
  assert.equal(map.selected.at(-1), 'all');
  assert.deepEqual(JSON.parse(JSON.stringify(map.instance.lastBounds)), [[53.85, 20.9], [56.5, 26.9]]);
  map.sessionStorage.setItem('lithuania-atlas:map:invalid', '{"center":[999,0],"zoom":3,"focusedSlug":null}');
  assert.equal(map.viewport.readMapViewport('invalid'), null);
  const denied = createMap({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } });
  assert.doesNotThrow(() => denied.render());
});

test('each filter combination restores its own camera', () => {
  const map = createMap(); map.render();
  map.instance.setView([55.8, 24.2], 8);
  map.render({ viewportKey: 'vilnius' });
  map.instance.setView([54.7, 25.3], 13);
  map.render();
  assert.equal(map.instance.getZoom(), 8);
  assert.equal(map.instance.getCenter().lat, 55.8);
  map.render({ viewportKey: 'vilnius' });
  assert.equal(map.instance.getZoom(), 13);
  assert.equal(map.instance.getCenter().lat, 54.7);
});
