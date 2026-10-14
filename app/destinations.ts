import assetRecords from "./data/destination-assets.json";
import expandedPlaces from "./data/expanded-destinations.json";
import restaurants from "./data/restaurants.json";
import lithuanian from "./data/destinations.lt.json";

export const categories = [
  { id: "all", label: "All places", color: "#667b50" },
  { id: "cities", label: "Cities", color: "#9a6a51" },
  { id: "castles", label: "Castles", color: "#9d7851" },
  { id: "nature", label: "Nature", color: "#517957" },
  { id: "coast", label: "Coast", color: "#527d89" },
  { id: "culture", label: "Culture & curiosities", color: "#8b6b88" },
  { id: "restaurants", label: "Restaurants & cafés", color: "#b36738" },
] as const;
export type Category = typeof categories[number]["id"];
export type Collection = "all" | "popular" | "hidden";
const originalCities = [
  { id: "vilnius", label: "Vilnius" }, { id: "kaunas", label: "Kaunas" },
  { id: "klaipeda", label: "Klaipėda" }, { id: "siauliai", label: "Šiauliai" },
  { id: "trakai", label: "Trakai" }, { id: "druskininkai", label: "Druskininkai" },
  { id: "nida", label: "Nida" }, { id: "palanga", label: "Palanga" },
  { id: "anyksciai", label: "Anykščiai" }, { id: "juodkrante", label: "Juodkrantė" },
  { id: "kernave", label: "Kernavė" }, { id: "plunge", label: "Plungė" },
  { id: "jurbarkas", label: "Jurbarkas" }, { id: "varena", label: "Varėna" },
] as const;
export const cities = [...originalCities, ...[...new Map(expandedPlaces.map(place=>[place.cityId,{id:place.cityId,label:place.location.split(" · ")[0]}])).values()].filter(city=>!originalCities.some(original=>original.id===city.id)).sort((a,b)=>a.label.localeCompare(b.label))];
export type CityId = "all" | typeof cities[number]["id"];
const cityBySlug: Record<string, CityId> = {
  "vilnius-old-town": "vilnius", "gediminas-tower": "vilnius", "puckoriai-outcrop": "vilnius",
  "pazaislis-monastery": "kaunas", "klaipeda-old-town": "klaipeda", "hill-of-crosses": "siauliai",
  "trakai-island-castle": "trakai", "druskininkai": "druskininkai", "nida": "nida",
  "palanga-amber-museum": "palanga", "anyksciai-regional-park": "anyksciai", "hill-of-witches": "juodkrante",
  "kernave": "kernave", "cold-war-museum": "plunge", "panemune-castle": "jurbarkas", "dzukija-national-park": "varena",
};
export type Photo = { src: string; alt: string; author: string; license: string; licenseUrl: string; source: string; width: number; height: number };
export type Destination = {
  slug: string; name: string; location: string; category: Exclude<Category, "all">;
  cityId: CityId;
  coordinates: [number, number]; coordinateSource: string; coordinateNote: string;
  description: string; reasons: string[]; visitorInfo: string[];
  featured: boolean; hidden: boolean; photos: Photo[]; sources: { label: string; url: string }[];
  reviewed: string;
  address?: string; cuisine?: string;
};

type Entry = { qid: string; slug: string; name: string; location: string; category: Destination["category"]; description: string; reasons: string[]; visitorInfo: string[]; featured?: boolean; hidden?: boolean; official?: string; coordinateNote?: string; coordinates?: [number, number] };
const entries: Entry[] = [
  { qid:"Q1482013", slug:"trakai-island-castle", name:"Trakai Island Castle", location:"Trakai · Vilnius County", category:"castles", featured:true,
    description:"Red-brick towers rise from an island in Lake Galvė. Cross the bridges into the castle courtyards, explore the museum, then follow the shore for a different view of this former residence of Lithuania’s grand dukes.",
    reasons:["A castle approached across the water", "Historical exhibitions inside the restored complex", "Lakeshore walks and views from Trakai town"],
    visitorInfo:["The castle is reached on foot by bridges from Trakai.","Museum access is ticketed; consult the museum before travelling for current hours, tickets and temporary restrictions."],
    official:"https://lithuania.travel/en/where-to-visit/top-sites-in-lithuania/trakai-castle-a-fairytale-adventure" },
  { qid:"Q445649", slug:"vilnius-old-town", name:"Vilnius Old Town", location:"Vilnius · Vilnius County", category:"cities", featured:true,
    description:"Church towers, university courtyards and narrow streets make Vilnius a rewarding city to explore on foot. Its historic centre brings Gothic, Renaissance and Baroque architecture into an everyday world of cafés, galleries and neighbourhood life.",
    reasons:["A rich mix of architectural styles", "Courtyards and pedestrian discoveries", "An easy starting point for exploring the capital"],
    visitorInfo:["The marker is a central reference point for a large historic district, not a single entrance.","Churches, museums and university buildings set their own visiting arrangements; check the venue you plan to enter."],
    coordinateNote:"Approximate historic-district reference point.", official:"https://lithuania.travel/en/where-to-visit/top-sites-in-lithuania/the-capital-city-vilnius" },
  { qid:"Q1004306", slug:"nida", name:"Nida", location:"Neringa · Curonian Spit", category:"coast", featured:true,
    description:"A lagoon-side settlement on the Curonian Spit, Nida brings wooden houses, fishing heritage and dune landscapes into one compact base. Walk the waterfront, explore the village and use marked routes when heading towards the surrounding dunes.",
    reasons:["Curonian Lagoon waterfront", "Traditional houses and fishing heritage", "A base for exploring dunes and Baltic beaches"],
    visitorInfo:["The pin marks the settlement centre, not the Parnidis Dune viewpoint.","From Klaipėda, reaching the spit involves a ferry crossing; check ferry services and local vehicle-entry arrangements before travelling.","Use marked paths in protected dune areas."],
    coordinateNote:"Settlement reference point; dune and beach access points are separate.", official:"https://lithuania.travel/en/why-lithuania/culture-and-heritage/unesco-heritage/curonian-spit" },
  { qid:"Q1497616", slug:"gediminas-tower", name:"Gediminas Castle Tower", location:"Vilnius · Castle Hill", category:"castles", featured:true,
    description:"The surviving tower of Vilnius’s Upper Castle looks over the Old Town and the Neris. It pairs a compact museum visit with a memorable perspective on the city’s hills, rooftops and changing skyline.",
    reasons:["Views across Vilnius", "The surviving Upper Castle tower", "Museum displays about the city’s history"],
    visitorInfo:["The tower is a branch of the National Museum of Lithuania.","Check the museum’s current access information for hill routes, the funicular and tower admission."],
    official:"https://lnm.lt/en/museums/gediminas-castle-tower/" },
  { qid:"Q223726", slug:"hill-of-crosses", name:"Hill of Crosses", location:"Domantai · near Šiauliai", category:"culture", featured:true,
    description:"Crosses of many sizes gather on a small hill north of Šiauliai. This living pilgrimage site reflects faith, remembrance and the persistence of Lithuanian cross-making traditions. Visit thoughtfully: it remains a place of personal devotion.",
    reasons:["Traditional cross-crafting", "A distinctive pilgrimage landscape", "A powerful place for reflection"],
    visitorInfo:["The site is outside Šiauliai, near Domantai village.","Treat crosses and devotional objects respectfully and leave paths clear for other visitors."],
    official:"https://lithuania.travel/en/where-to-visit/top-sites-in-lithuania/hill-of-crosses" },
  { qid:"Q12660816", slug:"klaipeda-old-town", name:"Klaipėda Old Town", location:"Klaipėda · Baltic coast", category:"cities", featured:true,
    description:"Half-timbered buildings, small streets and a working port’s atmosphere give Klaipėda a character of its own. Explore the Old Town around Theatre Square, then head towards the Danė waterfront to connect the city’s architectural and maritime stories.",
    reasons:["Half-timbered architecture", "Theatre Square and small public sculptures", "Danė River walks"],
    visitorInfo:["The map pin represents the Old Town district, not an attraction entrance.","Individual museums and performances require separate planning; the tourism office is a useful starting point."],
    coordinateNote:"Approximate Old Town district reference point.", official:"https://lithuania.travel/en/where-to-visit/major-cities/klaipeda-major-cities" },
  { qid:"Q1023846", slug:"panemune-castle", name:"Panemunė Castle", location:"Pilies I · Jurbarkas District", category:"castles", hidden:true,
    description:"On the Nemunas route, Panemunė offers a different kind of castle: a residential estate framed by a landscaped park and ponds. The courtyards and historic rooms reveal the ambitions of its former owners rather than a story of medieval sieges.",
    reasons:["Residential castle architecture", "Historic interiors and courtyards", "Parkland along the Nemunas travel route"],
    visitorInfo:["The castle is in Pilies I village in Jurbarkas District.","Grounds, exhibitions, accommodation and dining are different services; confirm the arrangements for the part you want to visit."],
    official:"https://lithuania.travel/en/where-to-visit/undiscovered-gems/panemune-castle" },
  { qid:"Q12670627", slug:"puckoriai-outcrop", name:"Pūčkoriai Outcrop", location:"Pavilniai Regional Park · Vilnius", category:"nature", hidden:true,
    description:"The Vilnia River bends below a steep exposure on Vilnius’s greener eastern edge. The viewpoint and surrounding Pūčkoriai trail make a satisfying detour from the city, with woodland, valley scenery and reminders of the area’s industrial past.",
    reasons:["A dramatic view over the Vilnia valley", "Woodland trails close to Vilnius", "A combination of landscape and local history"],
    visitorInfo:["The Pūčkoriai educational trail includes stairs and bridges; choose footwear for outdoor paths.","The pin marks the outcrop, not every trail access point. Follow signed routes and remain behind viewpoint barriers."],
    official:"https://lithuania.travel/en/where-to-visit/nature/hiking-trails/puckoriai-educational-trail" },
  { qid:"Q582379", slug:"anyksciai-regional-park", name:"Anykščiai Regional Park", location:"Anykščiai District · Aukštaitija", category:"nature",
    description:"The Šventoji valley, pine woods and notable boulders make this park a varied nature stop. Plan a specific walk rather than treating it as one enclosed attraction: woodland landmarks and the treetop walking path are spread across the area.",
    reasons:["Šventoji valley landscapes", "Forest walks and boulder landmarks", "The treetop walking path within the regional park"],
    visitorInfo:["The pin is a park reference point, not the treetop path entrance.","Choose an individual trail or attraction before setting out. Check separate access and ticket arrangements for the treetop walking path."],
    coordinateNote:"Regional park reference point; choose a specific trail access point before travelling.", official:"https://lithuania.travel/en/where-to-visit/nature/observation-towers/treetop-walking-path-in-anyksciai-regional-park" },
  { qid:"Q738428", slug:"dzukija-national-park", name:"Dzūkija National Park", location:"Varėna District · Southern Lithuania", category:"nature",
    description:"Pine forests, rivers and traditional villages define this landscape in southern Lithuania. It rewards a planned walk or village visit more than a quick photo stop. The photograph shows the woodland clearing around Ūlos akis, one of the area’s natural landmarks.",
    reasons:["Forest and river landscapes", "Traditional Dzūkian villages", "Walking and nature-focused exploration"],
    visitorInfo:["The marker is a reference point within the park, not a visitor-centre entrance.","Use park visitor information to select a route. Protected reserves within the wider area can have separate access rules."],
    coordinateNote:"National park reference point; not a visitor centre or guaranteed trailhead.", official:"https://lithuania.travel/en/where-to-visit/regions/dzukija" },
  { qid:"Q826824", slug:"palanga-amber-museum", name:"Palanga Amber Museum", location:"Palanga · Birutė Park", category:"coast", featured:true,
    description:"Inside the Tiškevičiai Palace, amber becomes a way to explore the Baltic’s natural and cultural history. Pair the museum with a walk through the surrounding park for a coastal day that goes beyond the beach.",
    reasons:["Amber displays in a historic palace", "The landscaped surroundings of Birutė Park", "A cultural stop on a Baltic coast trip"],
    visitorInfo:["The museum is in the palace within Birutė Park, Palanga.","Museum admission and park access are separate; consult current museum visitor information before entering the palace."],
    official:"https://lithuania.travel/en/why-lithuania/by-the-baltic-sea" },
  { qid:"Q2028073", slug:"hill-of-witches", name:"Hill of Witches", location:"Juodkrantė · Curonian Spit", category:"coast", hidden:true,
    description:"Wooden figures from folklore inhabit a forested hill in Juodkrantė. Follow the paths between carved characters, letting the stories and the woodland setting become part of a slower Curonian Spit day.",
    reasons:["Lithuanian folklore interpreted in wood", "A sculpture walk under the trees", "A detour within Juodkrantė"],
    visitorInfo:["The sculptures are distributed along woodland paths, rather than inside a single building.","Expect uneven outdoor surfaces; use suitable footwear and avoid climbing on the sculptures."],
    official:"https://lithuania.travel/en/categories/objects/316" },
  { qid:"Q215315", slug:"kernave", name:"Kernavė Archaeological Site", location:"Kernavė · Širvintos District", category:"culture", hidden:true,
    description:"Grass-covered hillforts rise above the Neris valley at a site that preserves traces of prehistoric and medieval settlement. Walk the landscape first, then use the archaeological museum to connect what you see with the lives once lived here.",
    reasons:["A UNESCO-listed archaeological landscape", "Hillfort and Neris valley views", "A setting that connects archaeology and walking"],
    visitorInfo:["The pin represents Kernavė; individual mounds and the museum are separate points within the site.","Wear shoes suited to slopes and steps. Check the museum’s own schedule if you plan to visit its exhibitions."],
    coordinateNote:"Kernavė site reference point; mounds and museum have separate access points.", official:"https://whc.unesco.org/en/list/1137/" },
  { qid:"Q1775811", slug:"pazaislis-monastery", name:"Pažaislis Monastery", location:"Kaunas · Petrašiūnai", category:"culture", hidden:true,
    description:"This Baroque church and monastery ensemble sits on a peninsula beside the Kaunas Reservoir. Architecture, frescoes and the landscaped setting make it a rich stop for travellers interested in art, sacred spaces and a quieter side of Kaunas.",
    reasons:["Baroque architecture and frescoes", "A historic monastery ensemble", "Reservoir-side surroundings"],
    visitorInfo:["The complex is a religious site as well as a visitor destination; respect worship and restricted areas.","Check current visitor and tour arrangements before travelling; access may differ during services or events."],
    official:"https://lithuania.travel/en/where-to-visit/major-cities/kaunas/top-10-places-to-visit-in-kaunas/pazaislis-monastery" },
  { qid:"Q5766160", slug:"cold-war-museum", name:"Cold War Museum · Plokštinė", location:"Plokščiai · Plungė District", category:"culture", hidden:true,
    coordinates:[56.030391,21.906232], coordinateNote:"Official visitor-centre coordinates, rather than the silo’s central point.",
    description:"A former Soviet ballistic-missile base in the Žemaitija countryside now houses an exhibition about the Cold War. The contrast between the quiet forest setting and the former military infrastructure makes this a thought-provoking historical visit.",
    reasons:["A former missile-base setting", "Exhibitions explaining Cold War history", "A distinctive historical detour near Plateliai"],
    visitorInfo:["Visitor address: Šilinė street 4, Plokščiai, Plungė District.","The operator asks visitors to book guided tours in advance. Check the official page for current ticketing, opening times and group arrangements."],
    official:"https://zemaitijosnpd.lrv.lt/en/information-for-visitors/expositions/the-cold-war-exposition1/" },
  { qid:"Q1261509", slug:"druskininkai", name:"Druskininkai", location:"Druskininkai · Southern Lithuania", category:"cities", featured:true,
    description:"A resort town surrounded by the forests of Dzūkija, Druskininkai combines a long spa tradition with lakeside walks and a relaxed town centre. Explore the waterfront, discover local art and choose a wellness or outdoor experience that suits your day.",
    reasons:["Walks around Druskonis Lake and through town parks", "A long-established spa and wellness tradition", "A base for exploring southern Lithuania"],
    visitorInfo:["The pin marks a town reference point, not a spa or attraction entrance.","Spas, museums and activity operators have separate booking and access arrangements; check the venue before travelling."],
    coordinateNote:"Town reference point; select the entrance of your chosen venue before travelling.",
    official:"https://lithuania.travel/en/where-to-visit/top-sites-in-lithuania/spa-and-wellness-in-druskininkai" },
];

const originalDestinations: Destination[] = entries.map(entry => {
  const asset = assetRecords.find(record => record.qid === entry.qid);
  if (!asset || !asset.coordinates) throw new Error(`Missing researched assets for ${entry.slug}`);
  const photos: Photo[] = [asset.image];
  if ("extraImage" in asset && asset.extraImage) photos.push(asset.extraImage);
  return {
    ...entry, cityId: cityBySlug[entry.slug] ?? "all", coordinates: entry.coordinates ?? asset.coordinates as [number, number],
    coordinateSource: entry.coordinates && entry.official ? entry.official : asset.coordinateSource,
    coordinateNote: entry.coordinateNote ?? "Site reference coordinate; confirm the appropriate entrance locally.",
    photos, featured: entry.featured ?? false, hidden: entry.hidden ?? false,
    sources: [{label:"Location reference",url:asset.reference}, ...(entry.official ? [{label:"Visitor information",url:entry.official}] : [])],
    reviewed:"2026-10-13",
  };
});
export const destinations: Destination[] = [...originalDestinations, ...[...expandedPlaces,...restaurants].map(place=>({...place,category:place.category as Destination["category"],coordinates:[place.coordinates[0],place.coordinates[1]] as [number,number]}))];

export function getDestination(slug: string) { return destinations.find(place => place.slug === slug); }
export function normalizeSearch(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
export function filterDestinations(query: string, category: Category, collection: Collection, city: CityId = "all") {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return destinations.filter(place => (category === "all" || place.category === category)
    && (city === "all" || place.cityId === city)
    && (collection === "all" || (collection === "popular" ? place.featured : place.hidden))
    && terms.every(term => {
      const lt = (lithuanian as Record<string,{name:string;description:string}>)[place.slug];
      return normalizeSearch(`${place.name} ${place.location} ${place.description} ${place.category} ${place.address??""} ${place.cuisine??""} ${lt?.name??""} ${lt?.description??""}`).includes(term);
    }));
}

/** Great-circle distance between reference pins; this is not a road itinerary. */
export function distanceKm(a: [number, number], b: [number, number]) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b[0] - a[0]);
  const dLng = radians(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function nearbyDestinations(slug: string, limit = 3) {
  const origin = getDestination(slug);
  if (!origin) return [];
  return destinations.filter(place => place.slug !== slug)
    .map(place => ({ place, distanceKm: distanceKm(origin.coordinates, place.coordinates) }))
    .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, Math.max(0, limit));
}

export function directionsUrl(place: Destination) {
  const destination=place.address?`${place.address}, ${cities.find(city=>city.id===place.cityId)?.label??place.cityId}, Lithuania`:place.coordinates.join(",");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
