# Lithuania — The Discovery Guide

A local-data travel discovery guide presented as an editorial book. Built with Next.js, React, TypeScript, Tailwind CSS, and Leaflet; no database, accounts, or API keys.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

- Search names, regions, and descriptions; Lithuanian diacritics are optional.
- Filter by five categories, popular places, or hidden gems. Collections are editorial selections, not measured popularity rankings.
- Open a destination to read its description, reasons to visit, practical pointers, coordinates, and sources. Use the photo controls to browse its two-image gallery.
- Use the left chapter menu, visible page arrows, keyboard Left/Right, or a horizontal swipe to explore. Vertical scrolling stays inside the current sheet where needed. Reduced-motion preferences are respected.
- Open the atlas to pan, zoom, filter markers, select previews, and open destination pages. Locate buttons centre the destination on the map.
- Destination URLs under `/places/[slug]` can be shared and reloaded. Browser back/forward is supported.
- The original storytelling book remains available at `/journal`.

On desktop, discovery and destination pages form two-page spreads. On mobile, each destination becomes a single reading sheet with photography; the atlas uses a compact preview above the map. Map gestures are kept separate from book swipes.

## Data & photography

The initial collection contains 15 real destinations and 30 location-specific photographs. `app/destinations.ts` holds editorial descriptions, categories, collection flags, practical pointers, reference URLs, and coordinate provenance. `app/data/destination-assets.json` holds researched Wikidata coordinates and Wikimedia Commons photo metadata, author names, source pages, license links, and original image URLs. Images are served from `public/destinations/`.

Sources were reviewed on 13 October 2026. Individual sources and photo credits are accessible on each destination page. No visitor statistics or popularity ordering are claimed. Hours, prices, temporary closures, ferry schedules, and step-free access are not live-verified; visitor pointers direct readers to the linked operator/tourism pages. Regional park and historic-district pins are labelled reference points rather than entrances. The Cold War Museum pin uses the operator's visitor-centre coordinates.

Wikimedia images retain their stated CC BY, CC BY-SA, or public-domain terms. Display crops are disclosed; source and license links remain visible in galleries and source notes. Base-map tiles are requested from OpenStreetMap and require internet access. Attribution is kept visible. If tiles fail, a retry message appears and the place list and markers remain usable.

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
# A different port:
npm run check:reader -- http://localhost:3100
```

Tests cover data completeness, photo dimensions/licenses, accent-insensitive combined search/filtering, destination and map navigation callbacks, browser back, animation locking, keyboard and touch handlers, and the retained journal. The runtime check verifies CSS Module mappings, all 30 local images, all 15 destination deep links, a missing-destination 404, image optimization, and the journal route. These checks do not replace browser testing of map tiles and visual transitions.

## Architecture

- `app/discovery-guide.tsx`: discovery reader, filtering, navigation, galleries, and transitions.
- `app/destination-map.tsx`: browser-only Leaflet map and marker popup lifecycle.
- `app/destinations.ts`: typed destination collection and search helpers.
- `app/places/[slug]/page.tsx`: destination routes and metadata.
- `app/guide.module.css`: discovery, atlas, and mobile reading layouts.
- `app/travel-journal.tsx`: preserved original book.

The Tailwind Turbopack loader intentionally matches only `globals.css`. Applying its `as: "*.css"` rule to CSS Modules converts them to plain CSS and breaks exported class names; `check:reader` guards against that regression.
