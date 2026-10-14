# Lithuania Travel Atlas · Lietuvos kelionių atlasas

A map-first, bilingual guide to **107 Lithuanian destinations and 7 distinctive restaurants/cafés**, with 123 licensed location-specific photographs. Built with Next.js, React, TypeScript, Tailwind CSS and Leaflet. No backend, accounts or API keys.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. `/` redirects to `/en`; Lithuanian is available at `/lt`.

## Explore

- Explore the map, Browse places and Where to eat remain the primary discovery actions. Desktop town navigation becomes an accessible Locations drawer on mobile, with Map / Places / Food / Route in the bottom navigation.
- Search by destination, town or keyword, in English or Lithuanian. Diacritics are optional. Categories use a horizontal pill rail; All places / First-time favourites / Hidden gems are immediately available as text tabs. Every town has real matching places.
- Native map wheel zoom, dragging, pinch, double-click, keyboard navigation, visible zoom controls and Reset to Lithuania remain enabled. Grouped markers expand as you zoom. Selecting a pin opens one dismissible preview, with destination details and directions one click away.
- Destination pages prioritize photography, concise descriptions, reasons to visit, practical guidance, nearby places and source links. A full-photo dialog shows the uncropped image. Previous/next links are ordinary destination navigation: there are no book chapters, page-turn gestures or global arrow-key interception.
- Add destinations or restaurants to an ordered route from the map preview or destination details. The planner also has its own bilingual place search. Saved places has been retired.
- Travel essentials links directly to researched transport, weather and tourism services. Current timetables, prices and availability remain with the operators.

## English and Lithuanian

Both languages have server-rendered routes, document language and localized metadata:

```text
/en
/lt
/en/places/trakai-island-castle
/lt/places/trakai-island-castle
```

The EN/LT switch preserves the destination and query parameters. Search, filters, selected pins and ordered route stops live in the URL; browser back/forward restores them. Route IDs are shared across languages. Map camera state is stored per filter combination in session storage, so language changes and returns from details can restore the previous view.

## Route planner

Choose up to five stops, reorder them using accessible earlier/later buttons, remove individual stops or clear the route. The planner supports driving and walking directions and copying a shareable atlas URL. A route persists through refreshes and language changes without browser-local shortlist storage or accounts. Copy failures provide an address-bar fallback.

View route on map fits all chosen stops and draws numbered, clickable markers connected by a dashed line. This is explicitly a stop-order diagram, not a road route or estimated travel time. Google Maps calculates actual directions and journey times after opening the link. Restaurant directions use published street addresses; destination directions use their labelled reference pins.

Five stops allow an origin, destination and three intermediate waypoints, matching the mobile-browser limit documented by [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). Some Maps products may not support intermediate waypoints; review the stops after opening directions. There is no automatic route optimization, live routing API, timetable integration or availability checking.

Interface translations are in `app/i18n.ts`; all 114 place descriptions, reasons and visitor notes have Lithuanian counterparts in `app/data/destinations.lt.json`. Search indexes both languages regardless of the interface language. Authors, licenses and proper source names retain their original attribution.

Existing `/places/...` URLs redirect to their English equivalents, preserving queries. `/journal` and localized journal URLs redirect to the atlas. Unsupported languages and unknown destinations show not-found pages.

## Food stops

The initial editorial collection includes Neringa, Lokys and Džiaugsmas in Vilnius; Spurginė and Bernelių užeiga (Senamiestis) in Kaunas; Senoji kibininė in Trakai; and Švyturys BHouse in Klaipėda. It includes cafés and local food traditions, rather than claiming a measured popularity ranking.

`app/data/restaurants.json` stores published addresses, cuisine, original descriptions, operator/tourism references and sourced OpenStreetMap reference coordinates. Directions use the published street address. Pins indicate the venue area and do not promise an independently surveyed entrance. Operator and tourism references were reviewed on 14 October 2026. Opening hours, prices, reservations, dietary suitability and accessibility should be confirmed through the linked venue.

No clearly licensed venue photographs were acquired for these seven entries. They use a simple plate illustration and explicitly disclose the missing photography; generic stock food photographs are not presented as venue photos. Existing destination photography is preserved.

## Data and photography

`app/destinations.ts` combines the original 16 destinations, `app/data/expanded-destinations.json` (91 places) and the restaurant collection. The original two-photo galleries remain intact. Expanded destinations each have one reviewed photograph. Categories cover cities, castles/manors, nature, coast, culture and food.

Each place includes sourced coordinates, honest visitor pointers and reference links. Large parks and districts use labelled reference pins rather than invented entrances. The Cold War Museum uses the operator's visitor-centre coordinates. The original collection was reviewed on 13 October 2026 and the expansion on 14 October 2026. Hours, prices, closures, ferry schedules and step-free access are not live-verified.

Photo manifests in `app/data/destination-assets.json` and `app/data/expanded-assets.json` retain Wikimedia Commons authors, licenses, source URLs and dimensions. Local images in `public/destinations/` reach up to 2560 pixels without artificial upscaling. New imported photos require at least 1600 pixels on the long edge and 700 on the short edge. Attribution and CC BY, CC BY-SA or public-domain terms remain visible on destination pages.

Research scripts are separate from application runtime:

```sh
node scripts/import-destinations.mjs --metadata-only
node scripts/download-destination-photos.mjs
```

Complete both steps, review the output, add matching Lithuanian entries and run checks before publishing a regenerated collection. Metadata-only output is not a complete asset import. Downloads respect Wikimedia cooldowns; an identifying `ATLAS_USER_AGENT` can be supplied. Research caches stay in ignored `.atlas-research/`.

## Performance and accessibility

Inter and Newsreader are self-hosted with their SIL licenses in `public/fonts/`. Readable body type, generous line height and high-contrast controls accompany restrained editorial headings. Mobile layouts are independent of the desktop sidebar. The navigation drawer traps focus, closes with Escape and makes the background inert; reduced-motion preferences are respected.

Leaflet loads only for map exploration. Native gesture lifecycles remain intact, including document-level completion listeners. The map canvas owns touch gestures while the surrounding document scrolls normally. Markers do not mount a photograph for every destination. OpenStreetMap tiles require an internet connection, retain attribution and have a retry notice on failure.

Responsive Next images use quality 85; the full-photo viewer uses quality 90. Source dimensions version optimized image requests. The Tailwind Turbopack loader must match only `globals.css`; applying its `as: "*.css"` rule to CSS Modules breaks scoped class exports. HTTP checks guard against this regression.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
# With next dev or next start running:
npm run check:atlas -- http://localhost:3000
```

`check:reader` remains an alias for compatibility. Tests cover collection completeness, Lithuanian coverage, bilingual search, category/city filters, URL/language/route state, restaurant directions, route validation/reordering/export, the accessible planner, numbered map overlays, native gesture configuration, camera restoration, previews and detail navigation. The HTTP check verifies both atlas shells, all 228 localized destination routes, CSS/fonts, all 123 photographs, image optimization, missing routes and legacy redirects.

These are automated handler and HTTP checks. Browser tooling currently reports no browser available, so live desktop/mobile QA could not run. Physical mouse drag/wheel, touch pinch/pan and visual layouts remain unverified. Recommended manual flows: map pan/zoom/reset; Vilnius → attraction → return; Trakai search → pin → details; Where to eat → restaurant → directions; add/reorder/remove route stops → map overview → Google Maps; switch languages with an active route; repeat on mobile.

## Architecture

- `app/[lang]/layout.tsx`: validated locale, localized metadata and document language.
- `app/[lang]/places/[slug]/page.tsx`: shareable localized destination routes.
- `app/discovery-guide.tsx`: discovery, details, URL-backed routes, mobile navigation and galleries.
- `app/route-planner.ts`, `app/route-planner-panel.tsx`: validated itineraries, Maps URLs and the accessible planner dialog.
- `app/locale.ts`, `app/locale-context.tsx`, `app/i18n.ts`: locale routing and translations.
- `app/guide-navigation.ts`: validated filters and URL serialization.
- `app/destinations.ts`, `app/data/`: structured content, search, city groups and directions.
- `app/destination-map.tsx`, `app/map-clusters.ts`: native Leaflet lifecycle and screen-space grouping.
- `app/map-viewport.ts`: optional map-camera session storage with failure fallbacks.
- `app/travel-resources.ts`: localized visitor-service links.
- `app/guide.module.css`: responsive atlas presentation.
