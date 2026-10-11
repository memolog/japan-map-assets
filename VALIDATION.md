# Validation report

Verified on October 11, 2026 using Node.js 24.21.0 and the official nationwide N03 January 1, 2026 municipal Shapefile from `N03-20260101_GML.zip`. The exact input SHA-256 values are in `dist/manifest.json`; dependency versions are locked in `package-lock.json`.

Settings: map retention 0.5%, icon retention 0.2%, largest polygon icons. Source date 2026-01-01, acquisition date 2026-10-11.

| Asset | Bytes |
| --- | ---: |
| japan.topojson | 1,481,720 |
| japan-video.svg | 602,955 |
| japan-video-16x9.svg | 602,955 |
| japan-video-9x16.svg | 603,011 |
| japan-geographic.svg | 604,429 |
| japan-video-16x9.layout.json | 14,939 |
| japan-video-9x16.layout.json | 14,704 |
| japan-layout.js | 5,918 |
| 47 silhouette SVGs combined | 326,727 |

- `npm test`: all 7 tests passed, including real generated assets; no skips. Checks cover all codes/names, municipal dissolution, shared arcs, TopoJSON decoding, SVG XML, finite positive viewBoxes, unique IDs and output hashes.
- `npm run typecheck`: passed.
- The initial geographic pipeline was verified with two complete nationwide generations. After the layout update, the geographic TopoJSON remained byte-identical. Regenerating both video layouts and SVGs from the master topology matches the saved files exactly.
- Exported D3 JavaScript plus each JSON layout reproduces every generated SVG prefecture path exactly. Every polygon component is assigned once or recorded as omitted. Okinawa is the only inset; its right edge matches projected Hokkaido. Ogasawara is omitted from Video. Two secondary island components intersect the landscape inset bounding box and are omitted; portrait has no overlap omissions. Geographic data is preserved.
- Headless Chrome on the local HTML preview: 47 paths, 47 icons, changing only Tokyo's fill, layout/aspect switching and color persistence passed; no JavaScript errors.
- Screenshots inspected for landscape, portrait and geographic maps. Hokkaido, Tokyo's mainland and mainland, Okinawa and the silhouette grid rendered correctly. Inset frames are separated from the main map after layout adjustment.
- npm's install-time dependency audit after upgrading Mapshaper: 0 known vulnerabilities.

Remaining tradeoffs: largest-polygon icons omit islands by default; choose `--icon-islands all` to retain them. Video insets use different uniform scales from the mainland, and are unsuitable for area comparisons. Geographic output retains geographic positions. National-source generation uses substantial memory and requires `unzip`; consuming the generated assets requires neither Mapshaper nor the source archive. Official provisional boundaries remain provisional. No video-rendering components are included.

The Okinawa inset now includes an upper-left “沖縄地方” label. Both aspect ratios were inspected in Chrome. The layout JSON records text position/font size, and automated verification checks the SVG text against those settings and confirms the islands lie below the label.
