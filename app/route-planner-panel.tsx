"use client";

import { useMemo, useState } from "react";
import type { Destination } from "./destinations";
import { filterDestinations } from "./destinations";
import { useLocale } from "./locale-context";
import { localizeDestination, translator } from "./i18n";
import { MAX_ROUTE_STOPS, moveRouteStop, routeDirectionsUrl } from "./route-planner";
import { isDialogBackdrop, useDialog } from "./use-dialog";
import styles from "./guide.module.css";

type Props = {open:boolean;stops:Destination[];onClose:()=>void;onChange:(slugs:string[])=>void;onViewMap:()=>void};
export default function RoutePlannerPanel({open,stops,onClose,onChange,onViewMap}:Props) {
  const locale=useLocale(),t=translator(locale);
  const dialog=useDialog(open);
  const [query,setQuery]=useState("");
  const [mode,setMode]=useState<"driving"|"walking">("driving");
  const [copyStatus,setCopyStatus]=useState<"idle"|"copied"|"fallback">("idle");
  const slugs=stops.map(stop=>stop.slug);
  const matches=useMemo(()=>query.trim()?filterDestinations(query,"all","all").map(place=>localizeDestination(place,locale)):[],[query,locale]);
  const directions=routeDirectionsUrl(stops,mode);
  async function copyLink(){
    try {await navigator.clipboard.writeText(window.location.href);setCopyStatus("copied");}
    catch {setCopyStatus("fallback");}
  }
  function change(next:string[]){setCopyStatus("idle");onChange(next);}
  return <dialog ref={dialog} className={styles.routePlanner} aria-labelledby="route-planner-title" onCancel={onClose} onClose={onClose} onClick={event=>{if(isDialogBackdrop(event))onClose();}}>
    <div className={styles.plannerHeader}><div><p>{t("Plan your route")}</p><h2 id="route-planner-title">{t("Your route")}</h2></div><button aria-label={t("Close route planner")} onClick={onClose}>×</button></div>
    <p className={styles.plannerIntro}>{t("Choose up to five stops, put them in order, then open directions.")}</p>
    <label className={styles.plannerSearch}><span>{t("Find a stop")}</span><input autoComplete="off" type="search" value={query} placeholder={t("Search for a place or restaurant…")} onChange={event=>setQuery(event.target.value)}/></label>
    {query.trim()&&<div className={styles.plannerMatches} aria-label={t("Matching places")}><ul>{matches.slice(0,8).map(place=><li key={place.slug}><span><strong>{place.name}</strong><small>{place.location}</small></span><button disabled={slugs.includes(place.slug)||stops.length>=MAX_ROUTE_STOPS} aria-label={`${t("Add to route")}: ${place.name}`} onClick={()=>{change([...slugs,place.slug]);setQuery("");}}>{t(slugs.includes(place.slug)?"In your route":"Add")}</button></li>)}</ul>{!matches.length&&<p role="status">{t("No places found.")}</p>}</div>}
    <div className={styles.plannerCount}><h3>{t("Route stops")}</h3><span>{stops.length} / {MAX_ROUTE_STOPS}</span></div>
    {!stops.length?<div className={styles.plannerEmpty}><svg viewBox="0 0 64 64" aria-hidden="true" fill="none"><circle cx="15" cy="16" r="6"/><circle cx="49" cy="48" r="6"/><path d="M21 16h17a10 10 0 0 1 0 20H25a6 6 0 0 0 0 12h18"/></svg><h3>{t("Your trip starts with a place.")}</h3><p>{t("Find your first stop above, or add places while exploring the map.")}</p></div>:<ol className={styles.plannerStops}>{stops.map((place,index)=><li key={place.slug}><span className={styles.stopNumber}>{index+1}</span><div><strong>{place.name}</strong><span>{place.location}</span><div className={styles.stopActions}><button disabled={index===0} aria-label={`${t("Move earlier")}: ${place.name}`} onClick={()=>change(moveRouteStop(slugs,index,-1))}>↑ {t("Move earlier")}</button><button disabled={index===stops.length-1} aria-label={`${t("Move later")}: ${place.name}`} onClick={()=>change(moveRouteStop(slugs,index,1))}>↓ {t("Move later")}</button></div></div><button className={styles.removeStop} aria-label={`${t("Remove stop")}: ${place.name}`} onClick={()=>change(slugs.filter(slug=>slug!==place.slug))}>×</button></li>)}</ol>}
    <p className={styles.plannerFeedback} role="status">{stops.length===MAX_ROUTE_STOPS?t("Five stops added. Remove one to add another."):stops.length===1?t("Add one more stop to get directions."):""}</p>
    {stops.length>0&&<div className={styles.plannerFooter}>
      <div className={styles.travelMode} role="group" aria-label={t("Travel mode")}>{(["driving","walking"] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{t(value==="driving"?"Driving":"Walking")}</button>)}</div>
      <div className={styles.plannerPrimary}>{directions?<a href={directions} className={styles.primaryAction} target="_blank" rel="noopener noreferrer">{t("Open in Google Maps")} ↗</a>:<button className={styles.primaryAction} disabled>{t("Open in Google Maps")}</button>}<button className={styles.secondaryAction} onClick={onViewMap}>{t("View route on map")}</button></div>
      <p className={styles.plannerNote}>{t("Stop order only. Dashed lines are not roads; Google Maps calculates directions and journey times.")}</p>
      <div className={styles.plannerLinks}><button onClick={copyLink}>{t(copyStatus==="copied"?"Link copied":"Copy route link")}</button><button onClick={()=>change([])}>{t("Clear route")}</button></div>
      {copyStatus==="fallback"&&<p role="status" className={styles.plannerNote}>{t("Copy the URL from your address bar to share this route.")}</p>}
    </div>}
    {!stops.length&&<button className={styles.secondaryAction} onClick={onClose}>{t("Browse more places")}</button>}
  </dialog>;
}
