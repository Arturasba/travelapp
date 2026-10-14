import type { Destination } from "./destinations";
export type PlaceCluster = { places: Destination[]; center: [number, number] };
/** Screen-sized Mercator cells; at street level reveal individual sites. */
export function clusterPlaces(places: Destination[], zoom: number): PlaceCluster[] {
  if (zoom >= 15) return places.map(place => ({ places: [place], center: place.coordinates }));
  const world = 256 * 2 ** zoom;
  const cells = new Map<string, Destination[]>();
  for (const place of places) {
    const [lat, lng] = place.coordinates;
    const sine = Math.sin(lat * Math.PI / 180);
    const x = (lng + 180) / 360 * world;
    const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world;
    const key = `${Math.floor(x / 58)}:${Math.floor(y / 58)}`;
    const group = cells.get(key) ?? [];
    group.push(place); cells.set(key, group);
  }
  return [...cells.values()].map(group => ({ places: group, center: [group.reduce((sum,p)=>sum+p.coordinates[0],0)/group.length,group.reduce((sum,p)=>sum+p.coordinates[1],0)/group.length] }));
}
