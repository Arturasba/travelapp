import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DiscoveryGuide from "../../../discovery-guide";
import { destinations, getDestination } from "../../../destinations";
import { isLocale } from "../../../locale";
import { localizeDestination } from "../../../i18n";

export function generateStaticParams() { return destinations.map(place => ({ slug: place.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string;lang:string }> }): Promise<Metadata> {
  const { slug,lang } = await params;
  const original = getDestination(slug);
  const place = original&&isLocale(lang)?localizeDestination(original,lang):undefined;
  return { title: place ? `${place.name} – ${lang==="lt"?"Lietuvos kelionių atlasas":"Lithuania Travel Atlas"}` : lang==="lt"?"Vieta nerasta":"Place not found", description: place?.description,alternates:{canonical:`/${lang}/places/${slug}`,languages:{en:`/en/places/${slug}`,lt:`/lt/places/${slug}`}} };
}
export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDestination(slug)) notFound();
  return <DiscoveryGuide initialSlug={slug} />;
}
