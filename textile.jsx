// Patchwork Singapore — textile primitives
// Renders SVG patterns, fray edges, stitched borders, dense weave.
// Exports to window so other JSX files can use them.

const TextilePatterns = () => (
  <defs>
    {/* ====== Weave patterns — base fabric colors ====== */}
    {[
      ["weave-cream",  "#f1e8d6", "#6b4423"],
      ["weave-sand",   "#d4a574", "#7a5230"],
      ["weave-ochre",  "#e0a04b", "#7a5230"],
      ["weave-clay",   "#c75b3e", "#5a2418"],
      ["weave-claydp", "#8b3a3a", "#3e1818"],
      ["weave-sage",   "#7a8c5c", "#3a4a28"],
      ["weave-sagedp", "#5e7a48", "#28341a"],
      ["weave-indigo", "#3d5a6c", "#1a2a36"],
      ["weave-indigodp","#2c4a5e","#0e1e2a"],
      ["weave-rust",   "#a04a30", "#4a1e10"],
    ].map(([id, fill, thread]) => (
      <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill={fill}/>
        {/* vertical warp */}
        <line x1="1" y1="0" x2="1" y2="6" stroke={thread} strokeWidth="0.6" opacity="0.35"/>
        <line x1="3" y1="0" x2="3" y2="6" stroke={thread} strokeWidth="0.6" opacity="0.2"/>
        <line x1="5" y1="0" x2="5" y2="6" stroke={thread} strokeWidth="0.6" opacity="0.35"/>
        {/* horizontal weft */}
        <line x1="0" y1="1" x2="6" y2="1" stroke={thread} strokeWidth="0.6" opacity="0.2"/>
        <line x1="0" y1="3" x2="6" y2="3" stroke={thread} strokeWidth="0.6" opacity="0.35"/>
        <line x1="0" y1="5" x2="6" y2="5" stroke={thread} strokeWidth="0.6" opacity="0.2"/>
        {/* highlight specks */}
        <circle cx="2" cy="2" r="0.3" fill={fill} opacity="0.6"/>
        <circle cx="4" cy="4" r="0.3" fill={fill} opacity="0.6"/>
      </pattern>
    ))}

    {/* ====== Rain-thread overlay (for weather layer) ====== */}
    <pattern id="rain-light" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(20)">
      <line x1="2" y1="0" x2="2" y2="8" stroke="#3d5a6c" strokeWidth="0.4" opacity="0.4"/>
    </pattern>
    <pattern id="rain-med" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(20)">
      <line x1="1" y1="0" x2="1" y2="5" stroke="#3d5a6c" strokeWidth="0.5" opacity="0.55"/>
    </pattern>
    <pattern id="rain-heavy" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(20)">
      <line x1="0.6" y1="0" x2="0.6" y2="3" stroke="#2c4a5e" strokeWidth="0.55" opacity="0.7"/>
    </pattern>

    {/* ====== Sun-thread overlay (dry weeks) ====== */}
    <pattern id="sun-stitch" patternUnits="userSpaceOnUse" width="12" height="12">
      <circle cx="6" cy="6" r="0.6" fill="#e0a04b" opacity="0.6"/>
    </pattern>

    {/* ====== Satisfaction quilt-block (concentric square block) drop-in ====== */}
    <symbol id="block-nine-patch" viewBox="0 0 30 30">
      <rect x="0" y="0" width="30" height="30" fill="none"/>
      <rect x="10" y="10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.55"/>
      <rect x="6" y="6" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" strokeDasharray="1.5 1.5"/>
    </symbol>

    {/* ====== Dengue "french knot" ====== */}
    <symbol id="knot" viewBox="0 0 4 4">
      <circle cx="2" cy="2" r="1.2" fill="#a83a3a"/>
      <circle cx="2" cy="2" r="0.5" fill="#5a1a1a"/>
    </symbol>

    {/* ====== Filters for paper-grain shadow ====== */}
    <filter id="paper-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.6"/>
      <feOffset dx="0.5" dy="1.2" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
      <feComposite in="SourceGraphic"/>
    </filter>
  </defs>
);

// Frayed thread edge — drawn around a rect (cx,cy,w,h).
// Returns an array of tiny <line> elements simulating loose threads.
const FrayedEdge = ({ x, y, w, h, color = "#6b4423", seed = 0 }) => {
  const lines = [];
  // Deterministic pseudo-random based on seed
  const r = (k) => {
    const s = Math.sin((seed + 1) * 9973 + k * 3.7) * 10000;
    return s - Math.floor(s);
  };
  const N_EDGE = 7;
  // Top edge
  for (let i = 0; i < N_EDGE; i++) {
    const px = x + ((i + 0.5) / N_EDGE) * w + (r(i) - 0.5) * 4;
    const len = 1.5 + r(i + 1) * 2.5;
    const ang = -90 + (r(i + 2) - 0.5) * 40;
    const rad = (ang * Math.PI) / 180;
    lines.push(
      <line key={`t${i}`} x1={px} y1={y} x2={px + Math.cos(rad) * len} y2={y + Math.sin(rad) * len}
            stroke={color} strokeWidth="0.6" opacity="0.75" strokeLinecap="round"/>
    );
  }
  // Bottom edge
  for (let i = 0; i < N_EDGE; i++) {
    const px = x + ((i + 0.5) / N_EDGE) * w + (r(i + 10) - 0.5) * 4;
    const len = 1.5 + r(i + 11) * 2.5;
    const ang = 90 + (r(i + 12) - 0.5) * 40;
    const rad = (ang * Math.PI) / 180;
    lines.push(
      <line key={`b${i}`} x1={px} y1={y + h} x2={px + Math.cos(rad) * len} y2={y + h + Math.sin(rad) * len}
            stroke={color} strokeWidth="0.6" opacity="0.75" strokeLinecap="round"/>
    );
  }
  // Left edge
  for (let i = 0; i < N_EDGE; i++) {
    const py = y + ((i + 0.5) / N_EDGE) * h + (r(i + 20) - 0.5) * 4;
    const len = 1.5 + r(i + 21) * 2.5;
    const ang = 180 + (r(i + 22) - 0.5) * 40;
    const rad = (ang * Math.PI) / 180;
    lines.push(
      <line key={`l${i}`} x1={x} y1={py} x2={x + Math.cos(rad) * len} y2={py + Math.sin(rad) * len}
            stroke={color} strokeWidth="0.6" opacity="0.7" strokeLinecap="round"/>
    );
  }
  // Right edge
  for (let i = 0; i < N_EDGE; i++) {
    const py = y + ((i + 0.5) / N_EDGE) * h + (r(i + 30) - 0.5) * 4;
    const len = 1.5 + r(i + 31) * 2.5;
    const ang = 0 + (r(i + 32) - 0.5) * 40;
    const rad = (ang * Math.PI) / 180;
    lines.push(
      <line key={`r${i}`} x1={x + w} y1={py} x2={x + w + Math.cos(rad) * len} y2={py + Math.sin(rad) * len}
            stroke={color} strokeWidth="0.6" opacity="0.7" strokeLinecap="round"/>
    );
  }
  return <g>{lines}</g>;
};

// Decorative cross-stitch corner marks
const CornerStitches = ({ x, y, w, h, color = "#6b4423" }) => (
  <g stroke={color} strokeWidth="0.7" opacity="0.8">
    {/* top-left */}
    <line x1={x + 2} y1={y + 2} x2={x + 5} y2={y + 5}/>
    <line x1={x + 5} y1={y + 2} x2={x + 2} y2={y + 5}/>
    {/* top-right */}
    <line x1={x + w - 5} y1={y + 2} x2={x + w - 2} y2={y + 5}/>
    <line x1={x + w - 2} y1={y + 2} x2={x + w - 5} y2={y + 5}/>
    {/* bottom-left */}
    <line x1={x + 2} y1={y + h - 5} x2={x + 5} y2={y + h - 2}/>
    <line x1={x + 5} y1={y + h - 5} x2={x + 2} y2={y + h - 2}/>
    {/* bottom-right */}
    <line x1={x + w - 5} y1={y + h - 5} x2={x + w - 2} y2={y + h - 2}/>
    <line x1={x + w - 2} y1={y + h - 5} x2={x + w - 5} y2={y + h - 2}/>
  </g>
);

Object.assign(window, { TextilePatterns, FrayedEdge, CornerStitches });
