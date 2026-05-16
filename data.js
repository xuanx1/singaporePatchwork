// Patchwork Singapore — data layer (real Singapore open data).
//
// All ~55 URA Master Plan 2019 planning areas are loaded from real-data.js
// (populated by scripts/refresh-data.js). Each area carries its real:
//   • centroid (lat/lon), used to compute its grid (col, row) position
//   • Census 2020 population & CMIO breakdown (SingStat Table 17561)
//   • category — "resid" (≥10k residents), "sparse" (100–10k), "none" (no resident data)
//
// The 52-week rainfall series is real (data.gov.sg, daily for the year in
// window.__REAL.rainfall.year). Active NEA dengue clusters are mapped to the
// nearest planning area centroid.

(function () {
  const REAL = window.__REAL || {};
  const RAW_AREAS = REAL.planning_areas?.areas || [];

  // Filter out areas that didn't fit the grid, keep the rest sorted by grid position
  const AREAS = RAW_AREAS.filter(a => a.col >= 0 && a.row >= 0)
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  // Build TOWNS from real planning areas
  const TOWNS = AREAS.map(a => ({
    id: a.key,
    name: a.name,
    col: a.col,
    row: a.row,
    pop: a.total,
    category: a.cat,        // "resid" | "sparse" | "none"
    lat: a.lat,
    lon: a.lon,
    // Approximate region from lat band (used for tooltip text only)
    region: a.lat > 1.42 ? "N"
          : a.lat > 1.38 ? "NE"
          : (a.lat > 1.32 && a.lon > 103.92) ? "E"
          : (a.lat < 1.32 && a.lon > 103.79 && a.lon < 103.92) ? "C"
          : (a.lon < 1.32 && a.lon < 103.79) ? "W"
          : a.lon > 103.92 ? "E"
          : a.lon < 103.79 ? "W"
          : "C",
  }));

  // ---- Real ethnicity per town (CMIO % from Census 2020) ----
  // For residential areas: compute pct from raw counts; null for "none".
  const ETHNICITY = {};
  const ETHNICITY_POP = {};
  for (const a of AREAS) {
    const t = a.ch + a.ma + a.ind + a.ot;
    if (t > 0) {
      let p = [a.ch, a.ma, a.ind, a.ot].map(v => Math.round((v / t) * 1000) / 10);
      const s = p.reduce((x, y) => x + y, 0);
      p[0] = Math.round((p[0] + 100 - s) * 10) / 10;
      ETHNICITY[a.key] = p;
      ETHNICITY_POP[a.key] = t;
    } else {
      ETHNICITY[a.key] = null;  // no data
      ETHNICITY_POP[a.key] = 0;
    }
  }

  // ---- Rainfall (real, from window.__REAL.rainfall) ----
  // Only residential areas have a station-mapped rainfall series.
  // For non-residential, fall back to the national average series (computed below).
  const RAIN_WEEKLY_RAW = REAL.rainfall?.weekly_mm || {};
  const RAIN_ANNUAL_RAW = REAL.rainfall?.annual_mm || {};

  // National average weekly series (mean across all residential towns we have data for)
  const NAT_WEEKLY = new Array(52).fill(0);
  let nWithData = 0;
  for (const [tid, series] of Object.entries(RAIN_WEEKLY_RAW)) {
    nWithData++;
    for (let w = 0; w < 52; w++) NAT_WEEKLY[w] += series[w] || 0;
  }
  if (nWithData > 0) for (let w = 0; w < 52; w++) NAT_WEEKLY[w] = Math.round(NAT_WEEKLY[w] / nWithData);

  const RAIN_WEEKLY = {};
  const RAIN_ANNUAL = {};
  for (const t of TOWNS) {
    RAIN_WEEKLY[t.id] = RAIN_WEEKLY_RAW[t.id] || NAT_WEEKLY;
    RAIN_ANNUAL[t.id] = RAIN_ANNUAL_RAW[t.id] || NAT_WEEKLY.reduce((a, b) => a + b, 0);
  }

  // ---- Dengue clusters (real, snapshot) ----
  const DENGUE_ACTIVE = REAL.dengue_active?.by_town || {};
  const DENGUE_CLUSTERS = REAL.dengue_active?.clusters || [];
  const DENGUE_AVG = {};
  const DENGUE_SEVERITY = {};
  for (const t of TOWNS) {
    const d = DENGUE_ACTIVE[t.id];
    DENGUE_AVG[t.id] = d?.total_cases || 0;
    DENGUE_SEVERITY[t.id] = d ? (d.max_cluster >= 10 ? 2 : 1) : 0;
  }

  // ---- Satisfaction (proxy: HDB Median Resale Price per town — desirability indicator) ----
  const RESALE = REAL.resale?.by_town_median_price || {};
  const SATISFACTION = {};
  const SATISFACTION_PRICE = {};
  for (const t of TOWNS) {
    SATISFACTION_PRICE[t.id] = RESALE[t.id] || null;
  }
  // Intensity 0–1 from price range 500k–1.2M (real residential band)
  function satisfactionIntensity(price) {
    if (!price) return null;
    const lo = 500000, hi = 1200000;
    return Math.max(0, Math.min(1, (price - lo) / (hi - lo)));
  }
  for (const t of TOWNS) {
    SATISFACTION[t.id] = satisfactionIntensity(SATISFACTION_PRICE[t.id]);
  }

  // ---- Density (REAL: people per km², derived from Census 2020 + planning-area polygon) ----
  const DENSITY = REAL.density?.by_town_per_km2 || {};
  const AREA_KM2 = REAL.density?.by_town_area_km2 || {};
  // Per-area density scaled into a 0–1 "intensity" for the visualization.
  // Singapore residential densities run ~2,800 (Tanglin) – ~31,400 (Choa Chu Kang).
  function densityIntensity(v) {
    if (!v || v <= 0) return null;
    const lo = 3000, hi = 30000;
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  }

  // ---- Region label helper ----
  const REGION_NAME = { N: "North", NE: "North-East", E: "East", C: "Central", W: "West" };
  const WEEK_MONTH = (w) => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[Math.min(11, Math.floor((w - 1) / 4.34))];
  };

  // ---- Dengue weekly (REAL: bundled from data.gov.sg MOH/NEA dataset) ----
  // Expose as the same global the runtime fetch used so tile.jsx + app.jsx pick it up.
  if (REAL.dengue_weekly && !window.__DENGUE_WEEKLY) {
    window.__DENGUE_WEEKLY = REAL.dengue_weekly;
  }

  // Grid dimensions come from the bundled outline (so the silhouette and grid match)
  const GRID_COLS = REAL.outline?.cols || 12;
  const GRID_ROWS = REAL.outline?.rows || 7;
  const GRID_CELL = REAL.outline?.cell || 78;
  const GRID_PAD = REAL.outline?.pad || 45;

  window.__QUILT = {
    TOWNS,
    SATISFACTION, SATISFACTION_PRICE, satisfactionIntensity,
    DENSITY, AREA_KM2, densityIntensity,
    DENGUE_AVG, DENGUE_SEVERITY, DENGUE_ACTIVE, DENGUE_CLUSTERS,
    ETHNICITY, ETHNICITY_POP,
    RAIN_WEEKLY, RAIN_ANNUAL,
    REGION_NAME, WEEK_MONTH,
    GRID_COLS, GRID_ROWS, GRID_CELL, GRID_PAD,
    PROVENANCE: {
      planning_areas: "real (URA Master Plan 2019; SingStat Table 17561 for population)",
      rainfall_weekly_per_town: `real (data.gov.sg, ${REAL.rainfall?.year || ""} daily aggregated)`,
      ethnicity_per_town: "real (DOS Census 2020)",
      dengue_clusters: "real (NEA active clusters, data.gov.sg)",
      density: "real-derived (Census 2020 population ÷ planning-area polygon area)",
      satisfaction: "real-derived proxy (HDB 4-room median resale price, 2024-2025, data.gov.sg)",
    },
  };

  // Live-data refresh hook (see Patchwork Singapore.html runtime fetch)
  window.addEventListener("realdata-refreshed", () => {
    const R = window.__REAL;
    if (!R) return;
    const Q = window.__QUILT;
    Q.DENGUE_ACTIVE = R.dengue_active?.by_town || {};
    Q.DENGUE_CLUSTERS = R.dengue_active?.clusters || [];
    for (const t of TOWNS) {
      const d = Q.DENGUE_ACTIVE[t.id];
      Q.DENGUE_AVG[t.id] = d?.total_cases || 0;
      Q.DENGUE_SEVERITY[t.id] = d ? (d.max_cluster >= 10 ? 2 : 1) : 0;
    }
  });
})();
