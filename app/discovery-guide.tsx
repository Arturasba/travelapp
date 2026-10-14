"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { categories, cities, destinations, directionsUrl, filterDestinations, nearbyDestinations } from "./destinations";
import type { CityId, Destination, Photo } from "./destinations";
import { guideUrl, readFilters } from "./guide-navigation";
import type { GuideFilters } from "./guide-navigation";
import RoutePlannerPanel from "./route-planner-panel";
import { MAX_ROUTE_STOPS, readRoute, withRoute } from "./route-planner";
import { getTravelResources } from "./travel-resources";
import { useLocale } from "./locale-context";
import { stripLocale, switchLocaleUrl } from "./locale";
import { localizeDestination, placeWord, sourceLabel, translator } from "./i18n";
import styles from "./guide.module.css";

function MapLoading() {
  const t=translator(useLocale());
  return <div className={styles.mapLoading} role="status"><span className={styles.loadingDot}/>{t("Loading the map…")}</div>;
}
const DestinationMap = dynamic(() => import("./destination-map"), {ssr:false,loading:MapLoading});
const EMPTY_FILTERS: GuideFilters = {query:"",category:"all",city:"all",collection:"all"};
function subscribeLocation(notify:()=>void) {
  window.addEventListener("popstate",notify);window.addEventListener("guide:navigate",notify);
  return ()=>{window.removeEventListener("popstate",notify);window.removeEventListener("guide:navigate",notify);};
}
function locationSnapshot(){return window.location.pathname+window.location.search;}
function subscribeCompact(notify:()=>void){const query=window.matchMedia("(max-width: 960px)");query.addEventListener("change",notify);return ()=>query.removeEventListener("change",notify);}
function compactSnapshot(){return window.matchMedia("(max-width: 960px)").matches;}
function serverCompact(){return false;}
function PhotoCredit({photo}:{photo:Photo}){
  return <span><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author}</a> · <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a></span>;
}
function imageSource(photo:Photo){return `${photo.src}?v=${photo.width}-${photo.height}`;}
function PlaceImage({place,index=0,className,priority=false,sizes="(max-width: 760px) 100vw, 42vw"}:{place:Destination;index?:number;className:string;priority?:boolean;sizes?:string}){
  const photo=place.photos[index]??place.photos[0];
  if(!photo)return <div className={`${className} ${styles.foodPlate}`}><svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="34" cy="32" r="17"/><circle cx="34" cy="32" r="12"/><path d="M8 9v13m5-13v13M3 9v13c0 5 10 5 10 0M8 26v29M59 9v46M59 9c-9 9-9 21 0 21"/></svg><span>{place.cuisine}</span></div>;
  return <div className={className} style={{position:"relative"}}><Image src={imageSource(photo)} alt={photo.alt} fill quality={85} sizes={sizes} preload={priority} style={{objectFit:"cover"}}/></div>;
}
function internalClick(event:MouseEvent<HTMLAnchorElement>,action:()=>void){if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();action();}

export default function DiscoveryGuide({initialSlug}:{initialSlug?:string}){
  const locale=useLocale();
  const t=translator(locale);
  const serverLocation=useCallback(()=>`/${locale}${initialSlug?`/places/${initialSlug}`:""}`,[initialSlug,locale]);
  const location=useSyncExternalStore(subscribeLocation,locationSnapshot,serverLocation);
  const compact=useSyncExternalStore(subscribeCompact,compactSnapshot,serverCompact);
  const routeSlugs=useMemo(()=>readRoute(location),[location]);
  const routeKey=routeSlugs.join(",");
  const [plannerOpen,setPlannerOpen]=useState(false);
  const [fitRouteRequest,setFitRouteRequest]=useState(0);
  const filters=useMemo(()=>readFilters(location),[location]);
  const {query,category,city,collection}=filters;
  const pathname=stripLocale(location).split("?")[0];
  const slug=pathname.startsWith("/places/")?decodeURIComponent(pathname.split("/")[2]):null;
  const params=new URLSearchParams(location.split("?")[1]??"");
  const mapParameter=params.get("map");
  const view=slug?"place":params.get("view")==="places"&&mapParameter===null?"discover":"map";
  const returnView=params.get("from")==="places"?"places":"map";
  const viewportKey=JSON.stringify([query,category,city,collection]);
  const places=useMemo(()=>destinations.map(place=>localizeDestination(place,locale)),[locale]);
  const routePlaces=useMemo(()=>routeKey.split(",").map(id=>places.find(place=>place.slug===id)).filter((place):place is Destination=>!!place),[routeKey,places]);
  const current=places.find(place=>place.slug===slug);
  const results=useMemo(()=>filterDestinations(query,category,collection,city).map(place=>localizeDestination(place,locale)),[query,category,collection,city,locale]);
  const focusSlug=mapParameter&&mapParameter!=="all"&&results.some(place=>place.slug===mapParameter)?mapParameter:null;
  const mapFeature=places.find(place=>place.slug===focusSlug);
  const featured=results.find(place=>place.photos.length>0);
  const navigationPlaces=current&&results.some(place=>place.slug===current.slug)?results:places;
  const destinationIndex=current?navigationPlaces.findIndex(place=>place.slug===current.slug):-1;
  const nearby=useMemo(()=>current?nearbyDestinations(current.slug).map(item=>({...item,place:localizeDestination(item.place,locale)})):[],[current,locale]);
  const cityName=cities.find(item=>item.id===city)?.label;
  const hasFilters=!!query||city!=="all"||category!=="all"||collection!=="all";
  const [photoIndices,setPhotoIndices]=useState<Record<string,number>>({});
  const photoIndex=current&&current.photos.length?(photoIndices[current.slug]??0)%current.photos.length:0;
  const [menuOpen,setMenuOpen]=useState(false);
  const stage=useRef<HTMLElement>(null);
  const essentials=useRef<HTMLDetailsElement>(null);
  const photoDialog=useRef<HTMLDialogElement>(null);
  const sidebar=useRef<HTMLElement>(null);
  const closeMenu=useRef<HTMLButtonElement>(null);
  const menuTrigger=useRef<HTMLButtonElement|null>(null);
  const resources=getTravelResources(locale);
  function urlFor(nextFilters:GuideFilters,options:Parameters<typeof guideUrl>[1]={}){return withRoute(guideUrl(nextFilters,options,locale),routeSlugs);}
  const changeLocation=useCallback((url:string,replace=false)=>{
    if(url===window.location.pathname+window.location.search)return;
    if(replace)window.history.replaceState(null,"",url);else window.history.pushState(null,"",url);
    window.dispatchEvent(new Event("guide:navigate"));
  },[]);
  function navigate(url:string){setMenuOpen(false);changeLocation(withRoute(url,routeSlugs));window.scrollTo?.({top:0,behavior:"instant"});stage.current?.focus({preventScroll:true});}
  function openPlace(nextSlug:string){navigate(urlFor(filters,{slug:nextSlug,from:view==="discover"||(view==="place"&&returnView==="places")?"places":"map"}));}
  function openMap(placeSlug?:string){const matching=!placeSlug||results.some(place=>place.slug===placeSlug);navigate(urlFor(matching?filters:EMPTY_FILTERS,{map:placeSlug??"all"}));}
  function openFood(){navigate(urlFor({...EMPTY_FILTERS,category:"restaurants"},{map:"all"}));}
  function exploreMap(){if(category==="restaurants")navigate(urlFor({...filters,category:"all"},{map:current?.slug??"all"}));else openMap(current?.slug);}
  function updateFilters(patch:Partial<GuideFilters>,replace=false){changeLocation(urlFor({...filters,...patch},view==="map"?{map:"all"}:{}),replace);if(!replace)window.scrollTo?.({top:0,behavior:"instant"});setMenuOpen(false);}
  function chooseCity(nextCity:CityId){updateFilters({...EMPTY_FILTERS,city:nextCity});}
  function resetFilters(){updateFilters(EMPTY_FILTERS);}
  function selectMarker(nextSlug:string){changeLocation(urlFor(nextSlug==="all"||results.some(place=>place.slug===nextSlug)?filters:EMPTY_FILTERS,{map:nextSlug}),true);}
  function changeRoute(slugs:string[]){changeLocation(withRoute(location,slugs));}
  function openPlanner(){setMenuOpen(false);setPlannerOpen(true);}
  function addToRoute(place:Destination){if(routeSlugs.includes(place.slug)||routeSlugs.length>=MAX_ROUTE_STOPS){openPlanner();return;}changeRoute([...routeSlugs,place.slug]);}
  function viewRoute(){navigate(urlFor(EMPTY_FILTERS,{map:"all"}));setPlannerOpen(false);setFitRouteRequest(request=>request+1);}
  function toggleMenu(event:MouseEvent<HTMLButtonElement>){menuTrigger.current=event.currentTarget;setMenuOpen(value=>!value);}
  function cyclePhoto(direction:-1|1){if(current&&current.photos.length)setPhotoIndices(indices=>({...indices,[current.slug]:(photoIndex+direction+current.photos.length)%current.photos.length}));}
  function move(direction:-1|1){const next=navigationPlaces[destinationIndex+direction];if(next)openPlace(next.slug);}
  function nearbyUrl(place:Destination){const matches=results.some(result=>result.slug===place.slug);return urlFor(matches?filters:EMPTY_FILTERS,{slug:place.slug,from:matches?returnView:"map"});}

  useEffect(()=>{document.title=current?`${current.name} – ${locale==="lt"?"Lietuvos kelionių atlasas":"Lithuania Travel Atlas"}`:locale==="lt"?"Lietuva – kelionių atlasas":"Lithuania – Travel Atlas";},[current,locale]);
  useEffect(()=>{if(pathname.startsWith("/places/"))stage.current?.scrollIntoView?.({block:"start",behavior:"instant"});},[pathname]);
  useEffect(()=>{const back=()=>setMenuOpen(false);window.addEventListener("popstate",back);return ()=>window.removeEventListener("popstate",back);},[]);
  useEffect(()=>{function keydown(event:KeyboardEvent){if(event.key==="Escape"&&menuOpen){setMenuOpen(false);menuTrigger.current?.focus();}}window.addEventListener("keydown",keydown);return ()=>window.removeEventListener("keydown",keydown);},[menuOpen]);
  useEffect(()=>{
    if(!menuOpen||!compact||!sidebar.current)return;
    const panel=sidebar.current,oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";closeMenu.current?.focus();
    function trap(event:KeyboardEvent){if(event.key!=="Tab")return;const focusable=Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled),a,summary,select")).filter(element=>element.offsetParent!==null);const first=focusable[0],last=focusable[focusable.length-1];if(!first||!last)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    panel.addEventListener("keydown",trap);
    return ()=>{document.body.style.overflow=oldOverflow;panel.removeEventListener("keydown",trap);menuTrigger.current?.focus();};
  },[menuOpen,compact]);

  function cityButton(item:typeof cities[number]){const count=destinations.filter(place=>place.cityId===item.id).length;return <button key={item.id} className={styles.cityButton} aria-pressed={city===item.id} onClick={()=>chooseCity(item.id)}><span>{item.label}</span><span className={styles.cityCount} aria-label={`${count} ${placeWord(count,locale)}`}>{count}</span></button>;}
  function routeButton(place:Destination,iconOnly=false){const included=routeSlugs.includes(place.slug);return <button className={iconOnly?styles.routeIconButton:styles.routeControl} aria-pressed={included} aria-label={`${t(included?"In your route":"Add to route")}: ${place.name}`} onClick={()=>addToRoute(place)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h8a4 4 0 0 1 0 8H9a2 2 0 0 0 0 4h8"/>{!included&&<path d="M19 3v6m-3-3h6"/>}</svg>{!iconOnly&&<span>{t(included?"In your route":"Add to route")}</span>}</button>;}
  function locateLabel(place:Destination){return locale==="lt"?`Rodyti žemėlapyje: ${place.name}`:`Locate ${place.name} on the map`;}
  const title=cityName?(locale==="lt"?`${cityName}: vietos ir atradimai`:`Explore ${cityName}`):category==="restaurants"?t("Iconic places to eat."):view==="map"?t("Lithuania, an open atlas."):t("Find your next discovery.");
  const resultsText=`${results.length} ${placeWord(results.length,locale)} ${cityName?(locale==="lt"?`· ${cityName}`:`in and around ${cityName}`):locale==="lt"?"visoje Lietuvoje":"across Lithuania"}`;
  const photo=current?.photos[photoIndex];

  return <div className={`${styles.guide} ${view==="map"?styles.mapMode:""}`}>
    <a className={styles.skipLink} href="#atlas-content">{t("Skip to places")}</a>
    <aside ref={sidebar} id="guide-contents" className={`${styles.sidebar} ${menuOpen?styles.sidebarOpen:""}`} role={compact&&menuOpen?"dialog":undefined} aria-modal={compact&&menuOpen?true:undefined} aria-label={t("Places in Lithuania")}>
      <div className={styles.brandRow}><button className={styles.brand} onClick={()=>navigate(`/${locale}`)}>{locale==="lt"?"lietuva":"lithuania"}<span>.</span><small>{t("Your guide to Lithuania")}</small></button><button ref={closeMenu} className={styles.closeMenu} onClick={()=>setMenuOpen(false)} aria-label={t("Close navigation")}>×</button></div>
      <nav className={styles.primaryNav} aria-label={t("Location filter")}><button aria-pressed={city==="all"} onClick={()=>chooseCity("all")}>{t("All Lithuania")} <span>{destinations.length}</span></button></nav>
      <div className={styles.navHeading}>{t("Cities & towns")}</div><p className={styles.navHint}>{t("Including nearby sights")}</p>
      <nav aria-label={t("Cities and towns")} className={styles.cityNav}>{cities.slice(0,8).map(cityButton)}<details className={styles.moreTowns}><summary>{t("More towns")}</summary>{cities.slice(8).map(cityButton)}</details></nav>
      <div className={styles.sidebarFooter}><button className={styles.plannerShortcut} onClick={openPlanner}><span>{t("Plan your route")}</span><span>{routeSlugs.length} / {MAX_ROUTE_STOPS}</span></button><span>{t("Build a trip from the places you discover.")}</span></div>
    </aside>
    {menuOpen&&compact&&<button className={styles.menuBackdrop} tabIndex={-1} aria-label={t("Close navigation")} onClick={()=>setMenuOpen(false)}/>}
    <div className={styles.workspace} inert={menuOpen&&compact?true:undefined}>
      <header className={styles.toolbar}>
        <div><button className={styles.menuButton} aria-expanded={menuOpen} aria-controls="guide-contents" onClick={toggleMenu}>{t("Locations")}</button><a className={styles.toolbarTitle} href="#travel-essentials" onClick={event=>{event.preventDefault();if(essentials.current){essentials.current.open=true;essentials.current.scrollIntoView({block:"start",behavior:"instant"});essentials.current.focus({preventScroll:true});}}}><span className={styles.longInfo}>{t("Travel essentials")}</span><span className={styles.shortInfo}>{t("Info")}</span></a></div>
        <nav className={styles.viewTabs} aria-label={t("Explore Lithuania")}><button aria-pressed={view==="map"&&category!=="restaurants"} onClick={exploreMap}>{t("Explore the map")}</button><button aria-pressed={view==="discover"} onClick={()=>navigate(urlFor(filters))}>{t("Browse places")}</button><button aria-pressed={view==="map"&&category==="restaurants"} onClick={openFood}>{t("Where to eat")}</button></nav>
        <button className={styles.plannerTrigger} onClick={openPlanner}><span className={styles.longInfo}>{t("Plan your route")}</span><span className={styles.shortInfo}>{t("Route")}</span><span>{routeSlugs.length}</span></button>
        <nav className={styles.languageSwitch} aria-label={t("Language")}><a href={switchLocaleUrl(location,"en")} hrefLang="en" lang="en" aria-label="English" aria-current={locale==="en"?"page":undefined}>EN</a><a href={switchLocaleUrl(location,"lt")} hrefLang="lt" lang="lt" aria-label="Lietuvių" aria-current={locale==="lt"?"page":undefined}>LT</a></nav>
      </header>
      <main ref={stage} id="atlas-content" className={styles.main} tabIndex={-1} aria-label={current?.name??t(view==="map"?"Destination map":"Discover places")}>
        {!current&&<section className={styles.discoveryHeader} aria-label={t("Find places")}>
          <div className={styles.discoveryMasthead}><p className={styles.eyebrow}>{t("Places, landscapes & little detours")}</p><h1 className={styles.discoveryTitle}>{title}</h1><p className={styles.headerDescription}>{t(category==="restaurants"?"An editorial selection of restaurants, cafés and local food traditions. Not a ranking.":"Find places worth visiting and plan your next trip.")}</p></div>
          <div className={styles.searchToolbar}>
            <label className={styles.searchField}><span className={styles.srOnly}>{t("Search places")}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="destination-search" type="search" value={query} placeholder={cityName?(locale==="lt"?`Ieškoti vietovėje: ${cityName}…`:`Search in ${cityName}…`):t("Search places, towns or keywords…")} onChange={event=>updateFilters({query:event.target.value},true)}/></label>
            <label className={styles.mobileLocation}>{t("Location")}<select aria-label={t("Location")} value={city} onChange={event=>chooseCity(event.target.value as CityId)}><option value="all">{t("All Lithuania")}</option>{cities.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          </div>
          <div className={styles.categoryPills} role="group" aria-label={t("Category")}>{categories.map(item=><button key={item.id} aria-pressed={category===item.id} onClick={()=>updateFilters({category:item.id})}>{t(item.label)}</button>)}</div>
          <div className={styles.browseStrip}><div className={styles.collectionTabs} role="group" aria-label={t("Collection")}>{(["all","popular","hidden"] as const).map(value=><button key={value} aria-pressed={collection===value} onClick={()=>updateFilters({collection:value})}>{t(value==="all"?"All places":value==="popular"?"First-time favourites":"Hidden gems")}</button>)}</div><div className={styles.resultsHeading}><p role="status">{resultsText}</p>{hasFilters&&<button onClick={resetFilters}>{t("Clear filters")} ×</button>}</div></div>
          {view==="map"&&query&&!focusSlug&&results.length>0&&<ul className={styles.searchMatches} aria-label={t("Matching places")}>{results.map(place=><li key={place.slug}><a href={urlFor(filters,{slug:place.slug,from:"map"})} onClick={event=>internalClick(event,()=>openPlace(place.slug))}><strong>{place.name}</strong><span>{place.location}</span></a><button aria-label={locateLabel(place)} onClick={()=>openMap(place.slug)}>{t("Show on map")}</button></li>)}</ul>}
        </section>}
        {current?<div className={`${styles.detailLayout} ${!photo?styles.plainDetail:""}`}>
          <article className={styles.sheet}>
            <div className={styles.pageRunning}><button onClick={()=>navigate(returnView==="map"?urlFor(filters,{map:current.slug}):urlFor(filters))}>← {t("Back to Explore")}</button><span>{t(categories.find(item=>item.id===current.category)!.label)}</span></div>
            <div className={styles.detailHeading}><p className={styles.placeLocation}>{current.location}</p><h1 className={styles.destinationTitle}>{current.name}</h1>{current.cuisine&&<p className={styles.venueCuisine}>{current.cuisine}</p>}{current.address&&<p className={styles.venueAddress}>{current.address}</p>}<div className={styles.placeCoordinates} aria-label={t("Reference coordinates")}><span>{current.coordinates[0].toFixed(3)}° {locale==="lt"?"š. pl.":"N"}</span><span>{current.coordinates[1].toFixed(3)}° {locale==="lt"?"r. ilg.":"E"}</span></div><p className={styles.description}>{current.description}</p></div>
            <div className={styles.placeActions}><a className={styles.primaryAction} href={directionsUrl(current)} target="_blank" rel="noopener noreferrer">{t("Get directions")} ↗</a><button className={styles.secondaryAction} onClick={()=>openMap(current.slug)}>{t("Show on map")}</button>{routeButton(current)}{current.category==="restaurants"&&<a className={styles.secondaryAction} href={current.sources.find(source=>source.label==="Visitor information")?.url} target="_blank" rel="noopener noreferrer">{t("Menu & visitor information")} ↗</a>}</div>
            <section><h2 className={styles.detailLabel}>{t("Why visit")}</h2><ul className={styles.reasons}>{current.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></section>
            <section><h2 className={styles.detailLabel}>{t("Before you go")}</h2><ul className={styles.visitorInfo}>{current.visitorInfo.map(info=><li key={info}>{info}</li>)}</ul><p className={styles.coordinateNote}>{current.coordinateNote} {t(current.category==="restaurants"?"Directions use the published street address.":"Directions use this reference pin.")}</p>{current.category!=="restaurants"&&current.sources.find(source=>source.label==="Visitor information")&&<a className={styles.visitorLink} href={current.sources.find(source=>source.label==="Visitor information")!.url} target="_blank" rel="noopener noreferrer">{t("Check visitor information")} ↗</a>}</section>
            <details className={styles.sources}><summary>{t(current.photos.length?"Sources & photography":"Sources")}</summary><p>{t("References reviewed")} {new Intl.DateTimeFormat(locale==="lt"?"lt-LT":"en-GB",{dateStyle:"long",timeZone:"UTC"}).format(new Date(current.reviewed+"T00:00:00Z"))}. {t("Check the linked operator for current hours, prices and closures.")}</p><a href={current.coordinateSource} target="_blank" rel="noopener noreferrer">{t("Coordinates")}: {current.coordinates[0].toFixed(5)}, {current.coordinates[1].toFixed(5)} ↗</a>{current.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{sourceLabel(source.label,locale)} ↗</a>)}{current.photos.map(image=><p key={image.src}><PhotoCredit photo={image}/> · {t("Display crop.")}</p>)}{!current.photos.length&&<p>{t("No licensed venue photograph is included; no stock food images are used.")}</p>}</details>
            <section className={styles.nearbySection} aria-label={t("Nearby places")}><h2 className={styles.detailLabel}>{t("Explore nearby")}</h2><p>{t("Approximate straight-line distances between reference pins. Check directions for actual routes.")}</p><ul>{nearby.map(({place,distanceKm})=><li key={place.slug}><a href={nearbyUrl(place)} onClick={event=>internalClick(event,()=>navigate(nearbyUrl(place)))}><strong>{place.name}</strong><span>{place.location}</span></a><span>{distanceKm<1?"<1":Math.round(distanceKm)} km</span></li>)}</ul></section>
            <nav className={styles.destinationNav} aria-label={t("More destinations")}>{navigationPlaces.length>1?<><button aria-label={t("Previous place")} disabled={destinationIndex<=0} onClick={()=>move(-1)}><span>← {t("Previous place")}</span><small>{navigationPlaces[destinationIndex-1]?.name}</small></button><button aria-label={t("Next place")} disabled={destinationIndex>=navigationPlaces.length-1} onClick={()=>move(1)}><span>{t("Next place")} →</span><small>{navigationPlaces[destinationIndex+1]?.name}</small></button></>:<button onClick={()=>navigate(`/${locale}`)}>{t("Explore all places")} →</button>}</nav>
          </article>
          {photo&&<div className={styles.photoColumn}><article className={styles.detailPhoto}>
            <PlaceImage place={current} index={photoIndex} className={styles.fullPhoto} priority/><div className={styles.photoGradient}/><button className={styles.expandPhoto} onClick={()=>photoDialog.current?.showModal()}>{t("View full photograph")} ↗</button>
            <div className={styles.galleryControls} data-gallery onKeyDown={event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();cyclePhoto(event.key==="ArrowLeft"?-1:1);}}}>{current.photos.length>1&&<button aria-label={t("Previous photograph")} onClick={()=>cyclePhoto(-1)}>←</button>}<span role="status">{t("Photo")} {photoIndex+1} {t("of")} {current.photos.length}</span>{current.photos.length>1&&<button aria-label={t("Next photograph")} onClick={()=>cyclePhoto(1)}>→</button>}</div><div className={styles.featureCredit}><PhotoCredit photo={photo}/></div>
          </article></div>}
        </div>:view==="map"?<section className={styles.mapSection} aria-label={t("Map results")}>
          <div className={styles.atlasSpread}>
            <DestinationMap routePlaces={routePlaces} fitRouteRequest={fitRouteRequest} locale={locale} viewportKey={viewportKey} places={results} focusedSlug={focusSlug} onSelect={selectMarker}/>
            {mapFeature&&<aside key={mapFeature.slug} className={styles.atlasFeature} data-kind={mapFeature.category} aria-label={t("Selected destination")}>
              <div className={styles.atlasPlate}><PlaceImage place={mapFeature} className={styles.fullPhoto} sizes="(max-width: 760px) 38vw, 320px"/>{mapFeature.photos.length>0&&<div className={styles.photoGradient}/>}<button className={styles.closePreview} aria-label={t("Close destination preview")} onClick={()=>selectMarker("all")}>×</button>{routeButton(mapFeature,true)}{mapFeature.photos[0]&&<div className={styles.featureCredit}><PhotoCredit photo={mapFeature.photos[0]}/></div>}</div>
              <div className={styles.atlasCaption}><span>{mapFeature.address?`${mapFeature.address} · ${cities.find(item=>item.id===mapFeature.cityId)?.label}`:mapFeature.location}</span><h2>{mapFeature.name}</h2><p>{mapFeature.cuisine??mapFeature.reasons[0]}</p><div className={styles.atlasActions}><a href={urlFor(filters,{slug:mapFeature.slug,from:"map"})} onClick={event=>internalClick(event,()=>openPlace(mapFeature.slug))}>{t("Open destination")} <span aria-hidden="true">↗</span></a><a className={styles.previewDirections} href={directionsUrl(mapFeature)} target="_blank" rel="noopener noreferrer">{t("Directions")} ↗</a></div></div>
            </aside>}
          </div>
          {!results.length&&<div className={styles.emptyState}><h2>{t("No places match these filters.")}</h2><button onClick={resetFilters}>{t("Show all places")}</button></div>}
        </section>:<div className={`${styles.discoveryLayout} ${!featured?styles.listOnly:""}`}>
          <section className={styles.resultsSection} aria-label={t("Places to visit")}><ol className={styles.placeList}>{results.map(place=><li key={place.slug} className={styles.placeRow}><a href={urlFor(filters,{slug:place.slug,from:"places"})} className={styles.rowLink} onClick={event=>internalClick(event,()=>openPlace(place.slug))}><PlaceImage place={place} className={styles.rowImage} sizes="(max-width: 600px) 90px, 120px"/><span><span className={styles.rowCategory}>{t(categories.find(item=>item.id===place.category)!.label)}</span><strong>{place.name}</strong><small>{place.address?`${place.address} · ${cities.find(item=>item.id===place.cityId)?.label}`:place.location}</small></span></a><button className={styles.rowLocate} aria-label={locateLabel(place)} onClick={()=>openMap(place.slug)}><span aria-hidden="true">⌖</span>{t("Map")}</button></li>)}</ol>{!results.length&&<div className={styles.emptyState}><h2>{t("No places found.")}</h2><p>{t("Try another name or remove a filter.")}</p><button onClick={resetFilters}>{t("Show all places")}</button>{city!=="all"&&<button onClick={()=>updateFilters({city:"all"})}>{t("Search all Lithuania")}</button>}</div>}</section>
          {featured&&<aside className={styles.featurePhoto} aria-label={t("A place to start")}><PlaceImage place={featured} className={styles.fullPhoto}/><div className={styles.photoGradient}/><div className={styles.featureCaption}><span>{featured.location}</span><h2>{featured.name}</h2><p>{featured.reasons[0]}</p><a href={urlFor(filters,{slug:featured.slug,from:"places"})} onClick={event=>internalClick(event,()=>openPlace(featured.slug))}>{t("Explore this place")} →</a></div><div className={styles.featureCredit}><PhotoCredit photo={featured.photos[0]}/></div></aside>}
        </div>}
        <details ref={essentials} id="travel-essentials" tabIndex={-1} className={styles.travelEssentials}><summary>{t("Getting around & useful travel links")}</summary><button className={styles.closeEssentials} onClick={()=>{if(essentials.current)essentials.current.open=false;}}>{t("Close travel essentials")} ×</button><p className={styles.resourcesIntro}>{t("Plan the practical part of your visit. These links take you directly to visitor services; check them for current arrangements.")}</p><div className={styles.resourceList}>{resources.map(resource=><article key={resource.url}><h2>{resource.title}</h2><p>{resource.description}</p><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.label} ↗</a></article>)}</div></details>
        {current&&photo&&<dialog ref={photoDialog} className={styles.photoViewer} data-gallery aria-label={`${current.name} · ${t("Photo")}`} onClick={event=>{if(event.target===event.currentTarget)photoDialog.current?.close();}}><button className={styles.closeViewer} onClick={()=>photoDialog.current?.close()}>{t("Close photograph")} ×</button><Image src={imageSource(photo)} alt={photo.alt} width={photo.width} height={photo.height} sizes="100vw" quality={90} style={{objectFit:"contain",width:"auto",height:"auto",maxWidth:"100%",maxHeight:"calc(100dvh - 150px)"}}/><p>{current.name} · <PhotoCredit photo={photo}/></p></dialog>}
        <footer className={styles.pageFooter}><span>{t("Lithuania")} · {places.length} {locale==="lt"?"atrinktų vietų":"curated places"}</span><span>{t("Independent guide. No popularity rankings.")}</span></footer>
      </main>
      <RoutePlannerPanel open={plannerOpen} stops={routePlaces} onClose={()=>setPlannerOpen(false)} onChange={changeRoute} onViewMap={viewRoute}/>
      <span className={styles.srOnly} role="status">{current?.name??mapFeature?.name??""} · {t("Route stops")}: {routeSlugs.length}</span>
    </div>
    <nav className={styles.mobileDock} aria-label={t("Mobile navigation")}><button aria-current={view==="map"&&category!=="restaurants"?"page":undefined} onClick={exploreMap}>{t("Explore map")}</button><button aria-current={view==="discover"?"page":undefined} onClick={()=>navigate(urlFor(filters))}>{t("Places")}</button><button aria-current={view==="map"&&category==="restaurants"?"page":undefined} onClick={openFood}>{t("Food")}</button><button onClick={openPlanner}>{t("Route")} {routeSlugs.length>0&&<span>{routeSlugs.length}</span>}</button></nav>
  </div>;
}
