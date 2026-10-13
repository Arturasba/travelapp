"use client";

import L from "leaflet";
import { getImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { categories, destinations, directionsUrl } from "./destinations";
import type { Destination } from "./destinations";
import { readMapViewport, saveMapViewport } from "./map-viewport";
import styles from "./guide.module.css";

type Props = { places: Destination[]; viewportKey: string; destinationHref: (slug: string) => string; focusedSlug: string | null; onSelect: (slug: string) => void; onOpen: (slug: string) => void };
// A country-wide camera, independent of the current result set.
const LITHUANIA_BOUNDS: L.LatLngBoundsExpression = [[53.85, 20.9], [56.5, 26.9]];

export default function DestinationMap({ places, viewportKey, destinationHref, focusedSlug, onSelect, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const callbacks = useRef({ onSelect, onOpen, destinationHref, focusedSlug });
  const activeViewport = useRef({ key: viewportKey, focusedSlug });
  const restoredFocus = useRef<string | null | undefined>(undefined);
  const [tileError, setTileError] = useState(false);

  useEffect(() => { callbacks.current = { onSelect, onOpen, destinationHref, focusedSlug }; }, [onSelect, onOpen, destinationHref, focusedSlug]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      scrollWheelZoom: true, dragging: true, touchZoom: true,
      doubleClickZoom: true, keyboard: true, zoomControl: true,
    }).setView([55.25, 23.8], 7);
    map.current = instance;
    function rememberCamera() {
      const center = instance.getCenter();
      saveMapViewport(activeViewport.current.key, { center: [center.lat, center.lng], zoom: instance.getZoom(), focusedSlug: activeViewport.current.focusedSlug });
    }
    instance.on("moveend", rememberCamera);
    tiles.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.current.on("tileerror", () => setTileError(true));
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    const markerRegistry = markers.current;
    observer.observe(container.current);
    return () => {
      rememberCamera();
      instance.off("moveend", rememberCamera);
      observer.disconnect();
      instance.remove();
      map.current = null;
      layer.current = null;
      tiles.current = null;
      markerRegistry.clear();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    activeViewport.current = { key: viewportKey, focusedSlug: callbacks.current.focusedSlug };
    const saved = readMapViewport(viewportKey);
    restoredFocus.current = saved?.focusedSlug;
    layer.current.clearLayers();
    markers.current.clear();
    for (const place of places) {
      const color = categories.find(category => category.id === place.category)?.color ?? "#667b50";
      const icon = L.divIcon({ className: "destination-pin", html: `<span style="background:${color}"></span>`, iconSize: [44, 44], iconAnchor: [22, 35], popupAnchor: [0, -30] });
      const marker = L.marker(place.coordinates, { icon, title: place.name, alt: place.name, keyboard: true });
      const preview = document.createElement("div");
      preview.className = "destination-map-preview";
      const image = document.createElement("img");
      const { props: imageProps } = getImageProps({ src: place.photos[0].src, alt: place.photos[0].alt, width: 220, height: 110, sizes: "220px" });
      image.src = imageProps.src;
      image.srcset = imageProps.srcSet ?? "";
      image.sizes = "220px";
      image.alt = place.photos[0].alt;
      image.width = 220;
      image.height = 110;
      image.loading = "lazy";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const location = document.createElement("p");
      location.textContent = place.location;
      const link = document.createElement("a");
      link.href = callbacks.current.destinationHref(place.slug);
      link.textContent = "View place →";
      link.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        callbacks.current.onOpen(place.slug);
      });
      const credit = document.createElement("a");
      const directions = document.createElement("a");
      directions.href = directionsUrl(place);
      directions.target = "_blank";
      directions.rel = "noopener noreferrer";
      directions.className = "destination-map-directions";
      directions.textContent = "Get directions ↗";
      credit.href = place.photos[0].source;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.className = "destination-map-credit";
      credit.textContent = `${place.photos[0].author} · ${place.photos[0].license}`;
      preview.append(image, name, location, link, directions, credit);
      // Popup controls should not also trigger map clicks/zoom.
      L.DomEvent.disableClickPropagation(preview);
      L.DomEvent.disableScrollPropagation(preview);
      marker.bindPopup(preview, { maxWidth: 245, maxHeight: 250, autoPan: true });
      marker.on("click", () => callbacks.current.onSelect(place.slug));
      marker.addTo(layer.current);
      markers.current.set(place.slug, marker);
    }
    if (saved) {
      map.current.setView(saved.center, saved.zoom, { animate: false });
    } else if (places.length && places.length < destinations.length) {
      map.current.fitBounds(L.latLngBounds(places.map(place => place.coordinates)), { padding: [35, 35], maxZoom: 11, animate: false });
    } else map.current.fitBounds(LITHUANIA_BOUNDS, { padding: [25, 25], animate: false });
  }, [places, viewportKey]);

  useEffect(() => {
    activeViewport.current.focusedSlug = focusedSlug;
    if (!focusedSlug || !map.current) return;
    const marker = markers.current.get(focusedSlug);
    if (!marker) return;
    const restored = restoredFocus.current === focusedSlug;
    // New previews may pan into view; restoring an existing camera must not move it.
    const popup = marker.getPopup();
    if (popup) popup.options.autoPan = !restored;
    if (!restored) map.current.setView(marker.getLatLng(), 12, { animate: false });
    restoredFocus.current = undefined;
    marker.openPopup();
  }, [focusedSlug, places, viewportKey]);

  function fitAll() {
    callbacks.current.onSelect("all");
    map.current?.closePopup();
    map.current?.fitBounds(LITHUANIA_BOUNDS, { padding: [25, 25], animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  }

  // Leaflet completes drag/pinch/keyboard lifecycles on document. Do not stop
  // touchend, mousemove or keydown here; the guide excludes map gestures itself.
  return <div className={styles.mapFrame} onWheel={event => event.stopPropagation()}>
    <div ref={container} className={styles.mapCanvas} role="region" aria-label="Interactive map of Lithuania. Drag to pan, use plus and minus to zoom, and select a destination marker." />
    <button className={styles.fitMap} onClick={fitAll}>Reset to Lithuania</button>
    {tileError && <div className={styles.mapNotice} role="status">The base map could not load. Place pins and the destination list are still available. <button onClick={() => { setTileError(false); tiles.current?.redraw(); }}>Retry map</button></div>}
    {!places.length && <div className={styles.mapNotice}>No places match these filters. Clear filters to restore the pins.</div>}
  </div>;
}
