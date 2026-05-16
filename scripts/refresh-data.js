// Re-fetch all real Singapore data and rebuild real-data.js.
//
// Usage (Node.js v18+ — has built-in fetch):
//   node scripts/refresh-data.js
//
// Or run pieces in any JS environment that has fetch (browser console, sandboxes, etc).
// Run from project root.

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "data");
const BUNDLE = path.join(__dirname, "..", "real-data.js");
fs.mkdirSync(OUT, { recursive: true });

// 27 HDB towns + estates with approximate centroids (decimal degrees)
const TOWN_COORDS = {
  wdl: [1.437, 103.786], smb: [1.449, 103.820], ysn: [1.430, 103.836],
  pgl: [1.398, 103.908], skg: [1.391, 103.895], hgn: [1.371, 103.892],
  amk: [1.369, 103.846], sgn: [1.353, 103.873], bsn: [1.351, 103.848],
  tpy: [1.334, 103.847], klw: [1.310, 103.864], gyl: [1.318, 103.887],
  psr: [1.372, 103.949], tpn: [1.354, 103.945], bdk: [1.324, 103.928],
  mpr: [1.302, 103.905], cta: [1.288, 103.851], bkm: [1.281, 103.823],
  qtn: [1.295, 103.806], clm: [1.315, 103.764], bkt: [1.326, 103.802],
  bkp: [1.378, 103.762], cck: [1.385, 103.745], bbt: [1.349, 103.749],
  jre: [1.333, 103.742], jrw: [1.339, 103.708], tng: [1.378, 103.732],
};

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

async function pmap(arr, n, fn) {
  const out = new Array(arr.length);
  let i = 0;
  async function w() { while (i < arr.length) { const j = i++; out[j] = await fn(arr[j]); } }
  await Promise.all(Array.from({ length: n }, w));
  return out;
}

// ============ 1. RAINFALL ============
// Fetch one full year of daily rainfall, station-by-station, aggregate to weekly per town.
async function fetchRainfall(year = 2024) {
  console.log(`\n[1/3] Fetching ${year} daily rainfall…`);
  const days = [];
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(year, m, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      days.push(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }

  const results = await pmap(days, 15, async (d) => {
    try {
      const j = await getJson(`https://api.data.gov.sg/v1/environment/rainfall?date=${d}`);
      const totals = {};
      for (const item of j.items) {
        for (const r of item.readings) totals[r.station_id] = (totals[r.station_id] || 0) + r.value;
      }
      return { date: d, totals, stations: j.metadata?.stations };
    } catch { return null; }
  });
  console.log(`   Got ${results.filter(Boolean).length}/${days.length} days`);

  const stations = results.find((r) => r?.stations)?.stations || [];

  function dist2(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
  function townDailyMm(town, dayTotals) {
    const tloc = TOWN_COORDS[town];
    const ranked = stations
      .map((s) => ({ id: s.id, d: Math.sqrt(dist2([s.location.latitude, s.location.longitude], tloc)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    let w = 0, v = 0;
    for (const r of ranked) {
      if (dayTotals[r.id] == null) continue;
      const ww = 1 / (r.d + 0.001);
      v += ww * dayTotals[r.id];
      w += ww;
    }
    return w > 0 ? v / w : null;
  }

  const TOWN_IDS = Object.keys(TOWN_COORDS);
  const weeklyByTown = {}, annualByTown = {};
  for (const t of TOWN_IDS) {
    const daily = results.map((r) => (r?.totals ? townDailyMm(t, r.totals) : null));
    const weeks = [];
    for (let w = 0; w < 52; w++) {
      let sum = 0, cnt = 0;
      for (let i = w * 7; i < Math.min(w * 7 + 7, daily.length); i++) {
        if (daily[i] != null) { sum += daily[i]; cnt++; }
      }
      weeks.push(cnt > 0 ? Math.round((sum * 7) / cnt) : 0);
    }
    weeklyByTown[t] = weeks;
    annualByTown[t] = Math.round(daily.reduce((a, b) => a + (b || 0), 0));
  }
  return {
    source: `data.gov.sg /v1/environment/rainfall (${days.length} daily fetches, ${year})`,
    method: "inverse-distance-weighted average of nearest 5 rainfall stations",
    weekly_mm: weeklyByTown,
    annual_mm: annualByTown,
  };
}

// ============ 2. ETHNICITY ============
// Reads from LOCAL CSV (data/ethnicity-2020-source.csv) — no API call.
// To refresh the underlying CSV: download from
//   https://data.gov.sg/datasets/d_e7ae90176a68945837ad67892b898466/view
// and replace data/ethnicity-2020-source.csv.
function loadEthnicity() {
  console.log("\n[2/3] Loading CMIO per planning area from local CSV (DOS Census 2020)…");
  const csv = fs.readFileSync(path.join(OUT, "ethnicity-2020-source.csv"), "utf8");
  const lines = csv.split("\n");
  const byPA = {};
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  for (const ln of lines.slice(1)) {
    if (!ln || !ln.includes(",")) continue;
    const v = ln.split(",");
    const name = v[0];
    if (!name) continue;
    if (name === "Total" || name.endsWith(" - Total")) {
      const key = norm(name.replace(" - Total", ""));
      byPA[key] = {
        ch: parseInt(v[4]) || 0,
        ma: parseInt(v[7]) || 0,
        ind: parseInt(v[10]) || 0,
        ot: parseInt(v[13]) || 0,
      };
    }
  }

  const PA_MAP = {
    wdl: "woodlands", smb: "sembawang", ysn: "yishun", pgl: "punggol",
    cck: "choachukang", bkp: "bukitpanjang", skg: "sengkang",
    amk: "angmokio", hgn: "hougang", sgn: "serangoon", psr: "pasirris",
    tpn: "tampines", bbt: "bukitbatok", bkt: "bukittimah", bsn: "bishan",
    jre: "jurongeast", jrw: "jurongwest", clm: "clementi",
    qtn: "queenstown", tpy: "toapayoh", bkm: "bukitmerah",
    bdk: "bedok", mpr: "marineparade", klw: "kallang", gyl: "geylang",
    cta: "COMPOSITE:outram+rochor+downtowncore",
    tng: "FALLBACK:national",
  };
  const ntl = byPA["total"];
  function toPct(e) {
    const t = e.ch + e.ma + e.ind + e.ot;
    if (t === 0) return null;
    let p = [e.ch, e.ma, e.ind, e.ot].map((v) => Math.round((v / t) * 1000) / 10);
    const s = p.reduce((a, b) => a + b, 0);
    p[0] = Math.round((p[0] + 100 - s) * 10) / 10;
    return { population: t, pct: p };
  }
  const out = {};
  for (const [tid, key] of Object.entries(PA_MAP)) {
    if (key.startsWith("FALLBACK:")) {
      out[tid] = { population: 19000, pct: toPct(ntl).pct,
        note: "national average (planning area didn't exist in 2020 Census)" };
    } else if (key.startsWith("COMPOSITE:")) {
      const parts = key.slice(10).split("+");
      let acc = { ch: 0, ma: 0, ind: 0, ot: 0 };
      for (const p of parts) { const v = byPA[p]; if (v) { acc.ch += v.ch; acc.ma += v.ma; acc.ind += v.ind; acc.ot += v.ot; } }
      out[tid] = toPct(acc);
    } else {
      out[tid] = byPA[key] ? toPct(byPA[key]) : null;
    }
  }
  return {
    source: "DOS Census of Population 2020 (Table 17561) — processed from local CSV",
    by_town: out,
  };
}

// ============ 3. DENGUE ============
async function fetchDengue() {
  console.log("\n[3/3] Fetching active dengue clusters (NEA via data.gov.sg)…");
  const meta = await getJson("https://api-open.data.gov.sg/v1/public/api/datasets/d_dbfabf16158d1b0e1c420627c0819168/poll-download");
  const r = await fetch(meta.data.url);
  if (!r.ok) throw new Error(`Dengue download failed: ${r.status}`);
  const gj = await r.json();

  function centroid(coords) {
    const flat = [];
    (function flatten(a) { if (Array.isArray(a[0]) && typeof a[0][0] === "number") flat.push(...a); else for (const s of a) flatten(s); })(coords);
    let sx = 0, sy = 0;
    for (const [x, y] of flat) { sx += x; sy += y; }
    return [sx / flat.length, sy / flat.length];
  }
  function nearestTown(lon, lat) {
    let best = null, bd = Infinity;
    for (const [t, [tlat, tlon]] of Object.entries(TOWN_COORDS)) {
      const dx = tlon - lon, dy = tlat - lat;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = t; }
    }
    return { town: best, dist: Math.sqrt(bd) };
  }

  const clusters = gj.features.map((f) => {
    const [lon, lat] = centroid(f.geometry.coordinates);
    return {
      locality: f.properties.LOCALITY,
      cases: f.properties.CASE_SIZE,
      lon, lat,
      ...nearestTown(lon, lat),
    };
  });
  const byTown = {};
  for (const c of clusters) {
    const t = (byTown[c.town] = byTown[c.town] || { clusters: 0, total_cases: 0, max_cluster: 0, localities: [] });
    t.clusters++;
    t.total_cases += c.cases;
    t.max_cluster = Math.max(t.max_cluster, c.cases);
    t.localities.push(c.locality);
  }
  console.log(`   ${clusters.length} active clusters across ${Object.keys(byTown).length} towns`);
  return {
    source: "data.gov.sg dataset d_dbfabf16158d1b0e1c420627c0819168 (NEA Active Dengue Clusters GEOJSON)",
    fetched_at: new Date().toISOString(),
    by_town: byTown,
    clusters,
  };
}

// ============ MAIN ============
(async () => {
  const year = parseInt(process.argv[2] || "2024", 10);
  const rainfall = await fetchRainfall(year);
  const ethnicity = loadEthnicity();
  const dengue_active = await fetchDengue();

  fs.writeFileSync(path.join(OUT, "rainfall-${year}-by-town.json".replace("${year}", year)), JSON.stringify(rainfall, null, 2));
  fs.writeFileSync(path.join(OUT, "ethnicity-by-town-2020.json"), JSON.stringify(ethnicity, null, 2));
  fs.writeFileSync(path.join(OUT, "dengue-active-by-town.json"), JSON.stringify(dengue_active, null, 2));

  const bundle = { generated_at: new Date().toISOString(), rainfall, ethnicity, dengue_active };
  fs.writeFileSync(
    BUNDLE,
    `// Auto-generated real-data bundle for Patchwork Singapore.\nwindow.__REAL = ${JSON.stringify(bundle, null, 2)};\n`
  );
  console.log("\n✓ Wrote real-data.js");
})();
