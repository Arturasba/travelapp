import type { Metadata } from "next";
import localFont from "next/font/local";
import "leaflet/dist/leaflet.css";
import "./globals.css";
const inter = localFont({ src: "../public/fonts/InterVariable.woff2", variable: "--font-inter", display: "swap", weight: "100 900" });
export const metadata: Metadata = {
    title: "Lithuania — The Interactive Travel Atlas",
    description: "Discover real places to visit in Lithuania. Explore castles, cities, nature and the coast through an interactive travel book and map.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
    return (<html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>);
}
