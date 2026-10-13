import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise Leaflet integration and lifecycle, without claiming browser gesture QA.
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const place = { slug: 'vilnius-old-town', name: 'Vilnius Old Town', location: 'Vilnius', category: 'cities', coordinates: [54.68, 25.28], photos: [{ src: '/test.jpg', alt: 'Vilnius', author: 'Author', license: 'CC BY', source: 'https://example.org' }] };
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

function createMap(sessionStorage = storage()) {
  const refs = [], effects = [], createdMarkers = [], selected = [], opened = [];
  const events = new Map();
  let refIndex, effectIndex, center = { lat: 55.25, lng: 23.8 }, zoom = 7, fits = 0;
  const emit = name => { for (const fn of events.get(name) ?? []) fn(); };
  const instance = {
    setView(value, level) { center = Array.isArray(value) ? { lat: value[0], lng: value[1] } : value; zoom = level; emit('moveend'); return this; },
    fitBounds(bounds) { this.lastBounds = bounds; fits++; center = { lat: 55.2, lng: 23.8 }; zoom = 7; emit('moveend'); return this; },
    getCenter: () => center, getZoom: () => zoom,
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return this; },
    off(name, fn) { events.get(name)?.delete(fn); }, invalidateSize() {}, remove() {}, closePopup() {},
  };
  let options;
  const L = {
    map(_node, settings) { options = settings; return instance; },
    tileLayer: () => ({ addTo() { return this; }, on() {}, redraw() {} }),
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {} }),
    divIcon: value => value, latLngBounds: value => value,
    DomEvent: { disableClickPropagation(node) { node.clickIsolated = true; }, disableScrollPropagation(node) { node.scrollIsolated = true; } },
    marker(coords) {
      const marker = { coords, handlers: {}, bindPopup(node, settings) { this.preview = node; this.popup = { options: settings }; return this; },
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
      name === './destinations' ? { categories: [], destinations: Array(16), directionsUrl: () => 'https://example.org/directions' } : {},
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
    viewport: viewport.exports, sessionStorage, instance, markers: createdMarkers, selected, opened,
    options: () => options, fits: () => fits,
  };
}

test('map enables native mouse/touch handlers, isolates book gestures, and wires real previews', () => {
  const map = createMap(); const tree = map.render();
  for (const handler of ['scrollWheelZoom', 'dragging', 'touchZoom', 'zoomControl', 'keyboard']) assert.equal(map.options()[handler], true);
  let stopped = 0;
  tree.props.onWheel({ stopPropagation() { stopped++; } });
  assert.equal(stopped, 1);
  for (const handler of ['onTouchStart', 'onTouchEnd', 'onKeyDown']) assert.equal(tree.props[handler], undefined, 'Leaflet document handlers must receive the full gesture lifecycle');
  assert.equal(tree.props.onMouseMove, undefined, 'document drag events must keep reaching Leaflet');
  const marker = map.markers[0]; marker.handlers.click();
  assert.deepEqual(map.selected, [place.slug]);
  assert(marker.preview.clickIsolated && marker.preview.scrollIsolated);
  const link = marker.preview.children.find(node => node.tag === 'a');
  assert.equal(link.href, `/places/${place.slug}?city=vilnius&from=map`);
  let prevented = false;
  link.handlers.click({ ctrlKey: true, preventDefault() { prevented = true; } });
  assert(!prevented && !map.opened.length);
  link.handlers.click({ preventDefault() { prevented = true; } });
  assert(prevented); assert.deepEqual(map.opened, [place.slug]);
});

test('selected places focus once; panned camera survives rerenders and leaving exploration', () => {
  const map = createMap(); map.render({ focusedSlug: place.slug });
  assert.equal(map.instance.getZoom(), 12);
  assert(map.markers[0].opened);
  map.instance.setView([55.8, 24.2], 9);
  const fits = map.fits(); map.render({ focusedSlug: place.slug });
  assert.equal(map.fits(), fits); assert.equal(map.instance.getZoom(), 9);
  map.unmount();
  const returned = createMap(map.sessionStorage); returned.render({ focusedSlug: place.slug });
  assert.equal(returned.instance.getZoom(), 9);
  assert.equal(returned.instance.getCenter().lat, 55.8);
  assert.equal(returned.markers[0].popup.options.autoPan, false, 'restoring a preview must not override the saved camera');
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
