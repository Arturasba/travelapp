"use client";

import L from "leaflet";
import { getImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { categories } from "./destinations";
import type { Destination } from "./destinations";
import styles from "./guide.module.css";

type Props = { places: Destination[]; focusedSlug: string | null; onSelect: (slug: string) => void; onOpen: (slug: string) => void };

export default function DestinationMap({ places, focusedSlug, onSelect, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const callbacks = useRef({ onSelect, onOpen });
  const [tileError, setTileError] = useState(false);

  useEffect(() => { callbacks.current = { onSelect, onOpen }; }, [onSelect, onOpen]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: true }).setView([55.25, 23.8], 7);
    map.current = instance;
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
    layer.current.clearLayers();
    markers.current.clear();
    for (const place of places) {
      const color = categories.find(category => category.id === place.category)?.color ?? "#667b50";
      const icon = L.divIcon({ className: "destination-pin", html: `<span style="background:${color}"></span>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
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
      link.href = `/places/${place.slug}`;
      link.textContent = "Open this place →";
      link.addEventListener("click", event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        callbacks.current.onOpen(place.slug);
      });
      const credit = document.createElement("a");
      credit.href = place.photos[0].source;
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.className = "destination-map-credit";
      credit.textContent = `${place.photos[0].author} · ${place.photos[0].license}`;
      preview.append(image, name, location, link, credit);
      marker.bindPopup(preview, { maxWidth: 245 });
      marker.on("click", () => callbacks.current.onSelect(place.slug));
      marker.addTo(layer.current);
      markers.current.set(place.slug, marker);
    }
    if (places.length) {
      map.current.fitBounds(L.latLngBounds(places.map(place => place.coordinates)), { padding: [35, 35], maxZoom: 11, animate: false });
    }
  }, [places]);

  useEffect(() => {
    if (!focusedSlug || !map.current) return;
    const marker = markers.current.get(focusedSlug);
    if (!marker) return;
    map.current.setView(marker.getLatLng(), 12, { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    marker.openPopup();
  }, [focusedSlug, places]);

  function fitAll() {
    if (map.current && places.length) map.current.fitBounds(L.latLngBounds(places.map(place => place.coordinates)), { padding: [35, 35], maxZoom: 11 });
  }

  return <div className={styles.mapFrame}>
    <div ref={container} className={styles.mapCanvas} role="region" aria-label="Interactive map of Lithuania. Drag to pan, use plus and minus to zoom, and select a destination marker." />
    <button className={styles.fitMap} onClick={fitAll} disabled={!places.length}>Show all {places.length} places</button>
    {tileError && <div className={styles.mapNotice} role="status">The base map could not load. Place pins and the destination list are still available. <button onClick={() => { setTileError(false); tiles.current?.redraw(); }}>Retry map</button></div>}
    {!places.length && <div className={styles.mapNotice}>No places match these filters. Clear filters to restore the pins.</div>}
  </div>;
}
