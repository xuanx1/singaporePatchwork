// Patchwork Singapore — Tile component (one planning area as a quilt patch)
// Renders different visual encodings depending on the active layer and the area's
// data category: "resid" (full data) → colored patch; "sparse" (1–10k residents)
// → muted half-size patch; "none" (no resident data) → grey outline only.

const { useMemo: tUseMemo } = React;

// ----- Color scales -----
// Satisfaction (proxy: resale price intensity 0–1): cream → ochre → clay
const satisfactionFill = (t) => {
  if (t == null) return "url(#weave-cream)";
  if (t >= 0.8) return "url(#weave-clay)";
  if (t >= 0.6) return "url(#weave-rust)";
  if (t >= 0.4) return "url(#weave-ochre)";
  if (t >= 0.2) return "url(#weave-sand)";
  return "url(#weave-cream)";
};
const satisfactionInk = (t) => (t >= 0.6 ? "#faf6ec" : "#2c1810");
// Density (kept for tooltip/detail)
const densityFill = satisfactionFill;
const densityInk = satisfactionInk;

const dengueFill = (sev, cases) => {
  if (sev === 2) return "url(#weave-claydp)";
  if (sev === 1) return "url(#weave-ochre)";
  if (cases >= 8) return "url(#weave-sand)";
  return "url(#weave-cream)";
};

// Weather: weekly rainfall (mm) — base color drives most of the weekly variation
const weatherFill = (weeklyMm) => {
  // Bands tuned to Singapore weekly distribution (mostly 15–120 mm)
  if (weeklyMm >= 110) return "url(#weave-indigodp)";
  if (weeklyMm >= 70)  return "url(#weave-indigo)";
  if (weeklyMm >= 45)  return "url(#weave-sage)";
  if (weeklyMm >= 25)  return "url(#weave-sand)";
  if (weeklyMm >= 10)  return "url(#weave-ochre)";
  return "url(#weave-cream)";
};
const weeklyRainBand = (mm) => {
  if (mm >= 80) return "heavy";
  if (mm >= 40) return "med";
  if (mm >= 15) return "light";
  return "none";
};

const ETH_FILLS = ["url(#weave-clay)", "url(#weave-sage)", "url(#weave-ochre)", "url(#weave-indigo)"];

// --------- Tile ---------
function QuiltTile({ town, layer, week, isSelected, isDimmed, onHover, onLeave, onClick }) {
  const { id, name, category } = town;
  const D = window.__QUILT;

  const CELL = D.GRID_CELL;
  const PAD = D.GRID_PAD;

  const density = D.DENSITY[id];
  const densityT = D.densityIntensity(density);
  const satT = D.SATISFACTION[id];
  const sev = D.DENGUE_SEVERITY[id];
  const cases = D.DENGUE_AVG[id];
  const eth = D.ETHNICITY[id];
  const rainAnnual = D.RAIN_ANNUAL[id];
  const rainWeek = D.RAIN_WEEKLY[id]?.[week - 1] ?? 0;

  // Tile dimensions — uniform within a category, no population scaling
  const sizeBase = CELL * 0.78;     // residential: leaves clear gap between patches
  const sizeNarrow = CELL * 0.5;    // sparse / none: ~50% of cell
  const size = category === "resid" ? sizeBase : sizeNarrow;
  const x = PAD + town.col * CELL + (CELL - size) / 2;
  const y = PAD + town.row * CELL + (CELL - size) / 2;

  // ---- Greyed-out non-residential patch ----
  if (category !== "resid") {
    const isSparse = category === "sparse";
    const tooltipPos = (e) => onHover(town, e);
    return (
      <g className={`tile-group ${isSelected ? "selected" : ""} ${isDimmed ? "dim" : ""}`}
         onMouseEnter={tooltipPos} onMouseMove={tooltipPos}
         onMouseLeave={onLeave} onClick={() => onClick(town)}>
        {/* Empty-data tile: grey fabric outline */}
        <rect x={x} y={y} width={size} height={size}
              fill={isSparse ? "rgba(139,111,85,0.18)" : "transparent"}
              stroke="#8b6f55"
              strokeWidth="0.7"
              strokeDasharray="1.6 2"
              opacity={isSelected ? 1 : 0.75}/>
        {/* Diagonal hatch to read as "no data" */}
        {!isSparse && (
          <line x1={x} y1={y} x2={x + size} y2={y + size}
                stroke="#8b6f55" strokeWidth="0.4" opacity="0.4"/>
        )}
        {/* Faint label */}
        <text x={x + size / 2} y={y + size + 10}
              textAnchor="middle"
              fontFamily="'IBM Plex Mono', monospace"
              fontSize="7" fill="#8b6f55"
              letterSpacing="0.04em" opacity="0.7">
          {name.length > 14 ? name.replace(/ /g, " ").slice(0, 14).toUpperCase() : name.toUpperCase()}
        </text>
      </g>
    );
  }

  // ---- Residential patch with full layer encoding ----
  const layerRender = tUseMemo(() => {
    switch (layer) {
      case "satisfaction": {
        const fill = satisfactionFill(satT);
        const inkColor = satisfactionInk(satT);
        return (
          <g>
            <rect x={x} y={y} width={size} height={size} fill={fill}/>
            <g color={inkColor} opacity="0.75">
              <rect x={x + size * 0.18} y={y + size * 0.18}
                    width={size * 0.64} height={size * 0.64}
                    fill="none" stroke="currentColor" strokeWidth="0.6"
                    strokeDasharray="2 1.4"/>
              <rect x={x + size * 0.34} y={y + size * 0.34}
                    width={size * 0.32} height={size * 0.32}
                    fill="none" stroke="currentColor" strokeWidth="0.6"/>
              <circle cx={x + size / 2} cy={y + size / 2}
                      r={1 + (satT || 0) * 3}
                      fill="currentColor"/>
            </g>
          </g>
        );
      }
      case "density": {
        const fill = densityFill(densityT);
        const inkColor = densityInk(densityT);
        return (
          <g>
            <rect x={x} y={y} width={size} height={size} fill={fill}/>
            {/* Concentric block ornament — tighter with more density */}
            <g color={inkColor} opacity="0.75">
              <rect x={x + size * 0.18} y={y + size * 0.18}
                    width={size * 0.64} height={size * 0.64}
                    fill="none" stroke="currentColor" strokeWidth="0.6"
                    strokeDasharray="2 1.4"/>
              <rect x={x + size * 0.34} y={y + size * 0.34}
                    width={size * 0.32} height={size * 0.32}
                    fill="none" stroke="currentColor" strokeWidth="0.6"/>
              <circle cx={x + size / 2} cy={y + size / 2}
                      r={1 + (densityT || 0) * 3}
                      fill="currentColor"/>
            </g>
          </g>
        );
      }
      case "weather": {
        const fill = weatherFill(rainWeek);
        const band = weeklyRainBand(rainWeek);
        const overlay =
          band === "heavy" ? "url(#rain-heavy)" :
          band === "med"   ? "url(#rain-med)" :
          band === "light" ? "url(#rain-light)" :
          "url(#sun-stitch)";
        return (
          <g>
            <rect x={x} y={y} width={size} height={size} fill={fill}/>
            <rect x={x} y={y} width={size} height={size} fill={overlay}/>
            {band === "none" ? (
              <g transform={`translate(${x + size - 14}, ${y + 8})`} opacity="0.85">
                <circle cx="0" cy="3" r="2.6" fill="#e0a04b" stroke="#7a5230" strokeWidth="0.4"/>
                {[0,1,2,3,4,5,6,7].map(i => {
                  const a = (i * Math.PI) / 4;
                  return <line key={i} x1={Math.cos(a)*3.5} y1={3+Math.sin(a)*3.5}
                                x2={Math.cos(a)*5.3} y2={3+Math.sin(a)*5.3}
                                stroke="#7a5230" strokeWidth="0.6" opacity="0.8"/>;
                })}
              </g>
            ) : (
              <g transform={`translate(${x + size - 12}, ${y + 7})`} opacity="0.9">
                <path d="M0,0 C-3,4 -3,7 0,7 C3,7 3,4 0,0 Z"
                      fill="#2c4a5e" stroke="#0e1e2a" strokeWidth="0.4"/>
              </g>
            )}
          </g>
        );
      }
      case "dengue": {
        // National weekly count is REAL (data.gov.sg MOH/NEA). We don't have per-town
        // weekly history, so distribute that national count across residential towns
        // by their share of the residential population (Census 2020).
        const wk = window.__DENGUE_WEEKLY;
        const nationalThisWeek = wk?.series?.[week - 1] || 0;
        // Resident population total across residential towns (Census 2020)
        const D = window.__QUILT;
        let totalResidentPop = 0;
        for (const tt of D.TOWNS) if (tt.category === "resid") totalResidentPop += tt.pop;
        // This town's weekly share
        const townPop = town.pop;
        const isResid = town.category === "resid";
        const townShare = isResid && totalResidentPop > 0
          ? nationalThisWeek * (townPop / totalResidentPop)
          : 0;
        // Snapshot hotspot bonus: towns with active clusters get an extra weight
        const snapshotBoost = sev > 0 ? 1.5 : 1;
        const adjShare = townShare * snapshotBoost;

        // Color band by adjusted share
        let fill = "url(#weave-cream)";
        if (adjShare >= 8) fill = "url(#weave-claydp)";
        else if (adjShare >= 5) fill = "url(#weave-rust)";
        else if (adjShare >= 3) fill = "url(#weave-ochre)";
        else if (adjShare >= 1.5) fill = "url(#weave-sand)";

        // Knot count: 1 knot per ~1.5 cases (this town this week)
        const nKnots = Math.min(20, Math.round(adjShare / 1.5));
        const knots = [];
        for (let i = 0; i < nKnots; i++) {
          const s1 = Math.sin((id.charCodeAt(0) + i) * 9.7) * 10000;
          const s2 = Math.sin((id.charCodeAt(1) + i) * 13.3) * 10000;
          const r1 = s1 - Math.floor(s1);
          const r2 = s2 - Math.floor(s2);
          const kx = x + 8 + r1 * (size - 16);
          const ky = y + 8 + r2 * (size - 16);
          knots.push(<use key={i} href="#knot" x={kx - 2.5} y={ky - 2.5} width="5" height="5"/>);
        }
        return (
          <g>
            <rect x={x} y={y} width={size} height={size} fill={fill}/>
            {knots}
            {sev === 2 && (
              <rect x={x - 2} y={y - 2} width={size + 4} height={size + 4}
                    fill="none" stroke="#a83a3a" strokeWidth="1.2"
                    strokeDasharray="2 1.6"/>
            )}
          </g>
        );
      }
      case "diversity": {
        if (!eth) return <rect x={x} y={y} width={size} height={size} fill="url(#weave-cream)"/>;
        const widths = eth.map(p => (p / 100) * size);
        let cx = x;
        return (
          <g>
            {widths.map((w, i) => {
              const strip = (
                <g key={i}>
                  <rect x={cx} y={y} width={w} height={size} fill={ETH_FILLS[i]}/>
                  {i > 0 && (
                    <line x1={cx} y1={y + 2} x2={cx} y2={y + size - 2}
                          stroke="#3a2a18" strokeWidth="0.5"
                          strokeDasharray="1.5 1.2" opacity="0.7"/>
                  )}
                </g>
              );
              cx += w;
              return strip;
            })}
          </g>
        );
      }
      default:
        return null;
    }
  }, [layer, week, densityT, sev, cases, eth, rainAnnual, rainWeek, x, y, size]);

  return (
    <g className={`tile-group ${isSelected ? "selected" : ""} ${isDimmed ? "dim" : ""}`}
       onMouseEnter={(e) => onHover(town, e)}
       onMouseMove={(e) => onHover(town, e)}
       onMouseLeave={onLeave}
       onClick={() => onClick(town)}
       filter="url(#paper-shadow)">
      {layerRender}

      {/* Stitched border */}
      <rect x={x} y={y} width={size} height={size}
            fill="none"
            stroke={isSelected ? "#2c1810" : "#3a2a18"}
            strokeWidth={isSelected ? "1.4" : "0.9"}
            strokeDasharray={isSelected ? "3 1.2" : "2.4 1.6"}
            opacity={isSelected ? 1 : 0.85}/>

      {/* Frayed edge threads */}
      <FrayedEdge x={x} y={y} w={size} h={size}
                  color="#5a3a20"
                  seed={town.col * 7 + town.row * 11}/>

      {/* Corner cross-stitches */}
      <CornerStitches x={x} y={y} w={size} h={size} color="#3a2a18"/>

      {/* Town name label */}
      <text x={x + size / 2} y={y + size + 11}
            textAnchor="middle"
            fontFamily="'IBM Plex Mono', monospace"
            fontSize={name.length > 16 ? 7 : 8.2}
            fill="#2c1810"
            letterSpacing="0.04em">
        {name.toUpperCase()}
      </text>
    </g>
  );
}

window.QuiltTile = QuiltTile;
