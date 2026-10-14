import { cities, getDestination } from "./destinations";
import type { Destination } from "./destinations";

// Three intermediate waypoints plus origin/destination also fit mobile Maps URLs.
export const MAX_ROUTE_STOPS = 5;
export function readRoute(location: string): string[] {
  const value = new URLSearchParams(location.split("?")[1] ?? "").get("route") ?? "";
  return [...new Set(value.split(",").filter(slug => !!getDestination(slug)))].slice(0, MAX_ROUTE_STOPS);
}
export function withRoute(location: string, stops: readonly string[]) {
  const [path, search] = location.split("?");
  const params = new URLSearchParams(search);
  const valid = [...new Set(stops.filter(slug => !!getDestination(slug)))].slice(0, MAX_ROUTE_STOPS);
  if (valid.length) params.set("route", valid.join(",")); else params.delete("route");
  return path + (params.size ? `?${params}` : "");
}
export function moveRouteStop(stops: readonly string[], index: number, direction: -1 | 1) {
  const next = [...stops], target = index + direction;
  if (index >= 0 && index < next.length && target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function routeAddress(place: Destination) {
  return place.address ? `${place.address}, ${cities.find(city => city.id === place.cityId)?.label ?? place.cityId}, Lithuania` : place.coordinates.join(",");
}
export function routeDirectionsUrl(stops: readonly Destination[], mode: "driving" | "walking" = "driving") {
  if (stops.length < 2 || stops.length > MAX_ROUTE_STOPS) return null;
  const params = new URLSearchParams({api:"1",origin:routeAddress(stops[0]),destination:routeAddress(stops[stops.length-1]),travelmode:mode});
  if (stops.length > 2) params.set("waypoints", stops.slice(1,-1).map(routeAddress).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}
