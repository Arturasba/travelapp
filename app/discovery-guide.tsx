"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent, ReactNode, TouchEvent } from "react";
import { categories, destinations, filterDestinations, getDestination } from "./destinations";
import type { Category, Collection, Destination, Photo } from "./destinations";
import book from "./book.module.css";
import styles from "./guide.module.css";

const DestinationMap = dynamic(() => import("./destination-map"), { ssr: false, loading: () => <div className={styles.mapLoading}>Opening the atlas…</div> });
const PAGE_SIZE = 4;
const TURN_MS = 650;
function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("guide:navigate", notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener("guide:navigate", notify); };
}
function locationSnapshot() { return window.location.pathname + window.location.search; }
function PhotoCredit({ photo }: { photo: Photo }) {
  return <span><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author}</a> · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></span>;
}
function PlaceImage({ place, index = 0, className, priority = false, sizes = "(max-width: 760px) 100vw, 45vw" }: { place: Destination; index?: number; className?: string; priority?: boolean; sizes?: string }) {
  const photo = place.photos[index] ?? place.photos[0];
  return <div className={className} style={{ position: "relative" }}><Image src={photo.src} alt={photo.alt} fill sizes={sizes} preload={priority} style={{ objectFit: "cover" }} /></div>;
}
function internalClick(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  action();
}

type Leaves = { left: ReactNode; right: ReactNode };
type Turn = Leaves & { direction: "forward" | "backward" };

export default function DiscoveryGuide({ initialSlug }: { initialSlug?: string }) {
  const serverLocation = useCallback(() => initialSlug ? `/places/${initialSlug}` : "/", [initialSlug]);
  const location = useSyncExternalStore(subscribeLocation, locationSnapshot, serverLocation);
  const slug = location.startsWith("/places/") ? decodeURIComponent(location.split("/")[2].split("?")[0]) : null;
  const mapParameter = new URLSearchParams(location.split("?")[1] ?? "").get("map");
  const view = slug ? "place" : mapParameter !== null ? "map" : "discover";
  const current = slug ? getDestination(slug) : undefined;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [collection, setCollection] = useState<Collection>("all");
  const [offset, setOffset] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const snapshot = useRef<Leaves | null>(null);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const results = useMemo(() => filterDestinations(query, category, collection), [query, category, collection]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageIndex = Math.min(offset, pageCount - 1);
  const pagePlaces = results.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  const featured = pagePlaces[0];
  const focusSlug = selectedSlug ?? (mapParameter && mapParameter !== "all" ? mapParameter : null);
  const preview = results.find(place => place.slug === focusSlug) ?? results[0];
  const navigationPlaces = current && results.some(place => place.slug === current.slug) ? results : destinations;
  const destinationIndex = current ? navigationPlaces.findIndex(place => place.slug === current.slug) : -1;
  const photoIndex = current ? photoIndices[current.slug] ?? 0 : 0;

  const turnPage = useCallback((action: () => void, direction: "forward" | "backward" = "forward") => {
    if (lock.current) return;
    setMenuOpen(false);
    if (snapshot.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lock.current = true;
      setTurn({ ...snapshot.current, direction });
      timer.current = setTimeout(() => { lock.current = false; setTurn(null); }, TURN_MS);
    }
    action();
    stage.current?.focus({ preventScroll: true });
  }, []);

  const changeLocation = useCallback((url: string) => {
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("guide:navigate"));
  }, []);

  function openPlace(nextSlug: string, direction: "forward" | "backward" = "forward") {
    turnPage(() => changeLocation(`/places/${nextSlug}`), direction);
  }
  function openMap(placeSlug?: string) {
    turnPage(() => {
      if (placeSlug) { setQuery(""); setCategory("all"); setCollection("all"); setSelectedSlug(placeSlug); }
      changeLocation(`/?map=${placeSlug ?? "all"}`);
    });
  }
  function discover(nextCategory: Category = "all", nextCollection: Collection = "all") {
    turnPage(() => { setCategory(nextCategory); setCollection(nextCollection); setQuery(""); setOffset(0); changeLocation("/"); });
  }
  function resetFilters() { setQuery(""); setCategory("all"); setCollection("all"); setOffset(0); }
  function move(direction: -1 | 1) {
    if (view === "map") return;
    if (current) {
      const next = navigationPlaces[destinationIndex + direction];
      if (next) openPlace(next.slug, direction === 1 ? "forward" : "backward");
    } else if (pageIndex + direction >= 0 && pageIndex + direction < pageCount) {
      turnPage(() => setOffset(pageIndex + direction), direction === 1 ? "forward" : "backward");
    }
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    stage.current?.querySelectorAll(".guide-scroll-page").forEach(element => { element.scrollTop = 0; });
  }, [location, pageIndex]);
  useEffect(() => {
    function onPopState() { lock.current = false; setTurn(null); setSelectedSlug(null); if (timer.current) clearTimeout(timer.current); }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); return; }
      if (view === "map" || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true], .leaflet-container, [data-gallery]"))) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  function swipeEnd(event: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || view === "map" || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      event.preventDefault();
      move(dx < 0 ? 1 : -1);
    }
  }

  const searchControls = <div className={styles.searchControls}>
    <label className={styles.searchLabel} htmlFor="destination-search">FIND A PLACE</label>
    <div className={styles.searchField}><span aria-hidden="true">⌕</span><input id="destination-search" type="search" value={query} placeholder="Try Trakai, dunes, Vilnius…" onChange={event => { setQuery(event.target.value); setOffset(0); }} /></div>
    <label className={styles.categoryFilter}>Category<select value={category} onChange={event => { setCategory(event.target.value as Category); setOffset(0); }}>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className={styles.collectionTabs} aria-label="Curated collections">{([["all", "All places"], ["popular", "Popular places"], ["hidden", "Hidden gems"]] as const).map(([id, label]) => <button key={id} aria-pressed={collection === id} onClick={() => { setCollection(id); setOffset(0); }}>{label}</button>)}</div>
    <p className={styles.curationNote}>Curated starter collection · editorial choices, not visitor rankings.</p>
  </div>;

  function placeRow(place: Destination, index: number, mapMode = false) {
    return <li key={place.slug} className={styles.placeRow}>
      <span className={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</span>
      <a href={`/places/${place.slug}`} className={styles.rowLink} onClick={event => internalClick(event, () => mapMode ? setSelectedSlug(place.slug) : openPlace(place.slug))}>
        <PlaceImage place={place} className={styles.rowImage} sizes="72px" /><span><strong>{place.name}</strong><small>{place.location}</small><span className={styles.rowCategory}>{categories.find(item => item.id === place.category)?.label}{place.hidden ? " · A quieter detour" : ""}</span></span>
      </a>
      <button className={styles.rowLocate} aria-label={`Locate ${place.name} on the map`} onClick={() => mapMode ? setSelectedSlug(place.slug) : openMap(place.slug)}>⌖</button>
    </li>;
  }

  let left: ReactNode;
  let right: ReactNode;
  if (view === "place" && current) {
    left = <article className={`${styles.sheet} guide-scroll-page`} key={current.slug}>
      <div className={styles.pageRunning}><button onClick={() => discover()}>← All destinations</button><span>{categories.find(item => item.id === current.category)?.label}</span></div>
      <div className={styles.detailMobilePhoto}><PlaceImage place={current} index={photoIndex} className={styles.mobileImage} /><span className={styles.mobileCredit}><PhotoCredit photo={current.photos[photoIndex]} /></span></div>
      <p className={styles.kicker}>A PLACE WORTH FINDING</p><h1 className={styles.destinationTitle}>{current.name}</h1><p className={styles.placeLocation}>⌖ {current.location}</p>
      <p className={styles.description}>{current.description}</p>
      <div className={styles.placeActions}><button onClick={() => openMap(current.slug)}>Locate on the atlas ↗</button>{current.photos.length > 1 && <button data-gallery onClick={() => setPhotoIndices(indices => ({ ...indices, [current.slug]: (photoIndex + 1) % current.photos.length }))}>Photo {photoIndex + 1} / {current.photos.length} →</button>}</div>
      <h2 className={styles.detailLabel}>Why make the detour</h2><ul className={styles.reasons}>{current.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <h2 className={styles.detailLabel}>Before you go</h2><ul className={styles.visitorInfo}>{current.visitorInfo.map(info => <li key={info}>{info}</li>)}</ul>
      <p className={styles.coordinateNote}><a href={current.coordinateSource} target="_blank" rel="noopener noreferrer">{current.coordinates[0].toFixed(5)}° N, {current.coordinates[1].toFixed(5)}° E ↗</a><br />{current.coordinateNote}</p>
      <details className={styles.sources}><summary>Sources & photography</summary><p>References reviewed {current.reviewed}. Hours, prices and closures are not live; check visitor information before travelling.</p>{current.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}{current.photos.map(photo => <p key={photo.src}><PhotoCredit photo={photo} /> · Displayed using a cropped image.</p>)}</details>
      <div className={styles.pageFolio}><span>LITHUANIA / {current.category.toUpperCase()}</span><span>{String(destinations.indexOf(current) + 1).padStart(2, "0")}</span></div>
    </article>;
    right = <article className={styles.featurePhoto}><PlaceImage place={current} index={photoIndex} className={styles.fullPhoto} priority /><div className={styles.featureWash} /><div className={styles.photoOverline}>LITHUANIA / {current.location.toUpperCase()}</div><div className={styles.featureCaption}><span>THE DISCOVERY GUIDE</span><h2>{current.name}</h2><p>{current.reasons[0]}</p></div><div className={styles.featureCredit}><PhotoCredit photo={current.photos[photoIndex]} /></div>{current.photos.length > 1 && <div className={styles.galleryControls} data-gallery><button aria-label="Previous photograph" onClick={() => setPhotoIndices(indices => ({ ...indices, [current.slug]: (photoIndex + current.photos.length - 1) % current.photos.length }))}>←</button><span>{photoIndex + 1} / {current.photos.length}</span><button aria-label="Next photograph" onClick={() => setPhotoIndices(indices => ({ ...indices, [current.slug]: (photoIndex + 1) % current.photos.length }))}>→</button></div>}</article>;
  } else if (view === "map") {
    left = <article className={`${styles.sheet} ${styles.atlasSheet} guide-scroll-page`}>
      <div className={styles.pageRunning}><span>THE ATLAS</span><span>LITHUANIA</span></div><h1 className={styles.discoveryTitle}>A country.<br /><em>So many detours.</em></h1>{searchControls}
      <p className={styles.resultsCount}>{results.length} places on the map</p>
      {preview && <div className={styles.mapSelection}><PlaceImage place={preview} className={styles.previewImage} /><span className={styles.previewCredit}><PhotoCredit photo={preview.photos[0]} /></span><p className={styles.kicker}>IN FOCUS / {preview.location}</p><h2>{preview.name}</h2><p>{preview.description}</p><a href={`/places/${preview.slug}`} onClick={event => internalClick(event, () => openPlace(preview.slug))}>Open destination page →</a></div>}
      {!results.length && <div className={styles.emptyState}><p>No places match your search.</p><button onClick={resetFilters}>Clear filters</button></div>}
      <details className={styles.mapList}><summary>Browse all {results.length} map locations</summary><ol>{results.map((place, index) => placeRow(place, index, true))}</ol></details>
    </article>;
    right = <DestinationMap places={results} focusedSlug={results.some(place => place.slug === focusSlug) ? focusSlug : null} onSelect={setSelectedSlug} onOpen={openPlace} />;
  } else {
    left = <article className={`${styles.sheet} guide-scroll-page`}>
      <div className={styles.pageRunning}><span>THE DISCOVERY INDEX</span><span>{destinations.length} REAL PLACES</span></div><p className={styles.kicker}>LITHUANIA, ONE PLACE AT A TIME</p><h1 className={styles.discoveryTitle}>Find your next<br /><em>little detour.</em></h1>{searchControls}
      <div className={styles.resultsHeading}><p className={styles.resultsCount} role="status">{results.length} {results.length === 1 ? "place" : "places"} to discover</p><button onClick={() => openMap()}>Explore the atlas ↗</button></div>
      <ol className={styles.placeList}>{pagePlaces.map((place, index) => placeRow(place, pageIndex * PAGE_SIZE + index))}</ol>
      {!results.length && <div className={styles.emptyState}><h2>No detours found.</h2><p>Try a town name, another category, or a shorter search.</p><button onClick={resetFilters}>Clear filters</button></div>}
      <div className={styles.pageFolio}><span>A CURATED STARTER COLLECTION</span><span>{pageIndex + 1} / {pageCount}</span></div>
    </article>;
    right = featured ? <article className={styles.featurePhoto}><PlaceImage place={featured} className={styles.fullPhoto} priority /><div className={styles.featureWash} /><div className={styles.photoOverline}>A PLACE TO BEGIN / {featured.category.toUpperCase()}</div><div className={styles.featureCaption}><span>⌖ {featured.location.toUpperCase()}</span><h2>{featured.name}</h2><p>{featured.reasons[0]}</p><a href={`/places/${featured.slug}`} onClick={event => internalClick(event, () => openPlace(featured.slug))}>Turn to this place →</a></div><div className={styles.featureCredit}><PhotoCredit photo={featured.photos[0]} /></div></article> : <article className={styles.blankPage}><span aria-hidden="true">✳</span><p>A different search.<br />A different adventure.</p></article>;
  }

  useEffect(() => {
    snapshot.current = { left, right: view === "map" ? <div className={styles.blankPage}><p>The Lithuania atlas</p></div> : right };
  });

  const isFirst = view === "map" || (current ? destinationIndex <= 0 : pageIndex === 0);
  const isLast = view === "map" || (current ? destinationIndex >= navigationPlaces.length - 1 : pageIndex >= pageCount - 1);

  return <div className={`${book.reader} ${styles.guide}`}>
    <a className={book.skipLink} href="#discovery-book">Skip to destinations</a>
    <aside id="guide-contents" className={`${book.sidebar} ${menuOpen ? book.sidebarOpen : ""}`} aria-label="Guide chapters">
      <button className={book.brand} onClick={() => discover()}>lithuania<span>.</span><small>THE DISCOVERY GUIDE</small></button><div className={book.sidebarIntro}><span aria-hidden="true">✳</span><p>Real places.<br />Unexpected detours.</p></div>
      <div className={book.contentsLabel}><span>EXPLORE THE CHAPTERS</span><span>01—05</span></div>
      <nav aria-label="Destination categories"><ol className={book.contents}>{categories.map((item, index) => <li key={item.id}><button aria-current={view === "discover" && category === item.id ? "page" : undefined} onClick={() => discover(item.id)} disabled={!!turn}><span className={book.chapterNumber}>{String(index).padStart(2, "0")}</span><span>{item.label}<small>{item.id === "all" ? "The complete collection" : `${destinations.filter(place => place.category === item.id).length} places to find`}</small></span></button></li>)}</ol></nav>
      <div className={styles.sidebarCollections}><button onClick={() => discover("all", "popular")}>Popular places <span>↗</span></button><button onClick={() => discover("all", "hidden")}>Hidden gems <span>↗</span></button><button onClick={() => openMap()}>The interactive atlas <span>⌖</span></button></div>
      <div className={book.sidebarBottom}><p>CURATED, NOT RANKED.<br />MADE FOR THE CURIOUS.</p><Link href="/journal" className={styles.journalLink}>Read the travel journal ↗</Link></div><button className={book.closeMenu} onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}>Close contents ×</button>
    </aside>
    {menuOpen && <button className={book.menuBackdrop} aria-label="Close chapter menu" onClick={() => setMenuOpen(false)} />}
    <div className={book.workspace}>
      <header className={book.toolbar}><span>THE BALTIC EDITION <i>/</i><span className={book.toolbarChapter}>{current?.name ?? (view === "map" ? "The interactive atlas" : "A guide to real places")}</span></span><div className={styles.viewTabs}><button aria-pressed={view !== "map"} onClick={() => discover()}>Discover</button><button aria-pressed={view === "map"} onClick={() => openMap()}>Atlas ⌖</button></div><button ref={menuButton} className={book.contentsToggle} aria-expanded={menuOpen} aria-controls="guide-contents" onClick={() => setMenuOpen(!menuOpen)}>Chapters ☰</button></header>
      <main ref={stage} className={book.stage} id="discovery-book" tabIndex={-1} aria-label={current ? current.name : view === "map" ? "Destination atlas" : "Destination discovery"} onTouchStart={event => { touch.current = event.touches.length === 1 && !(event.target instanceof HTMLElement && event.target.closest("button,input,select,[data-gallery],.leaflet-container")) ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }} onTouchEnd={swipeEnd} onTouchCancel={() => { touch.current = null; }}>
        <div className={book.book}><div className={`${styles.guideSpread} ${view === "map" ? styles.mapSpread : ""}`}>{left}{right}</div>
          {turn && <div className={`${styles.turnOverlay} ${turn.direction === "forward" ? styles.forward : styles.backward}`} aria-hidden="true" inert><div className={styles.oldStationary}>{turn.direction === "forward" ? turn.left : turn.right}</div><div className={styles.flippingLeaf}><div className={styles.leafFront}>{turn.direction === "forward" ? turn.right : turn.left}</div><div className={styles.leafBack}>{turn.direction === "forward" ? left : right}</div></div><div className={styles.mobileSnapshot}>{turn.left}</div></div>}
          <div className={book.spine} style={view === "map" ? { left: "calc(42.5% - 16px)" } : undefined} aria-hidden="true" />
        </div>
      </main>
      <footer className={book.readerFooter}><div className={styles.footerPosition}>{view === "map" ? `${results.length} places on the atlas` : current ? `${String(destinationIndex + 1).padStart(2, "0")} / ${navigationPlaces.length} places` : `Index ${pageIndex + 1} / ${pageCount}`}</div><p className={book.keyboardHint}>{view === "map" ? "DRAG TO EXPLORE · SELECT A PIN" : "USE ← → OR SWIPE TO TURN THE PAGE"}</p><div className={book.pageControls}><button disabled={isFirst || !!turn} onClick={() => move(-1)} aria-label="Previous page">←</button><span>{view === "map" ? "THE ATLAS" : "TURN THE PAGE"}</span><button disabled={isLast || !!turn} onClick={() => move(1)} aria-label="Next page">→</button></div></footer>
      <span role="status" className={book.srOnly}>{current?.name ?? `${results.length} matching places. ${view === "map" ? "Atlas" : `Index page ${pageIndex + 1}`}`}</span>
    </div>
  </div>;
}
