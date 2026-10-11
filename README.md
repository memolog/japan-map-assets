# Japan map assets

A reproducible Node.js / TypeScript CLI producing standalone prefecture SVGs and TopoJSON for D3, React and Remotion video projects. Rendering video is outside this repository's scope.

## Setup and source

Use Node.js 24 or later and an installed `unzip` command (macOS/Linux). Run `npm ci`. The source is [MLIT National Land Numerical Information, N03](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html). The latest release verified on October 11, 2026 is January 1, 2026; the national ZIP is approximately 766 MB. Source files are ignored by Git.

```sh
npm run download
npm run generate:maps
npm run test
npm run typecheck
npm run preview
```

Open http://127.0.0.1:4173. The preview runs locally with no CDN or external service. It provides layout/aspect controls, per-prefecture fill, boundary width, names/codes and all 47 silhouettes.

If automatic downloading fails, open the official page, select the 2026 nationwide download, save `N03-20260101_GML.zip` to `data/source/`, and run generation. Alternatively extract the municipal `N03-20260101.shp` alongside its DBF, SHX, PRJ and CPG, or supply official N03 GeoJSON. ZIP import deliberately selects the municipal file rather than the additional prefecture-boundary dataset.

```sh
npm run generate:maps -- --input data/source/N03-20260101.shp --source-date 2026-01-01 --acquired-date 2026-10-11
npm run generate:maps -- --input data/source/N03-20260101.geojson --retain 0.5% --icon-retain 0.2% --icon-islands largest --out dist
```

Inputs must contain N03_001 (prefecture name), and any supplied N03_007 municipality code must match that name's prefecture code. Coordinates must be geographic JGD2011 longitude/latitude. Projected or alternative datasets must be converted before import. The CLI rejects missing/duplicate prefectures and code/name inconsistencies. Expect several GB of free RAM for the full nationwide source.

## Pipeline and output

1. **Source** (`src/download.ts`): stream the official archive and record acquisition date/hash; local import works without networking.
2. **Geometry** (`src/geometry/`): build exact shared topology, dissolve municipalities by prefecture, then use Mapshaper weighted Visvalingam simplification on shared arcs, with `keep-shapes`. No quantization is applied; coordinates remain geographic. N03 polygons and MultiPolygons are supported. Simplification does not independently move adjacent boundaries.
3. **Rendering** (`src/rendering/`): D3 conic conformal projection, standard parallels 30°/40°N, central meridian 137°E. This preserves local angles and uses a uniform screen scale; no independent x/y stretching. Geographic coordinates are never modified for display.

`dist/` contains:

| File | Purpose |
| --- | --- |
| japan.topojson | 47 geographic prefectures in `objects.prefectures`, shared arcs, `id`, `properties.code`, `properties.name` |
| japan-video.svg | Alias of the landscape video map |
| japan-video-16x9.svg | 1600 × 900 landscape map |
| japan-video-9x16.svg | 900 × 1600 portrait map |
| japan-geographic.svg | 1200 × 1200 map retaining all geographic positions |
| prefectures/01.svg … 47.svg | Tight transparent silhouettes, `currentColor` fill |
| japan-video-16x9.layout.json / japan-video-9x16.layout.json | Exact D3 layout parameters and polygon membership |
| japan-layout.js | ESM helper reproducing SVG paths from geographic features |
| manifest.json | Source provenance, settings, input/output hashes and byte sizes |

Video has only two groups: the main map and Okinawa prefecture (`47`). Okinawa uses an angled-corner inset frame whose right edge aligns exactly with the main projection's easternmost Hokkaido coordinate, including all Hokkaido components supplied by N03. Landscape places the frame in the lower-right sea area; portrait places it below the main map.

Ogasawara is omitted from Video (Tokyo `13` polygon components entirely south of 28°N). Other islands normally retain geographic positions. Secondary polygon components whose projected bounding boxes intersect the Okinawa frame's bounding box, including a 2px clearance, are omitted completely from Video. The largest polygon of each prefecture is always retained. The conservative bounding-box rule also suppresses islands near the angled corner, ensuring a clear frame without cutting island geometry. Projection fitting happens before overlap omissions and is not repeated, keeping the Hokkaido alignment stable. All omitted components and reasons are recorded in the layout JSON. Geographic SVG and TopoJSON retain these islands.

Every polygon component is either assigned to exactly one region or explicitly listed as omitted. The inset uses uniform scaling and keeps internal geographic positions; its scale differs from the main map and should not be used for area comparisons. The inset contains an “沖縄地方” label at the upper left, clear of the angled corner; space above the island geometry is reserved for the label. No overall title or legend is embedded. Use `--inset-label-color` to customize its color.

### Reproducing the SVG layout with TopoJSON and D3

Copy these files together to the consuming project:

- `japan.topojson`
- `japan-video-16x9.layout.json` or `japan-video-9x16.layout.json`
- `japan-layout.js` (standalone ESM helper; requires `d3-geo` 3.x)

Layout schema version 2 records omitted polygon indices/reasons, inset frame bounds and `textLabel` position/font settings, exact fitted projection parameters for every group, polygon indices by prefecture code, frame paths, canvas size, path precision and the matching TopoJSON SHA-256. Polygon indices refer to the decoded source geometry, before winding normalization. Pair a layout with its exact TopoJSON; regenerating/simplifying/reordering the topology can invalidate the indices. Geographic coordinates remain unchanged.

```js
import {feature} from 'topojson-client';
import {layoutPaths} from './japan-layout.js';
const [topology, layout] = await Promise.all([
  fetch('/maps/japan.topojson').then(r => r.json()),
  fetch('/maps/japan-video-16x9.layout.json').then(r => r.json()),
]);
const features = feature(topology, topology.objects[layout.source.object]).features;
const paths = layoutPaths(features, layout);
// paths['13'] uses the same Video omissions as the generated SVG.
```

```jsx
<svg viewBox={`0 0 ${layout.width} ${layout.height}`}>
  {features.map(f => <path key={f.properties.code}
    id={`pref-${f.properties.code}`} data-code={f.properties.code}
    data-name={f.properties.name} d={paths[f.properties.code]}
    fill={colors[f.properties.code] ?? '#a8cbbd'} stroke="#263a36"
    strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
  {layout.regions.filter(r => r.frame).map(r =>
    <path key={r.id} d={r.frame.path} fill="none" stroke="#879b94"
      vectorEffect="non-scaling-stroke" />)}
  {layout.regions.filter(r => r.textLabel).map(r =>
    <text key={`${r.id}-label`} x={r.textLabel.x} y={r.textLabel.y}
      fontSize={r.textLabel.fontSize} fontFamily={r.textLabel.fontFamily}
      fill="#263a36">{r.textLabel.text}</text>)}
</svg>
```

Compute `layoutPaths` once (for example with React `useMemo`), then animate colors per prefecture in Remotion. The helper performs the same winding normalization and `geoPath(...).digits(2)` rendering as SVG generation, so the resulting path strings match exactly. It also exports `selectRegion` and `restoreProjection` for custom D3 rendering. Do not call `fitSize` or `fitExtent` again when reproducing a saved layout; resize via `viewBox`. Render each region's `textLabel` to reproduce the inset label; its coordinates and font size use the SVG viewBox units. The default sans-serif font depends on the host system; provide the same Japanese font in both applications for consistent typography.

`--retain` and `--icon-retain` specify percentages of simplifiable vertices, not error tolerances. Defaults are 0.5% and 0.2%. `keep-shapes` preserves polygon components, so many tiny islands still contribute to size. Icon defaults (`--icon-islands largest`) retain only the largest polygon per prefecture; this is useful for small bar chart race icons but excludes islands and changes the represented coverage. `--icon-islands all` retains all islands at their geographic positions, which can make Tokyo's mainland extremely small. Neither rule modifies the TopoJSON master. Icon simplification uses the same source/dissolve procedure at a separate resolution.

Codes are zero-padded JIS prefecture codes 01–47. The canonical name mapping is in `src/prefectures.ts` and can also be read from TopoJSON or SVG `data-name` attributes.

## Using the assets

```js
import {feature} from 'topojson-client';
const topology = await fetch('/maps/japan.topojson').then(r => r.json());
const prefectures = feature(topology, topology.objects.prefectures);
// Pass geographic features to d3.geoPath(yourProjection).
const tokyo = prefectures.features.find(f => f.properties.code === '13');
```

For React / Remotion, copy `dist/` to your consuming repository's public assets directory. A silhouette can be displayed as an image; to control `currentColor` from a parent, inline the SVG (CSS does not cross an img boundary).

```jsx
<img src="/maps/prefectures/13.svg" alt="Tokyo" style={{width: 32, height: 32, objectFit: 'contain'}} />
// For animation, load a trusted generated SVG once and inline it.
<div className="map" dangerouslySetInnerHTML={{__html: svgText}} />
```

```css
.map svg { width: 100%; height: auto; --map-fill: #b9d9ce; --map-stroke: #fff; --map-stroke-width: 1; }
.map #pref-13 { fill: #ef785b; }
```

Each prefecture is one path even when its islands occupy multiple insets. IDs `pref-01` through `pref-47`, `data-code`, and `data-name` support independent coloring. Inline multiple copies in separate DOM scopes or rename IDs to avoid document-wide collisions. The SVGs have transparent backgrounds and responsive viewBoxes. They contain no external scripts/fonts.

## Verification and licensing

`npm test` exercises synthetic municipal fixtures (explicitly not real geographic data), dissolve/shared boundaries, all codes/names, XML/viewBoxes/IDs, independent fills, rejection of invalid inputs and deterministic generation. When `dist/` exists it also verifies actual generated assets and hashes. The same source, settings and locked dependencies produce identical assets; acquisition times belong to source metadata and are not regenerated implicitly.

Software is MIT licensed. Generated geographic data follows the source conditions; see [DATA_LICENSE.md](DATA_LICENSE.md). Include MLIT attribution and identify processing/repositioning when using or redistributing these assets. This repository does not invent geography or license information when source acquisition fails.

---

## Disclaimer

This project is provided "as is", without warranty of any kind.

The map data is derived from publicly available geographic datasets and may contain inaccuracies, omissions, or simplifications introduced during processing.

No guarantee is made regarding the accuracy, completeness, reliability, or suitability of the generated data for any particular purpose.

Users are responsible for verifying the data before using it, especially in applications requiring geographic precision or authoritative information.

This project is not affiliated with or endorsed by the Ministry of Land, Infrastructure, Transport and Tourism (MLIT) or any other government agency.
