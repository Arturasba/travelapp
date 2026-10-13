import { categories, cities } from "./destinations";
import type { Category, CityId, Collection } from "./destinations";

export type GuideFilters = { query: string; category: Category; city: CityId; collection: Collection };
export function readFilters(location: string): GuideFilters {
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const type = params.get("category");
  const city = params.get("city");
  const collection = params.get("collection");
  return {
    query: params.get("q") ?? "",
    category: categories.some(item => item.id === type) ? type as Category : "all",
    city: cities.some(item => item.id === city) ? city as CityId : "all",
    collection: collection === "popular" || collection === "hidden" ? collection : "all",
  };
}
export function guideUrl(filters: GuideFilters, options: { slug?: string; map?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.city !== "all") params.set("city", filters.city);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.collection !== "all") params.set("collection", filters.collection);
  if (options.map) params.set("map", options.map);
  const path = options.slug ? `/places/${options.slug}` : "/";
  return params.size ? `${path}?${params}` : path;
}
