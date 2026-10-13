"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent, ReactNode, TouchEvent } from "react";
import { categories, cities, destinations, directionsUrl, filterDestinations, getDestination } from "./destinations";
import type { Category, CityId, Collection, Destination, Photo } from "./destinations";
import { guideUrl, readFilters } from "./guide-navigation";
import type { GuideFilters } from "./guide-navigation";
import styles from "./guide.module.css";

const DestinationMap = dynamic(() => import("./destination-map"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} role="status"><span className={styles.loadingDot} />Loading the map…</div>,
});
const EMPTY_FILTERS: GuideFilters = { query: "", category: "all", city: "all", collection: "all" };
const TURN_MS = 550;

function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("guide:navigate", notify);
  return () => { window.removeEventListener("popstate", notify); window.removeEventListener("guide:navigate", notify); };
}
function locationSnapshot() { return window.location.pathname + window.location.search; }
function subscribeCompact(notify: () => void) {
  const query = window.matchMedia("(max-width: 960px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function compactSnapshot() { return window.matchMedia("(max-width: 960px)").matches; }
function serverCompact() { return false; }

function PhotoCredit({ photo }: { photo: Photo }) {
  return <span><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author}</a> · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></span>;
}
function PlaceImage({ place, index = 0, className, priority = false, sizes = "(max-width: 760px) 100vw, 42vw" }: { place: Destination; index?: number; className?: string; priority?: boolean; sizes?: string }) {
  const photo = place.photos[index] ?? place.photos[0];
  return <div className={className} style={{ position: "relative" }}><Image src={photo.src} alt={photo.alt} fill sizes={sizes} preload={priority} style={{ objectFit: "cover" }} /></div>;
}
function internalClick(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  action();
}

type Turn = { photo: ReactNode; direction: "forward" | "backward" };

export default function DiscoveryGuide({ initialSlug }: { initialSlug?: string }) {
  const serverLocation = useCallback(() => initialSlug ? `/places/${initialSlug}` : "/", [initialSlug]);
  const location = useSyncExternalStore(subscribeLocation, locationSnapshot, serverLocation);
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, serverCompact);
  const filters = useMemo(() => readFilters(location), [location]);
  const { query, category, city, collection } = filters;
  const slug = location.startsWith("/places/") ? decodeURIComponent(location.split("/")[2].split("?")[0]) : null;
  const mapParameter = new URLSearchParams(location.split("?")[1] ?? "").get("map");
  const view = slug ? "place" : mapParameter !== null ? "map" : "discover";
  const current = slug ? getDestination(slug) : undefined;
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const photoSnapshot = useRef<ReactNode>(null);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = useRef<HTMLElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const closeMenu = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const results = useMemo(() => filterDestinations(query, category, collection, city), [query, category, collection, city]);
  const featured = results[0];
  const focusSlug = mapParameter && mapParameter !== "all" && results.some(place => place.slug === mapParameter) ? mapParameter : null;
  const navigationPlaces = current && results.some(place => place.slug === current.slug) ? results : destinations;
  const destinationIndex = current ? navigationPlaces.findIndex(place => place.slug === current.slug) : -1;
  const photoIndex = current ? photoIndices[current.slug] ?? 0 : 0;
  const cityName = cities.find(item => item.id === city)?.label;
  const hasFilters = !!query || city !== "all" || category !== "all" || collection !== "all";

  const changeLocation = useCallback((url: string, replace = false) => {
    if (url === window.location.pathname + window.location.search) return;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("guide:navigate"));
  }, []);

  const navigate = useCallback((url: string, animate = false, direction: "forward" | "backward" = "forward") => {
    if (animate && lock.current) return;
    if (timer.current) clearTimeout(timer.current);
    lock.current = false;
    setTurn(null);
    setMenuOpen(false);
    if (animate && photoSnapshot.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lock.current = true;
      setTurn({ photo: photoSnapshot.current, direction });
      timer.current = setTimeout(() => { lock.current = false; setTurn(null); }, TURN_MS);
    }
    changeLocation(url);
    stage.current?.focus({ preventScroll: true });
  }, [changeLocation]);

  function openPlace(nextSlug: string, animate = false, direction: "forward" | "backward" = "forward") {
    navigate(guideUrl(filters, { slug: nextSlug }), animate, direction);
  }
  function openMap(placeSlug?: string) {
    const matching = !placeSlug || results.some(place => place.slug === placeSlug);
    navigate(guideUrl(matching ? filters : EMPTY_FILTERS, { map: placeSlug ?? "all" }));
  }
  function updateFilters(patch: Partial<GuideFilters>, replace = false) {
    const next = { ...filters, ...patch };
    changeLocation(guideUrl(next, view === "map" ? { map: "all" } : {}), replace);
    setMenuOpen(false);
  }
  function chooseCity(nextCity: CityId) {
    updateFilters({ ...EMPTY_FILTERS, city: nextCity });
  }
  function resetFilters() { updateFilters(EMPTY_FILTERS); }
  function move(direction: -1 | 1) {
    if (!current) return;
    const next = navigationPlaces[destinationIndex + direction];
    if (next) openPlace(next.slug, true, direction === 1 ? "forward" : "backward");
  }
  function selectMarker(nextSlug: string) {
    changeLocation(guideUrl(filters, { map: nextSlug }), true);
  }
  function toggleMenu(event: MouseEvent<HTMLButtonElement>) {
    menuTrigger.current = event.currentTarget;
    setMenuOpen(value => !value);
  }
  function cyclePhoto(direction: -1 | 1) {
    if (current) setPhotoIndices(indices => ({ ...indices, [current.slug]: (photoIndex + direction + current.photos.length) % current.photos.length }));
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const isDestination = location.startsWith("/places/");
    if (isDestination) stage.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [location]);
  useEffect(() => {
    function back() {
      lock.current = false;
      setTurn(null);
      setMenuOpen(false);
      if (timer.current) clearTimeout(timer.current);
    }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); menuTrigger.current?.focus(); return; }
      if (!current || menuOpen || (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true],.leaflet-container,[data-gallery]"))) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  useEffect(() => {
    if (!menuOpen || !compact || !sidebar.current) return;
    const panel = sidebar.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeMenu.current?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled),a,summary,select")).filter(element => element.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    panel.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = oldOverflow; panel.removeEventListener("keydown", trap); menuTrigger.current?.focus(); };
  }, [menuOpen, compact]);

  function swipeEnd(event: TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start || !current || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.5) { event.preventDefault(); move(dx < 0 ? 1 : -1); }
  }

  function cityButton(item: typeof cities[number]) {
    const count = destinations.filter(place => place.cityId === item.id).length;
    return <button key={item.id} className={styles.cityButton} aria-pressed={city === item.id} onClick={() => chooseCity(item.id)}><span>{item.label}</span><span className={styles.cityCount}>{count}</span></button>;
  }
  const photoPage = current ? <article className={styles.detailPhoto}>
    <PlaceImage place={current} index={photoIndex} className={styles.fullPhoto} priority />
    <div className={styles.photoGradient} />
    <div className={styles.galleryControls} data-gallery onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); cyclePhoto(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <button aria-label="Previous photograph" onClick={() => cyclePhoto(-1)}>←</button><span role="status">Photo {photoIndex + 1} of {current.photos.length}</span><button aria-label="Next photograph" onClick={() => cyclePhoto(1)}>→</button>
    </div>
    <div className={styles.featureCredit}><PhotoCredit photo={current.photos[photoIndex]} /></div>
  </article> : null;
  useEffect(() => { photoSnapshot.current = photoPage; });

  return <div className={styles.guide}>
    <a className={styles.skipLink} href="#discovery-book">Skip to places</a>
    <aside ref={sidebar} id="guide-contents" className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} role={compact && menuOpen ? "dialog" : undefined} aria-modal={compact && menuOpen ? true : undefined} aria-label="Places in Lithuania">
      <div className={styles.brandRow}><button className={styles.brand} onClick={() => navigate("/")}>lithuania<span>.</span><small>Your guide to real places</small></button><button ref={closeMenu} className={styles.closeMenu} onClick={() => setMenuOpen(false)} aria-label="Close navigation">×</button></div>
      <nav className={styles.primaryNav} aria-label="Explore"><button aria-current={view === "discover" && !hasFilters ? "page" : undefined} onClick={() => navigate("/")}>All places <span>{destinations.length}</span></button><button aria-current={view === "map" ? "page" : undefined} onClick={() => openMap()}>Explore the map <span aria-hidden="true">⌖</span></button></nav>
      <div className={styles.navHeading}>Cities &amp; towns</div><p className={styles.navHint}>Including nearby sights</p>
      <nav aria-label="Cities and towns" className={styles.cityNav}>{cities.slice(0,8).map(cityButton)}<details className={styles.moreTowns}><summary>More towns</summary>{cities.slice(8).map(cityButton)}</details></nav>
      <details className={styles.categoryNav}><summary>Browse by category</summary>{categories.filter(item => item.id !== "all").map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => updateFilters({category:item.id, city:"all",query:"",collection:"all"})}>{item.label}</button>)}</details>
      <div className={styles.sidebarFooter}><Link href="/journal">The travel journal ↗</Link><span>Curated places. No rankings.</span></div>
    </aside>
    {menuOpen && compact && <button className={styles.menuBackdrop} tabIndex={-1} aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className={styles.workspace} inert={menuOpen && compact ? true : undefined}>
      <header className={styles.toolbar}><div><button className={styles.menuButton} aria-expanded={menuOpen} aria-controls="guide-contents" onClick={toggleMenu}>☰ <span>Locations</span></button><span className={styles.toolbarTitle}>The Lithuania guide</span></div><div className={styles.viewTabs} aria-label="View places"><button aria-pressed={view !== "map"} onClick={() => navigate(guideUrl(filters))}>List</button><button aria-pressed={view === "map"} onClick={() => openMap()}>⌖ Map</button></div></header>
      <main ref={stage} id="discovery-book" className={styles.main} tabIndex={-1} aria-label={current?.name ?? (view === "map" ? "Destination map" : "Discover places")} onTouchStart={event => { touch.current = current && event.touches.length === 1 && !(event.target instanceof HTMLElement && event.target.closest("button,input,select,a,[data-gallery],.leaflet-container")) ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null; }} onTouchEnd={swipeEnd} onTouchCancel={() => { touch.current = null; }}>
        {!current && <section className={styles.discoveryHeader} aria-label="Find places">
          <p className={styles.eyebrow}>{view === "map" ? "Explore Lithuania on the map" : "A book of places worth finding"}</p><h1 className={styles.discoveryTitle}>{cityName ? `Explore ${cityName}` : "Where would you like to go?"}</h1><p className={styles.headerDescription}>Find a place by name, location or what you love.</p>
          <div className={styles.searchToolbar}>
            <label className={styles.searchField}><span className={styles.srOnly}>Search places</span><span aria-hidden="true">⌕</span><input id="destination-search" type="search" value={query} placeholder={cityName ? `Search in ${cityName}…` : "Search places, towns or keywords…"} onChange={event => updateFilters({query:event.target.value},true)} /></label>
            <label className={styles.mobileLocation}>Location<select aria-label="Location" value={city} onChange={event => chooseCity(event.target.value as CityId)}><option value="all">All Lithuania</option>{cities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className={styles.categoryFilter}>Category<select aria-label="Category" value={category} onChange={event => updateFilters({category:event.target.value as Category})}>{categories.map(item => <option key={item.id} value={item.id} disabled={city !== "all" && filterDestinations("",item.id,"all",city).length === 0}>{item.label}</option>)}</select></label>
            <details className={styles.moreFilters}><summary>Collections{collection !== "all" ? " •" : ""}</summary><label>Show<select aria-label="Collection" value={collection} onChange={event => updateFilters({collection:event.target.value as Collection})}><option value="all">All places</option><option value="popular">First-time favourites</option><option value="hidden">Hidden gems</option></select></label><p>Editorial selections, not popularity rankings.</p></details>
          </div>
          <div className={styles.resultsHeading}><p role="status">{results.length} {results.length === 1 ? "place" : "places"}{cityName ? ` in and around ${cityName}` : " across Lithuania"}</p>{hasFilters && <button onClick={resetFilters}>Clear filters ×</button>}</div>
        </section>}

        {current ? <div className={styles.detailLayout}>
          <article className={styles.sheet}>
            <div className={styles.pageRunning}><button onClick={() => navigate(guideUrl(filters))}>← Back to places</button><span>{categories.find(item => item.id === current.category)?.label}</span></div>
            <div className={styles.detailHeading}><p className={styles.placeLocation}>{current.location}</p><h1 className={styles.destinationTitle}>{current.name}</h1><p className={styles.description}>{current.description}</p></div>
            <div className={styles.placeActions}><a className={styles.primaryAction} href={directionsUrl(current)} target="_blank" rel="noopener noreferrer">Get directions ↗</a><button className={styles.secondaryAction} onClick={() => openMap(current.slug)}>Show on map</button></div>
            <section><h2 className={styles.detailLabel}>Why visit</h2><ul className={styles.reasons}>{current.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></section>
            <section><h2 className={styles.detailLabel}>Before you go</h2><ul className={styles.visitorInfo}>{current.visitorInfo.map(info => <li key={info}>{info}</li>)}</ul><p className={styles.coordinateNote}>{current.coordinateNote} Directions use this reference pin.</p>{current.sources.find(source => source.label === "Visitor information") && <a className={styles.visitorLink} href={current.sources.find(source => source.label === "Visitor information")!.url} target="_blank" rel="noopener noreferrer">Check visitor information ↗</a>}</section>
            <details className={styles.sources}><summary>Sources &amp; photography</summary><p>References reviewed {current.reviewed}. Check the linked operator for current hours, prices and closures.</p><a href={current.coordinateSource} target="_blank" rel="noopener noreferrer">Coordinates: {current.coordinates[0].toFixed(5)}° N, {current.coordinates[1].toFixed(5)}° E ↗</a>{current.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}{current.photos.map(photo => <p key={photo.src}><PhotoCredit photo={photo} /> · Display crop.</p>)}</details>
            <nav className={styles.destinationNav} aria-label="More destinations"><button aria-label="Previous page" disabled={destinationIndex <= 0 || !!turn} onClick={() => move(-1)}><span>← Previous place</span><small>{navigationPlaces[destinationIndex-1]?.name}</small></button><button aria-label="Next page" disabled={destinationIndex >= navigationPlaces.length-1 || !!turn} onClick={() => move(1)}><span>Next place →</span><small>{navigationPlaces[destinationIndex+1]?.name}</small></button></nav>
          </article>
          <div className={styles.photoColumn}>{photoPage}{turn && <div className={`${styles.turnSurface} ${turn.direction === "backward" ? styles.turnBackward : ""}`} inert aria-hidden="true">{turn.photo}</div>}</div>
        </div> : view === "map" ? <section className={styles.mapSection} aria-label="Map results">
          <DestinationMap places={results} focusedSlug={focusSlug} onSelect={selectMarker} onOpen={openPlace} />
          <p className={styles.mapHelp}>Select a pin to see a place. Switch to List to browse every result.</p>
          {!results.length && <div className={styles.emptyState}><h2>No places match these filters.</h2><button onClick={resetFilters}>Show all places</button></div>}
        </section> : <div className={styles.discoveryLayout}>
          <section className={styles.resultsSection} aria-label="Places to visit"><ol className={styles.placeList}>{results.map(place => <li key={place.slug} className={styles.placeRow}>
            <a href={guideUrl(filters,{slug:place.slug})} className={styles.rowLink} onClick={event => internalClick(event,()=>openPlace(place.slug))}><PlaceImage place={place} className={styles.rowImage} sizes="(max-width: 600px) 90px, 120px" /><span><span className={styles.rowCategory}>{categories.find(item=>item.id===place.category)?.label}</span><strong>{place.name}</strong><small>{place.location}</small></span></a>
            <button className={styles.rowLocate} aria-label={`Locate ${place.name} on the map`} onClick={()=>openMap(place.slug)}><span aria-hidden="true">⌖</span> Map</button>
          </li>)}</ol>{!results.length && <div className={styles.emptyState}><h2>No places found.</h2><p>Try another name or remove a filter.</p><button onClick={resetFilters}>Show all places</button>{city !== "all" && <button onClick={()=>updateFilters({city:"all"})}>Search all Lithuania</button>}</div>}</section>
          {featured && <aside className={styles.featurePhoto} aria-label="A place to start"><PlaceImage place={featured} className={styles.fullPhoto} priority /><div className={styles.photoGradient}/><div className={styles.featureCaption}><span>A place to start · {featured.location}</span><h2>{featured.name}</h2><p>{featured.reasons[0]}</p><a href={guideUrl(filters,{slug:featured.slug})} onClick={event=>internalClick(event,()=>openPlace(featured.slug))}>Explore this place →</a></div><div className={styles.featureCredit}><PhotoCredit photo={featured.photos[0]}/></div></aside>}
        </div>}
        <footer className={styles.pageFooter}><span>Lithuania · {destinations.length} curated places</span><span>Curated starter collection. No popularity rankings.</span></footer>
      </main>
    </div>
    <nav className={styles.mobileDock} aria-label="Mobile navigation"><button aria-current={view !== "map" ? "page" : undefined} onClick={()=>navigate(guideUrl(filters))}>Places</button><button aria-current={view === "map" ? "page" : undefined} onClick={()=>openMap()}>⌖ Map</button><button aria-expanded={menuOpen} aria-controls="guide-contents" onClick={toggleMenu}>Cities &amp; towns</button></nav>
  </div>;
}
