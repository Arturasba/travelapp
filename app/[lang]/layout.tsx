import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "../locale";
import { LocaleProvider } from "../locale-context";
import "leaflet/dist/leaflet.css";
import "../globals.css";
const inter = localFont({ src: "../../public/fonts/InterVariable.woff2", variable: "--font-inter", display: "swap", weight: "100 900" });
const editorial = localFont({ src: "../../public/fonts/NewsreaderVariable.ttf", variable: "--font-editorial", display: "swap", weight: "200 800", adjustFontFallback: "Times New Roman" });
export function generateStaticParams() { return [{lang:"en"},{lang:"lt"}]; }
export async function generateMetadata({params}:{params:Promise<{lang:string}>}):Promise<Metadata> {
  const {lang}=await params;
  return {title:lang==="lt"?"Lietuva – kelionių atlasas":"Lithuania – Travel Atlas",description:lang==="lt"?"Atraskite Lietuvos miestus, pilis, gamtą, pajūrį ir įsimintinas vietas pavalgyti interaktyviame žemėlapyje.":"Discover Lithuania’s cities, castles, nature, coast and iconic places to eat on an interactive map.",alternates:{canonical:`/${lang}`,languages:{en:"/en",lt:"/lt"}}};
}
export default async function RootLayout({ children,params }: {children:ReactNode;params:Promise<{lang:string}>}) {
    const {lang}=await params;
    if(!isLocale(lang))notFound();
    return (<html lang={lang} className={`${inter.variable} ${editorial.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><LocaleProvider locale={lang}>{children}</LocaleProvider></body>
    </html>);
}
