# Patchwork Singapore

*An editorial quilt of the island — four readings, one cloth.*

---

Each of Singapore's planning area is rendered as a
hand-stitched patch. Residential patches carry colour, pattern, and embroidered
detail; sparse or zero-population areas (industrial zones, water catchments,
port, military) show as smaller dimmed patches or grey outlines. A toggle on the
left rail brings the real Singapore coastline in behind the patches.

Patch positions are computed from each town's real lat/lon (URA centroid) and
snapped to a 12×7 grid via a Hungarian-style minimum-cost assignment — so
Sembawang sits at the northern tip, Marine Parade at the south coast, Jurong
West far west, and Tampines / Pasir Ris along the east arm.

---

## Four readings

| Layer | What the patch shows |
|---|---|
| **Satisfaction** | Median HDB 4-room resale price per town (2024–2025). Darker patch = higher price = more desirable. Central Area & Queenstown read deepest; Jurong & Choa Chu Kang lightest. |
| **Weather** | Per-town **weekly** rainfall in mm. The base colour redraws as you scrub the week dial — light cream in dry weeks, deep indigo in monsoon weeks. Diagonal rain threads or a sun mark overlay the intensity band. |
| **Dengue** | National weekly dengue cases distributed across residential towns by their Census 2020 population share. Towns with current NEA active clusters get a 1.5× hotspot boost and a dashed alert seam. Red knots scale with each town's weekly caseload. |
| **Diversity** | Four vertical pieced strips — the town's Chinese / Malay / Indian / Others composition. Strip widths reflect each share exactly. |

The week dial drives Weather and Dengue. It's disabled on Satisfaction and
Diversity (single point in time, no weekly variation possible).

---

## Data sources

Every layer is grounded in published Singapore open data. Sources:

| Layer | Source |
|---|---|
| Satisfaction | HDB / data.gov.sg dataset — Median Resale Prices by Town and Flat Type. 4-room flat median across 2024–2025 quarters. |
| Weather | data.gov.sg `/v1/environment/rainfall` — 366 daily fetches for 2024, inverse-distance-weighted across the 5 nearest rainfall stations per town. |
| Dengue (snapshot) | data.gov.sg NEA Active Dengue Clusters GEOJSON, dataset. Each cluster polygon mapped to its nearest town centroid. |
| Dengue (weekly) | data.gov.sg MOH/NEA dataset — Weekly Number of Dengue and DHF Cases. Latest full year (2018). |
| Diversity | DOS Census of Population 2020 / SingStat Table 17561 — Resident Population by Planning Area / Subzone, Ethnic Group and Sex. Bundled as a local CSV. |
| Planning-area land sizes | Computed (shoelace) from URA Master Plan 2019 polygons. |
| Coastline + island outlines | URA Master Plan 2019 country outline, Douglas-Peucker-simplified, 20 islands including Pulau Tekong, Pulau Ubin, Sentosa, Jurong Island, Pulau Semakau. |