# Lithuania — The Discovery Guide

A photography-led travel guide with readable editorial pages, a practical destination index, and a Leaflet map. Built with Next.js, React, TypeScript, and Tailwind CSS. No backend, accounts, or API keys.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

## Find a place

- Choose a city or town in the sidebar. Vilnius, Kaunas, Klaipėda, Šiauliai, Trakai, Druskininkai, Nida, Palanga and additional towns are connected to explicit destination groups. Counts come from the actual data; town groups include nearby sights.
- Search by name, town or keyword. Lithuanian diacritics are optional. Combine search with location/category filters; clear filters with one action.
- Switch between List and Map without losing your selection. Search/filter state lives in the URL and survives destination navigation and browser back/forward.
- Browse all matching places in the normal document flow. Search, filters, location selection, and map exploration are immediate and never page-locked.
- Open a destination to see photographs, a concise description, reasons to visit, practical pointers, source links, and a prominent directions action. Directions open Google Maps using the researched reference coordinates; area pins are explicitly labelled as approximate reference points.
- Move between destination stories using previous/next controls, keyboard arrows, or horizontal swipes. Only these story transitions use the page-turn animation. Reduced-motion preferences are respected.
- On mobile, photographs lead the detail page. A persistent bottom bar provides Places, Map, and Cities & Towns; navigation opens in a focus-trapped drawer. Content uses normal page scrolling instead of nested reading panels.
- The original narrative book is retained at `/journal`.

## Typography & performance

Inter is self-hosted with `next/font/local`, including its SIL Open Font License in `public/fonts/Inter-LICENSE.txt`. Navigation and body copy use Inter; selected editorial headings retain a restrained, upright serif. Font loading does not depend on Google or another external font service.

Leaflet JavaScript loads only when the map opens. Thumbnails request small image variants, map popups use Next image props, and detail photographs remain responsive. OpenStreetMap base tiles require internet access, retain attribution, and show a retry notice on failure.

## Collection & sources

The collection contains **16 real destinations and 32 location-specific photographs**, including a researched Druskininkai entry. `app/destinations.ts` stores typed city groups, categories, descriptions, reasons to visit, visitor pointers, source links and coordinate provenance. `app/data/destination-assets.json` stores Wikidata coordinates and Wikimedia Commons photo author/source/license records. Photographs are local in `public/destinations/`.

Sources were reviewed on 13 October 2026. Collections are editorial choices rather than measured rankings. Hours, prices, closures, ferry schedules and step-free access are not live-verified; linked sources provide the operator's current information. Regional parks and historic districts use labelled reference pins rather than assumed entrances. The Cold War Museum uses the operator's visitor-centre coordinates.

Photos retain their stated CC BY, CC BY-SA or public-domain terms. Galleries include attribution and license links, with display crops disclosed in source notes.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
```

With the development server running:

```sh
npm run check:reader
# Another port:
npm run check:reader -- http://localhost:3100
```

Tests cover data/photo completeness, every city filter, combined search, URL state, map/list context, destination links, directions, keyboard/swipe handlers, animation locking, and the retained journal. The runtime check verifies scoped CSS, all photographs and destination routes, font serving, missing-place handling and image optimization. No browser is required for these checks; they do not replace visual testing of layouts and live map gestures.

## Architecture

- `app/discovery-guide.tsx`: guide navigation, discovery, destination spreads, mobile navigation, and galleries.
- `app/guide-navigation.ts`: URL serialization and validated filter state.
- `app/destinations.ts`: destination data, city groups, search and directions helpers.
- `app/destination-map.tsx`: client-only Leaflet lifecycle, markers and popups.
- `app/places/[slug]/page.tsx`: shareable destination routes and metadata.
- `app/guide.module.css`: readable guide styling and independent mobile layouts.
- `app/travel-journal.tsx`: preserved original journal.

The Tailwind Turbopack loader must match only `globals.css`. Applying its `as: "*.css"` rule to CSS Modules changes their type and breaks class exports. The runtime check guards against this regression.
