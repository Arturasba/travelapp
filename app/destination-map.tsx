"use client";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { categories, destinations } from "./destinations";
import type { Destination } from "./destinations";
import { clusterPlaces } from "./map-clusters";
import { readMapViewport, saveMapViewport } from "./map-viewport";
import type { Locale } from "./locale";
import { translator } from "./i18n";
import styles from "./guide.module.css";
type Props = { places: Destination[]; viewportKey: string; focusedSlug: string | null; onSelect: (slug: string) => void; locale?:Locale;routePlaces?:Destination[];fitRouteRequest?:number };
const EMPTY_ROUTE:Destination[]=[];
const LITHUANIA_BOUNDS: L.LatLngBoundsExpression = [[53.85,20.9],[56.5,26.9]];
export default function DestinationMap({ places, viewportKey, focusedSlug, onSelect, locale="en",routePlaces=EMPTY_ROUTE,fitRouteRequest=0 }: Props) {
  const t=translator(locale);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const callbacks = useRef({ onSelect, focusedSlug });
  const activeViewport = useRef({ key: viewportKey, focusedSlug });
  const restoredFocus = useRef<string | null | undefined>(undefined);
  const lastRouteFit = useRef(0);
  const [tileError,setTileError] = useState(false);
  useEffect(()=>{ callbacks.current={onSelect,focusedSlug}; },[onSelect,focusedSlug]);
  useEffect(()=>{
    if(!container.current) return;
    const instance=L.map(container.current,{scrollWheelZoom:true,dragging:true,touchZoom:true,doubleClickZoom:true,keyboard:true,zoomControl:true}).setView([55.25,23.8],7);
    instance.zoomControl.remove();
    instance.zoomControl.options.zoomInTitle=locale==="lt"?"Priartinti":"Zoom in";
    instance.zoomControl.options.zoomOutTitle=locale==="lt"?"Atitolinti":"Zoom out";
    instance.zoomControl.addTo(instance);
    map.current=instance;
    function remember(){const center=instance.getCenter();saveMapViewport(activeViewport.current.key,{center:[center.lat,center.lng],zoom:instance.getZoom(),focusedSlug:activeViewport.current.focusedSlug});}
    instance.on("moveend",remember);
    tiles.current=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${locale==="lt"?"autoriai":"contributors"}`}).addTo(instance);
    tiles.current.on("tileerror",()=>setTileError(true));
    layer.current=L.layerGroup().addTo(instance);
    const observer=new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer.observe(container.current);
    return ()=>{remember();instance.off("moveend",remember);observer.disconnect();instance.remove();map.current=null;layer.current=null;tiles.current=null;};
  },[locale]);
  useEffect(()=>{
    const instance=map.current,group=layer.current;if(!instance||!group)return;
    activeViewport.current={key:viewportKey,focusedSlug:callbacks.current.focusedSlug};
    const saved=readMapViewport(viewportKey);restoredFocus.current=saved?.focusedSlug;
    function drawPins(){
      group!.clearLayers();
      for(const cluster of clusterPlaces(places,instance!.getZoom())){
        if(cluster.places.length>1){
          const count=cluster.places.length;
          const icon=L.divIcon({className:"destination-cluster",html:`<span>${count}</span>`,iconSize:[46,46],iconAnchor:[23,23]});
          L.marker(cluster.center,{icon,title:locale==="lt"?`Vietų šioje srityje: ${count}`:`Explore ${count} places in this area`,keyboard:true}).on("click",()=>instance!.fitBounds(L.latLngBounds(cluster.places.map(place=>place.coordinates)),{padding:[65,65],maxZoom:Math.min(15,instance!.getZoom()+3),animate:!window.matchMedia("(prefers-reduced-motion: reduce)").matches})).addTo(group!);
        }else{
          const place=cluster.places[0];
          const color=categories.find(item=>item.id===place.category)?.color??"#667b50";
          const icon=L.divIcon({className:`destination-pin${callbacks.current.focusedSlug===place.slug?" destination-pin-selected":""}`,html:`<span style="background:${color}"></span>`,iconSize:[44,44],iconAnchor:[22,35]});
          L.marker(place.coordinates,{icon,title:place.name,alt:place.name,keyboard:true}).on("click",()=>callbacks.current.onSelect(place.slug)).addTo(group!);
        }
      }
    }
    instance.on("zoomend",drawPins);
    instance.on("atlas:selection",drawPins);
    if(saved)instance.setView(saved.center,saved.zoom,{animate:false});
    else if(places.length&&places.length<destinations.length)instance.fitBounds(L.latLngBounds(places.map(place=>place.coordinates)),{padding:[45,45],maxZoom:12,animate:false});
    else instance.fitBounds(LITHUANIA_BOUNDS,{padding:[25,25],animate:false});
    drawPins();
    return ()=>{instance.off("zoomend",drawPins);instance.off("atlas:selection",drawPins);};
  },[places,viewportKey,locale]);
  useEffect(()=>{
    activeViewport.current.focusedSlug=focusedSlug;
    map.current?.fire("atlas:selection");
    const place=places.find(item=>item.slug===focusedSlug);if(!place||!map.current)return;
    if(restoredFocus.current!==focusedSlug)map.current.setView(place.coordinates,15,{animate:false});
    restoredFocus.current=undefined;
  },[focusedSlug,places,viewportKey]);
  useEffect(()=>{
    const instance=map.current;if(!instance||!routePlaces.length)return;
    const route=L.layerGroup().addTo(instance);
    if(routePlaces.length>1)L.polyline(routePlaces.map(place=>place.coordinates),{color:"#975238",weight:3,dashArray:"6 9",opacity:.85,interactive:false}).addTo(route);
    routePlaces.forEach((place,index)=>{
      const icon=L.divIcon({className:"route-stop-pin",html:`<span>${index+1}</span>`,iconSize:[36,36],iconAnchor:[18,18]});
      L.marker(place.coordinates,{icon,title:`${index+1}. ${place.name}`,alt:`${index+1}. ${place.name}`,keyboard:true,zIndexOffset:1000}).on("click",()=>callbacks.current.onSelect(place.slug)).addTo(route);
    });
    if(fitRouteRequest!==lastRouteFit.current){instance.fitBounds(L.latLngBounds(routePlaces.map(place=>place.coordinates)),{padding:[55,55],maxZoom:13,animate:false});lastRouteFit.current=fitRouteRequest;}
    return ()=>{route.remove();};
  },[routePlaces,fitRouteRequest,locale]);
  function reset(){callbacks.current.onSelect("all");map.current?.fitBounds(LITHUANIA_BOUNDS,{padding:[25,25],animate:!window.matchMedia("(prefers-reduced-motion: reduce)").matches});}
  // Leave document-level mouse, touch and keyboard events available to Leaflet.
  return <div className={styles.mapFrame} onWheel={event=>event.stopPropagation()}>
    <div ref={container} className={styles.mapCanvas} role="region" aria-label={t("Interactive map of Lithuania. Drag to pan, zoom to explore grouped places, and select a destination pin.")} />
    <button className={styles.fitMap} onClick={reset}>{t("Reset to Lithuania")}</button>
    {routePlaces.length>1&&<p className={styles.routeLegend}>{t("Route stops")} · {t("Stop order only. Dashed lines are not roads; Google Maps calculates directions and journey times.")}</p>}
    {tileError&&<div className={styles.mapNotice} role="status">{t("The base map could not load. Destinations are still available through search and Browse places.")} <button onClick={()=>{setTileError(false);tiles.current?.redraw();}}>{t("Retry map")}</button></div>}
  </div>;
}
