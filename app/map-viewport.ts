export type MapViewport = { center: [number, number]; zoom: number; focusedSlug: string | null };
const PREFIX = "lithuania-atlas:map:";

export function readMapViewport(key: string): MapViewport | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PREFIX + key) ?? "null");
    if (!value || !Array.isArray(value.center) || value.center.length !== 2 ||
      !value.center.every((n: unknown) => typeof n === "number" && Number.isFinite(n)) ||
      Math.abs(value.center[0]) > 90 || Math.abs(value.center[1]) > 180 ||
      !Number.isFinite(value.zoom) || value.zoom < 0 || value.zoom > 19 ||
      !(value.focusedSlug === null || typeof value.focusedSlug === "string")) return null;
    return value;
  } catch { return null; }
}

export function saveMapViewport(key: string, viewport: MapViewport) {
  try { sessionStorage.setItem(PREFIX + key, JSON.stringify(viewport)); }
  catch { /* Exploration still works if browser storage is unavailable. */ }
}
