"use client";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Locale } from "./locale";
const LocaleContext = createContext<Locale>("en");
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
