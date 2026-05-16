// Patchwork Singapore — main App
const { useState, useMemo, useEffect, useRef } = React;

// Dynamic constants pulled from the real-data bundle
const RAIN_YEAR = window.__REAL?.rainfall?.year || 2024;
const RAIN_NAT_AVG = window.__REAL?.rainfall?.national_avg_mm || 2700;
const RAIN_DAY_COUNT = (() => {
  let n = 0;
  for (let m = 1; m <= 12; m++) n += new Date(RAIN_YEAR, m, 0).getDate();
  return n;
})();

const LAYERS = [
  {
    id: "satisfaction",
    name: "Satisfaction",
    meta: "Base quilt",
    swatch: "linear-gradient(135deg,#f1e8d6 0%,#e0a04b 50%,#c75b3e 100%)",
    legend: "Median HDB 4-room resale price per town (2024–2025) — used as a desirability proxy. Source: data.gov.sg.",
    legendScale: ["#f1e8d6", "#d4a574", "#e0a04b", "#a04a30", "#c75b3e"],
    legendLabels: ["~$500k", "~$1.2M"],
  },
  {
    id: "weather",
    name: "Weather",
    meta: "Rain thread",
    swatch: "linear-gradient(135deg,#d4a574 0%,#7a8c5c 50%,#2c4a5e 100%)",
    legend: `Per-town weekly rainfall (mm), aggregated from ${RAIN_DAY_COUNT} daily data.gov.sg fetches across ${RAIN_YEAR}.`,
    legendScale: ["#f1e8d6", "#d4a574", "#7a8c5c", "#3d5a6c", "#2c4a5e"],
    legendLabels: ["dry", "wet"],
  },
  {
    id: "dengue",
    name: "Dengue",
    meta: "Embroidered knots",
    swatch: "linear-gradient(135deg,#f1e8d6 0%,#e0a04b 50%,#8b3a3a 100%)",
    legend: "NEA active dengue clusters (data.gov.sg) plus MOH/NEA national weekly cases distributed by town population. Knots scale with caseload; alert seam wraps current hotspot towns.",
    legendScale: ["#f1e8d6", "#d4a574", "#e0a04b", "#a04a30", "#8b3a3a"],
    legendLabels: ["calm", "cluster"],
  },
  {
    id: "diversity",
    name: "Diversity",
    meta: "Pieced strips",
    swatch: "linear-gradient(90deg,#c75b3e 0 25%,#7a8c5c 25% 50%,#e0a04b 50% 75%,#3d5a6c 75% 100%)",
    legend: "Four pieced strips per patch — the town’s Chinese / Malay / Indian / Others share. Source: DOS Census 2020 (SingStat Table 17561).",
    legendScale: null,
    legendLabels: null,
  },
];

const REGIONS = [
  { id: "ALL", label: "All" },
  { id: "N",   label: "North" },
  { id: "NE",  label: "N-East" },
  { id: "E",   label: "East" },
  { id: "C",   label: "Central" },
  { id: "W",   label: "West" },
];

// ---- Narratives per layer ----
const NARRATIVES = {
  satisfaction: {
    kicker: "The base cloth",
    line: "Each patch is its town’s median HDB 4-room resale price — a proxy for desirability. Central Area &amp; Queenstown read deepest; Jurong &amp; Choa Chu Kang lightest.",
  },
  weather: {
    kicker: "Threaded with rain",
    line: `Real ${RAIN_YEAR} rainfall, station-weighted per town. The patch colour is this week's millimetres — scrub the dial below to ride the monsoons across the year.`,
  },
  dengue: {
    kicker: "Knots in the weave",
    line: "National weekly dengue cases (data.gov.sg, MOH/NEA 2018) distributed across all residential towns by population share. Each patch’s knots scale with its weekly caseload; alert seam marks current NEA hotspots.",
  },
  diversity: {
    kicker: "Pieced together",
    line: "Real CMIO shares from DOS Census 2020. The Ethnic Integration Policy keeps every patch close to the national mix; seams drift small.",
  },
};

// ============ Sparkline component for rainfall ============
function RainSpark({ series, week, region }) {
  if (!series) return null;
  const w = 240, h = 38;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const xStep = w / (series.length - 1);
  const path = series.map((v, i) => {
    const px = i * xStep;
    const py = h - ((v - min) / (max - min)) * (h - 4) - 2;
    return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
  const curX = (week - 1) * xStep;
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} width="100%" preserveAspectRatio="none">
      {/* Baseline */}
      <line x1="0" y1={h} x2={w} y2={h} stroke="#8b6f55" strokeWidth="0.4" strokeDasharray="2 2"/>
      {/* Filled area */}
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="#3d5a6c" opacity="0.12"/>
      {/* Stitched line */}
      <path d={path} fill="none" stroke="#3d5a6c" strokeWidth="1.1" strokeDasharray="2 1.4"/>
      {/* Current-week marker */}
      <line x1={curX} y1="0" x2={curX} y2={h} stroke="#c75b3e" strokeWidth="1"/>
      <circle cx={curX} cy={h - ((series[week-1] - min) / (max - min)) * (h - 4) - 2} r="2"
              fill="#c75b3e" stroke="#5a2418" strokeWidth="0.5"/>
      <text x="0" y={h + 12} fontFamily="IBM Plex Mono, monospace" fontSize="8"
            fill="#5a4030" letterSpacing="0.08em">JAN</text>
      <text x={w/2} y={h + 12} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="8"
            fill="#5a4030" letterSpacing="0.08em">JUN</text>
      <text x={w} y={h + 12} textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="8"
            fill="#5a4030" letterSpacing="0.08em">DEC</text>
    </svg>
  );
}

// ============ Detail card ============
function DetailCard({ town, layer, week }) {
  if (!town) {
    return (
      <div className="detail-empty">
        <span className="glyph">✷</span>
        Hover or tap a patch<br/>to read its threads.
      </div>
    );
  }
  const D = window.__QUILT;
  const density = D.DENSITY[town.id];
  const areaKm2 = D.AREA_KM2[town.id];
  const densityT = D.densityIntensity(density);
  const sev = D.DENGUE_SEVERITY[town.id];
  const cases = D.DENGUE_AVG[town.id];
  const eth = D.ETHNICITY[town.id];
  const rainAnnual = D.RAIN_ANNUAL[town.id];
  const rainWeek = D.RAIN_WEEKLY[town.id]?.[week - 1] ?? 0;
  const regionName = D.REGION_NAME[town.region];

  // Real active dengue cluster details for this town
  const dengueActive = D.DENGUE_ACTIVE[town.id];

  // Live weather forecast (data.gov.sg two-hour forecast) — displayed as a "right now" badge.
  // The 52-week scrubber below uses the bundled historical series; this is the present.
  const live = window.__LIVE_WEATHER;
  const liveForecast = live?.forecasts?.find(f => {
    const a = f.area.toLowerCase();
    const n = town.name.toLowerCase();
    return a === n
      || a === n.replace("/", " / ")
      || a.includes(n.split("/")[0].trim())
      || n.includes(a);
  });

  const ETH_NAMES = ["Chinese", "Malay", "Indian", "Others"];
  const ETH_COLS = ["#c75b3e", "#7a8c5c", "#e0a04b", "#3d5a6c"];

  // ---- Simplified card for non-residential planning areas ----
  if (town.category !== "resid") {
    return (
      <div className="detail-card">
        <div className="dc-region">{regionName} · Region</div>
        <h2>{town.name}</h2>
        <div className="dc-pop">
          {town.category === "none" ? "No resident population (Census 2020)." :
           `Pop. ${town.pop.toLocaleString()} — sparse / non-residential.`}
        </div>
        {liveForecast && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 10px", marginBottom: 14,
            background: "#2c1810", color: "#f1e8d6",
            border: "1px solid #6b4423",
            fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
            letterSpacing: "0.08em",
          }}>
            <span style={{ textTransform: "uppercase", opacity: 0.7 }}>
              {live?.live === false ? "Snapshot · last seen" : "Live · right now"}
            </span>
            <span style={{ color: "#e0a04b", fontWeight: 500 }}>{liveForecast.forecast}</span>
          </div>
        )}
        <div style={{
          marginTop: 8,
          fontFamily: "Newsreader, serif", fontStyle: "italic", fontSize: 14,
          color: "#5a4030", lineHeight: 1.45,
        }}>
          {town.category === "none"
            ? "This planning area is reserved for water catchment, military use, port operations, or future development — there are no residents here, so the cloth shows only a grey outline."
            : `An industrial / fringe planning area. ${town.pop ? `Census 2020 recorded ${town.pop.toLocaleString()} residents — too few for a meaningful per-town reading.` : ""}`
          }
        </div>
        {dengueActive && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed #8b6f55" }}>
            <div className="label" style={{
              fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
              letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a4030",
            }}>Active dengue clusters</div>
            <div style={{ marginTop: 6, fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: "#5a4030", lineHeight: 1.55 }}>
              {dengueActive.localities.map((loc, i) =>
                <div key={i} style={{ marginTop: i === 0 ? 0 : 4, paddingLeft: 8, textIndent: -8 }}>· {loc}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Cross-correlation hints — phrased to suggest, not assert.
  const corrHints = [];
  if (sev >= 1) corrHints.push("An active NEA dengue cluster sits in this town.");
  if (rainAnnual >= RAIN_NAT_AVG + 100) corrHints.push(`Wetter than the national average in ${RAIN_YEAR} (${rainAnnual} mm vs ${RAIN_NAT_AVG} mm).`);
  if (rainAnnual <= RAIN_NAT_AVG - 200) corrHints.push(`Drier than the national average in ${RAIN_YEAR} (${rainAnnual} mm vs ${RAIN_NAT_AVG} mm).`);
  if (density >= 20000) corrHints.push(`Densely packed (${density.toLocaleString()}/km²) — well above the national median.`);
  if (density > 0 && density <= 5000) corrHints.push(`Low-density (${density.toLocaleString()}/km²) — spacious for an HDB area.`);
  if (eth?.[3] >= 5) corrHints.push("Larger 'Others' share — more international residents than the EIP target.");
  if (eth?.[1] >= 18) corrHints.push("Above-average Malay share for this town.");

  return (
    <div className="detail-card">
      <div className="dc-region">{regionName} · Region</div>
      <h2>{town.name}</h2>
      <div className="dc-pop">
        Pop. {town.pop.toLocaleString()} · {Math.round(town.pop / 4000) / 10}k households est.
      </div>

      {liveForecast && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 10px", marginBottom: 14,
          background: "#2c1810", color: "#f1e8d6",
          border: "1px solid #6b4423",
          fontFamily: "IBM Plex Mono, monospace", fontSize: 11,
          letterSpacing: "0.08em",
        }}>
          <span style={{ textTransform: "uppercase", opacity: 0.7 }}>
            {live?.live === false ? "Snapshot · last seen" : "Live · right now"}
          </span>
          <span style={{ color: "#e0a04b", fontWeight: 500 }}>{liveForecast.forecast}</span>
        </div>
      )}


      <div className="metric-row">
        <div>
          <div className="label">Resale price (HDB 4-rm)</div>
          <div className="sub">{areaKm2 ? `${areaKm2} km² · ${density.toLocaleString()}/km²` : ""}</div>
        </div>
        <div className="value">
          ${D.SATISFACTION_PRICE[town.id] ? (D.SATISFACTION_PRICE[town.id]/1000).toFixed(0) + "k" : "—"}
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${(D.SATISFACTION[town.id] || 0) * 100}%` }}/>
        </div>
      </div>

      <div className="metric-row">
        <div>
          <div className="label">Dengue (week share)</div>
          <div className="sub">
            {sev === 2 ? "Active NEA cluster (10+ cases) — hotspot" :
             sev === 1 ? "Active NEA cluster (<10 cases)" :
             "Population-share of national weekly cases"}
          </div>
        </div>
        <div className="value" style={{ color: sev === 2 ? "#8b3a3a" : (sev === 1 ? "#b67a2e" : "#5a4030") }}>
          {(() => {
            const wk = window.__DENGUE_WEEKLY;
            const nat = wk?.series?.[week - 1] || 0;
            let totalPop = 0;
            for (const tt of D.TOWNS) if (tt.category === "resid") totalPop += tt.pop;
            const share = town.category === "resid" && totalPop
              ? nat * (town.pop / totalPop) * (sev > 0 ? 1.5 : 1)
              : 0;
            return share.toFixed(1);
          })()}
          <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "#5a4030", marginLeft: 4 }}>
            cases
          </span>
        </div>
        {dengueActive?.localities?.length > 0 && (
          <div style={{
            gridColumn: "1 / -1", marginTop: 8,
            fontFamily: "IBM Plex Mono, monospace", fontSize: 10,
            color: "#5a4030", lineHeight: 1.55,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}>
            {dengueActive.localities.map((loc, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 4, paddingLeft: 8, textIndent: -8 }}>
                · {loc}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="metric-row">
        <div>
          <div className="label">Rainfall (annual)</div>
          <div className="sub">Wk {week}: {rainWeek} mm</div>
        </div>
        <div className="value">{rainAnnual}<span style={{fontSize:11,fontFamily:"IBM Plex Mono",color:"#5a4030"}}> mm</span></div>
        <div className="rainfall-spark">
          <RainSpark series={D.RAIN_WEEKLY[town.id]} week={week} region={town.region}/>
        </div>
      </div>

      <div className="metric-row">
        <div>
          <div className="label">Ethnic mix (CMIO)</div>
          <div className="sub" style={{whiteSpace:"nowrap"}}>
            {(() => {
              if (!eth) return "";
              let bestI = 1, bestV = eth[1];
              for (let i = 2; i < 4; i++) if (eth[i] > bestV) { bestV = eth[i]; bestI = i; }
              return `↪ ${ETH_NAMES[bestI]} ${bestV}%`;
            })()}
          </div>
        </div>
        <div className="value" style={{fontSize:13,fontFamily:"IBM Plex Mono"}}>
          {eth[0]}·{eth[1]}·{eth[2]}·{eth[3]}
        </div>
        <div className="ethnic-bar">
          {eth.map((p, i) => (
            <div key={i} style={{ width: `${p}%`, background: ETH_COLS[i] }}>
              {p >= 10 && <span>{["Ch","Ma","In","Ot"][i]} {p}</span>}
              {p >= 5 && p < 10 && <span>{p}</span>}
            </div>
          ))}
        </div>
      </div>

      {corrHints.length > 0 && (
        <div style={{
          marginTop: 14,
          paddingTop: 0,
          fontFamily: "Newsreader, serif",
          fontStyle: "italic",
          fontSize: 13,
          color: "#5a4030",
          lineHeight: 1.4,
        }}>
          {corrHints.map((h, i) => <div key={i} style={{marginBottom:4}}>↪ {h}</div>)}
        </div>
      )}
    </div>
  );
}

// ============ Singapore coastline silhouette ============
// Real Singapore island outline (main landmass only, Master Plan 2019 dataset
// via yinshanyang/singapore on GitHub, simplified to ~420 points via Douglas-Peucker).
// Path is pre-projected to our grid coordinates in real-data.js → window.__REAL.outline.
function SingaporeCoastline({ gridCols, gridRows, cell, pad }) {
  const outline = window.__REAL?.outline;
  if (!outline?.pathD) return null;

  const xMid = (gridCols * cell) / 2 + pad;
  const yTop = pad - 10;
  const yBot = pad + gridRows * cell + 4;
  // Center for the 10% zoom-out (around viewBox center)
  const W = outline.width || gridCols * cell + pad * 2;
  const H = outline.height || gridRows * cell + pad * 2;
  const cx = W / 2, cy = H / 2;

  return (
    <g pointerEvents="none" transform={`translate(${cx} ${cy}) scale(0.9) translate(${-cx} ${-cy})`}>
      {/* Soft warm land wash */}
      <path d={outline.pathD} fill="#ebdfc4" opacity="0.55"/>
      <path d={outline.pathD} fill="url(#weave-cream)" opacity="0.4"/>
      {/* Drop shadow (offset for dimension) */}
      <path d={outline.pathD} fill="none" stroke="#8b6f55" strokeWidth="0.6"
            opacity="0.3" transform="translate(2, 2)"/>
      {/* Main stitched coastline */}
      <path d={outline.pathD} fill="none" stroke="#6b4423" strokeWidth="0.9"
            strokeDasharray="3 2" strokeLinejoin="round" opacity="0.7"/>
      {/* Double-stitch running line */}
      <path d={outline.pathD} fill="none" stroke="#6b4423" strokeWidth="0.35"
            strokeDasharray="1 3" strokeLinejoin="round" opacity="0.45"
            transform="translate(-1.5, -1.5)"/>

      {/* Compass / coordinate label tucked in NW water */}
      <text x={pad - 4} y={pad - 14}
            fontFamily="IBM Plex Mono, monospace"
            fontSize="8.5" fill="#6b4423"
            letterSpacing="0.18em" opacity="0.6">
        1°22′N · 103°48′E
      </text>
      {/* Johor Strait label, top */}
      <text x={xMid} y={yTop}
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="8" fill="#8b6f55"
            letterSpacing="0.2em" opacity="0.55">
        —  J O H O R   S T R A I T  —
      </text>
      {/* Singapore Strait label, bottom */}
      <text x={xMid} y={yBot}
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="8" fill="#8b6f55"
            letterSpacing="0.2em" opacity="0.55">
        —  S I N G A P O R E   S T R A I T  —
      </text>
    </g>
  );
}

// ============ Main App ============
function App() {
  const D = window.__QUILT;
  const [layer, setLayer] = useState("satisfaction");
  const [region, setRegion] = useState("ALL");
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [week, setWeek] = useState(28); // mid-year by default
  const [dataRev, setDataRev] = useState(0); // bumped when live data refreshes
  const [showOutline, setShowOutline] = useState(false);

  // Re-render when window.__REAL is refreshed by the runtime fetch in the HTML.
  useEffect(() => {
    const onRefresh = () => setDataRev(r => r + 1);
    window.addEventListener("realdata-refreshed", onRefresh);
    return () => window.removeEventListener("realdata-refreshed", onRefresh);
  }, []);

  const layerCfg = LAYERS.find(l => l.id === layer);
  const focusTown = selected || hovered;

  const visibleTowns = useMemo(() => {
    return D.TOWNS.filter(t => region === "ALL" || t.region === region);
  }, [region]);

  const onTileHover = (town, e) => {
    setHovered(town);
    setTooltip({ town, x: e.clientX, y: e.clientY });
  };
  const onTileLeave = () => {
    setHovered(null);
    setTooltip(null);
  };
  const onTileClick = (town) => {
    setSelected(prev => prev && prev.id === town.id ? null : town);
  };

  // Calculate SVG viewBox
  const CELL = D.GRID_CELL;
  const PAD = D.GRID_PAD;
  const W = D.GRID_COLS * CELL + PAD * 2;
  const H = D.GRID_ROWS * CELL + PAD * 2 + 14; // +14 for label below last row

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <div className="kicker">
            <span className="dot"/>
            <span>Quilt · Vol. I</span>
            <span>·</span>
            <span>An editorial on Singapore in fabric</span>
          </div>
          <h1>Patchwork <em>Singapore</em></h1>
          <p className="standfirst">
            Four readings of the island, stitched onto the same cloth. Toggle a layer to swap
            the embroidery — see how the weather, the mosquitoes, and the people change the shape
            of a satisfied home.
          </p>
        </div>
        <div className="masthead-meta">
          <div><strong>27</strong> towns / estates</div>
          <div><strong>{RAIN_DAY_COUNT}</strong> daily rainfall fetches · {RAIN_YEAR}</div>
          <div><span style={{color:"#c75b3e"}}>●</span> live weather · data.gov.sg</div>
        </div>
      </header>

      <div className="body-grid">
        {/* ============== LEFT RAIL ============== */}
        <aside className="rail-left">
          <div className="rail-section">
            <h3>Layer</h3>
            <div className="layer-toggle">
              {LAYERS.map(L => (
                <button key={L.id}
                        className={`layer-btn ${layer === L.id ? "active" : ""}`}
                        onClick={() => setLayer(L.id)}>
                  <span className="swatch" style={{ background: L.swatch }}/>
                  <span>
                    <span className="layer-name" style={{display:"block"}}>{L.name}</span>
                    <span className="layer-meta">{L.meta}</span>
                  </span>
                  <span style={{
                    fontFamily:"IBM Plex Mono", fontSize:10, opacity:0.6
                  }}>{String(LAYERS.indexOf(L)+1).padStart(2,"0")}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rail-section">
            <h3>Region</h3>
            <div className="filter-chips">
              {REGIONS.map(R => (
                <button key={R.id}
                        className={`chip ${region === R.id ? "active" : ""}`}
                        onClick={() => setRegion(R.id)}>
                  {R.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rail-section">
            <h3>Map</h3>
            <button className={`chip ${showOutline ? "active" : ""}`}
                    onClick={() => setShowOutline(s => !s)}>
              {showOutline ? "✓ Show coastline" : "  Hide coastline"}
            </button>
          </div>
        </aside>

        {/* ============== QUILT ============== */}
        <main>
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"baseline",
            marginBottom: 10
          }}>
            <div>
              <div style={{
                fontFamily:"IBM Plex Mono, monospace", fontSize:11,
                letterSpacing:"0.16em", textTransform:"uppercase", color:"#5a4030",
                marginBottom: 8
              }}>{NARRATIVES[layer].kicker}</div>
              <div style={{
                fontFamily:"Newsreader, serif", fontStyle:"italic", fontSize:17,
                color:"#2c1810", maxWidth:580, lineHeight:1.4
              }}>
                {NARRATIVES[layer].line}
                {layer === "dengue" && window.__DENGUE_WEEKLY && (
                  <span style={{
                    display: "block", marginTop: 8,
                    fontStyle: "normal", fontFamily: "IBM Plex Mono, monospace",
                    fontSize: 11, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "#8b3a3a",
                  }}>
                    Wk {week} {window.__DENGUE_WEEKLY.year}: {window.__DENGUE_WEEKLY.series[week-1]} cases nationally · max {window.__DENGUE_WEEKLY.max}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="quilt-wrap">
            <svg className="quilt-svg" viewBox={`0 0 ${W} ${H}`}>
              <TextilePatterns/>
              {/* Background canvas with subtle weave */}
              <rect width={W} height={H} fill="url(#weave-cream)" opacity="0.4"/>

              {/* Singapore coastline — a faint embroidered island shape that the patches sit on. */}
              {/* Simplified silhouette in the same coordinate space as the grid. */}
              {showOutline && <SingaporeCoastline gridCols={D.GRID_COLS} gridRows={D.GRID_ROWS} cell={CELL} pad={PAD}/>}

              {/* Tiles */}
              {D.TOWNS.map(t => (
                <QuiltTile key={t.id}
                  town={t}
                  layer={layer}
                  week={week}
                  isSelected={selected && selected.id === t.id}
                  isDimmed={region !== "ALL" && t.region !== region}
                  onHover={onTileHover}
                  onLeave={onTileLeave}
                  onClick={onTileClick}/>
              ))}

              {/* fig. 1 — inside the cloth, bottom left */}
              <text x={PAD + 4} y={H - 14}
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10" fill="#5a4030"
                    letterSpacing="0.16em" opacity="0.6">
                FIG. 1 — THE CLOTH
              </text>
            </svg>
          </div>

          <div className="quilt-caption">
            <span>↳ Hover a patch · click to pin · scrub the week dial below</span>
            <span>{visibleTowns.length} / {D.TOWNS.length} patches shown</span>
          </div>

          {/* Week scrubber — only enabled on layers that vary by week */}
          {(() => {
            const driven = layer === "weather" || layer === "dengue";
            return (
              <div className="scrubber" style={{
                opacity: driven ? 1 : 0.45,
                pointerEvents: driven ? "auto" : "none",
                filter: driven ? "none" : "grayscale(0.8)",
              }}>
                <span className="label">Week of {layer === "dengue" && window.__DENGUE_WEEKLY ? window.__DENGUE_WEEKLY.year : RAIN_YEAR}</span>
                <input type="range" min="1" max="52" value={week} disabled={!driven}
                       onChange={e => setWeek(parseInt(e.target.value))}/>
                <span className="week-label">
                  Wk {String(week).padStart(2,"0")} · {D.WEEK_MONTH(week)}
                </span>
              </div>
            );
          })()}

          {/* Legend — sits below the cloth */}
          <div className="legend-below" style={{
            marginTop: 18,
            padding: "14px 16px",
            background: "var(--linen)",
            border: "1px solid var(--thread-dark)",
          }}>
            <h3 style={{
              fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: "var(--ink-soft)", margin: "0 0 10px",
              paddingBottom: 8, borderBottom: "1px dashed var(--ink-fade)",
            }}>Legend · {layerCfg.name}</h3>
            {layerCfg.legend && (
              <div style={{ marginBottom: 10, fontFamily: "Newsreader, serif", fontStyle: "italic", color: "#5a4030", fontSize: 13, lineHeight: 1.45 }}>
                {layerCfg.legend}
              </div>
            )}
            {layerCfg.legendScale && (
              <div style={{ marginBottom: 12 }}>
                <div className="legend-scale">
                  {layerCfg.legendScale.map((c, i) => <div key={i} style={{ background: c }}/>)}
                </div>
                <div className="legend-labels">
                  <span>{layerCfg.legendLabels[0]}</span>
                  <span>{layerCfg.legendLabels[1]}</span>
                </div>
              </div>
            )}
            <div style={{display:"flex", flexWrap:"nowrap", gap:"22px", overflowX:"auto"}}>
              {layer === "diversity" && (
                [
                  ["Chinese","#c75b3e"],["Malay","#7a8c5c"],
                  ["Indian","#e0a04b"],["Others","#3d5a6c"]
                ].map(([n,c],i)=>(
                  <div key={i} className="legend-row">
                    <span className="icon" style={{background:c, border:"1px solid #3a2a18"}}/>
                    <span style={{fontFamily:"Newsreader, serif"}}>{n}</span>
                  </div>
                ))
              )}
              {layer === "dengue" && (<>
                <div className="legend-row">
                  <svg className="icon" viewBox="0 0 18 18">
                    <rect width="18" height="18" fill="#e0a04b"/>
                    <circle cx="6" cy="7" r="1.7" fill="#a83a3a"/>
                    <circle cx="11" cy="10" r="1.7" fill="#a83a3a"/>
                  </svg>
                  <span style={{fontFamily:"Newsreader, serif"}}>Knot ≈ 1.5 weekly cases</span>
                </div>
                <div className="legend-row">
                  <svg className="icon" viewBox="0 0 18 18">
                    <rect x="1" y="1" width="16" height="16" fill="#8b3a3a"/>
                    <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="#a83a3a" strokeDasharray="2 1.5"/>
                  </svg>
                  <span style={{fontFamily:"Newsreader, serif"}}>Red seam = current NEA hotspot</span>
                </div>
              </>)}
              {layer === "weather" && (<>
                <div className="legend-row">
                  <svg className="icon" viewBox="0 0 18 18">
                    <rect width="18" height="18" fill="#3d5a6c"/>
                    <line x1="4" y1="2" x2="6" y2="16" stroke="#1a2a36" strokeWidth="0.8"/>
                    <line x1="9" y1="2" x2="11" y2="16" stroke="#1a2a36" strokeWidth="0.8"/>
                    <line x1="14" y1="2" x2="16" y2="16" stroke="#1a2a36" strokeWidth="0.8"/>
                  </svg>
                  <span style={{fontFamily:"Newsreader, serif"}}>Dense diagonal = rainy week</span>
                </div>
                <div className="legend-row">
                  <svg className="icon" viewBox="0 0 18 18">
                    <rect width="18" height="18" fill="#d4a574"/>
                    <circle cx="9" cy="9" r="2" fill="#e0a04b" stroke="#7a5230" strokeWidth="0.4"/>
                  </svg>
                  <span style={{fontFamily:"Newsreader, serif"}}>Sun mark = dry week</span>
                </div>
              </>)}
              {layer === "satisfaction" && (<>
                <div className="legend-row">
                  <svg className="icon" viewBox="0 0 18 18">
                    <rect width="3.6" height="18" fill="#f1e8d6"/>
                    <rect x="3.6" width="3.6" height="18" fill="#d4a574"/>
                    <rect x="7.2" width="3.6" height="18" fill="#e0a04b"/>
                    <rect x="10.8" width="3.6" height="18" fill="#a04a30"/>
                    <rect x="14.4" width="3.6" height="18" fill="#c75b3e"/>
                  </svg>
                  <span style={{fontFamily:"Newsreader, serif"}}>Darker colour = more desirable</span>
                </div>
              </>)}
            </div>
          </div>
        </main>

        {/* ============== RIGHT RAIL ============== */}
        <aside className="rail-right">
          <h3>{selected ? "Pinned patch" : "Patch reading"}</h3>
          <DetailCard town={focusTown} layer={layer} week={week}/>

          {focusTown && (
            <div style={{
              marginTop: 16,
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#8b6f55",
              textAlign: "center"
            }}>
              {selected ? "Click again to unpin" : "Click patch to pin"}
            </div>
          )}
        </aside>
      </div>

      {/* Footnote band */}
      <footer className="footnote">
        <div>
          <strong>Satisfaction</strong>
          Median HDB 4-room resale price per town, 2024–2025. Higher price reads as deeper colour and a
          tighter quilt-block ornament. Source: HDB / data.gov.sg dataset
          <code> d_b51323a474ba789fb4cc3db58a3116d4</code>.
        </div>
        <div>
          <strong>Weather</strong>
          Per-town weekly rainfall (mm) aggregated from {RAIN_DAY_COUNT} daily fetches of the
          data.gov.sg rainfall API across {RAIN_YEAR}. Each town's value is an
          inverse-distance-weighted average of its five nearest rainfall stations.
        </div>
        <div>
          <strong>Dengue</strong>
          MOH/NEA national weekly case counts (data.gov.sg) distributed across residential towns by
          their Census 2020 population share; towns with current active NEA clusters get a 1.5× boost
          and an alert seam.
        </div>
        <div>
          <strong>Diversity</strong>
          Chinese / Malay / Indian / Others composition per town from the DOS Census of Population 2020
          (SingStat Table 17561). Planning-area boundaries from URA Master Plan 2019.
        </div>
      </footer>

      {/* Tooltip */}
      {tooltip && (() => {
        const t = tooltip.town;
        const density = D.DENSITY[t.id];
        const cases = D.DENGUE_AVG[t.id];
        const rainAnnual = D.RAIN_ANNUAL[t.id];
        const eth = D.ETHNICITY[t.id];
        const X = Math.min(window.innerWidth - 260, tooltip.x + 14);
        const Y = Math.min(window.innerHeight - 160, tooltip.y + 14);
        if (t.category !== "resid") {
          return (
            <div className="tooltip" style={{ left: X, top: Y }}>
              <div className="tt-name">{t.name}</div>
              <div className="tt-row"><span>STATUS</span><span className="v">{t.category === "none" ? "NO RESIDENTS" : "SPARSE"}</span></div>
              {t.pop > 0 && <div className="tt-row"><span>POP</span><span className="v">{t.pop.toLocaleString()}</span></div>}
            </div>
          );
        }
        return (
          <div className="tooltip" style={{ left: X, top: Y }}>
            <div className="tt-name">{t.name}</div>
            <div className="tt-row"><span>DENSITY</span><span className="v">{density.toLocaleString()}/km²</span></div>
            <div className="tt-row"><span>DENGUE</span><span className="v">{(() => {
              const wk = window.__DENGUE_WEEKLY;
              const nat = wk?.series?.[week - 1] || 0;
              let totalPop = 0;
              for (const tt of D.TOWNS) if (tt.category === "resid") totalPop += tt.pop;
              if (t.category !== "resid" || !totalPop) return "—";
              const sev = D.DENGUE_SEVERITY[t.id];
              const share = nat * (t.pop / totalPop) * (sev > 0 ? 1.5 : 1);
              return `${share.toFixed(1)} cases`;
            })()}</span></div>
            <div className="tt-row"><span>RAIN / YR</span><span className="v">{rainAnnual} mm</span></div>
            <div className="tt-row"><span>CMIO</span><span className="v">{eth ? eth.join("·") : "—"}</span></div>
          </div>
        );
      })()}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
