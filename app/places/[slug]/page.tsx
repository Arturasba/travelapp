import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DiscoveryGuide from "../../discovery-guide";
import { destinations, getDestination } from "../../destinations";

export function generateStaticParams() { return destinations.map(place => ({ slug: place.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = getDestination(slug);
  return { title: place ? `${place.name} — Lithuania Discovery Guide` : "Place not found", description: place?.description };
}
export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getDestination(slug)) notFound();
  return <DiscoveryGuide initialSlug={slug} />;
}
