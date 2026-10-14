export const locales = ["en", "lt"] as const;
export type Locale = typeof locales[number];
export function isLocale(value: string): value is Locale { return value === "en" || value === "lt"; }
export function stripLocale(location: string) { return location.replace(/^\/(en|lt)(?=\/|\?|$)/, "") || "/"; }
export function switchLocaleUrl(location: string, locale: Locale) {
  const path = stripLocale(location);
  return `/${locale}${path === "/" ? "" : path}`;
}
