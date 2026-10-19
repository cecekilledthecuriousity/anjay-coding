// scripts/generate-vector-stamps.js
// Generates authentic, professional travel passport ink stamps as SVG and PNG
// Updated with proper Corporate Training & Development terminology (No Immigration/Visa jargon)
const fs = require('fs');
const path = require('path');

const STAMPS_DIR = path.join(__dirname, '..', 'assets', 'stamps');
if (!fs.existsSync(STAMPS_DIR)) {
  fs.mkdirSync(STAMPS_DIR, { recursive: true });
}

function createStar(cx, cy, r, fill, points = 5) {
  let pts = [];
  const innerR = r * 0.42;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" />`;
}

// -------------------------------------------------------------
// 1. STAMP COMPLETED (Circle, Moss Green, Graduation Cap & Book)
// -------------------------------------------------------------
function getStampCompletedSvg() {
  const color = '#225d2a'; // Deep authentic moss green
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <path id="completed-top-arc" d="M 45 150 A 105 105 0 0 1 255 150" fill="none" />
    <filter id="ink-bleed-1" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>

  <g filter="url(#ink-bleed-1)">
    <!-- Outer dashed border -->
    <circle cx="150" cy="150" r="140" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="7 4" />
    <!-- Outer solid thin line -->
    <circle cx="150" cy="150" r="133" fill="none" stroke="${color}" stroke-width="1.2" />
    <!-- Inner solid main ring -->
    <circle cx="150" cy="150" r="118" fill="none" stroke="${color}" stroke-width="2.5" />
    
    <!-- Curved Header Text: TDS LEARNING PASSPORT -->
    <text fill="${color}" font-family="'Inter', 'Arial Black', -apple-system, sans-serif" font-size="13" font-weight="900" letter-spacing="3.5">
      <textPath href="#completed-top-arc" startOffset="50%" text-anchor="middle">
        ★ TDS LEARNING PASSPORT ★
      </textPath>
    </text>

    <!-- Center Graduation Cap & Tassel Icon -->
    <g transform="translate(150, 92)" stroke="${color}" fill="${color}">
      <polygon points="0,-16 38,0 0,14 -38,0" fill="${color}" fill-opacity="0.12" stroke-width="2.2" stroke-linejoin="round" />
      <path d="M -20,5 Q 0,16 20,5 L 20,13 Q 0,22 -20,13 Z" fill="${color}" fill-opacity="0.25" stroke-width="1.8" />
      <circle cx="0" cy="-1" r="2.5" fill="${color}" stroke="none" />
      <path d="M 0,-1 Q 26,4 32,15" fill="none" stroke-width="1.8" stroke-linecap="round" />
      <polygon points="30,14 34,14 35,24 29,24" fill="${color}" stroke="none" />
    </g>

    <!-- Middle Banner -->
    <g transform="translate(150, 138)">
      <rect x="-95" y="-13" width="190" height="26" rx="2" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2" />
      <line x1="-95" y1="-13" x2="-95" y2="13" stroke="${color}" stroke-width="3" />
      <line x1="95" y1="-13" x2="95" y2="13" stroke="${color}" stroke-width="3" />
      <text x="0" y="5.5" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', -apple-system, sans-serif" font-size="14.5" font-weight="900" letter-spacing="3.5" stroke="none">
        COMPLETED
      </text>
    </g>

    <!-- Sub-heading under banner -->
    <text x="150" y="164" text-anchor="middle" fill="${color}" font-family="-apple-system, sans-serif" font-size="8" font-weight="800" letter-spacing="2.5">
      SKILLS ATTESTATION
    </text>

    <!-- Clean Dynamic Date & Hours Clearance Area -->
    <g transform="translate(150, 200)">
      <line x1="-65" y1="-18" x2="65" y2="-18" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <circle cx="-68" cy="-18" r="1.8" fill="${color}" stroke="none" />
      <circle cx="68" cy="-18" r="1.8" fill="${color}" stroke="none" />
      
      <line x1="-65" y1="18" x2="65" y2="18" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <circle cx="-68" cy="18" r="1.8" fill="${color}" stroke="none" />
      <circle cx="68" cy="18" r="1.8" fill="${color}" stroke="none" />
    </g>

    <!-- Bottom Rim Text -->
    <text x="150" y="230" text-anchor="middle" fill="${color}" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800" letter-spacing="2">
      ★ VERIFIED TRAINING RECORD ★
    </text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 2. STAMP VERIFIED (Octagon / Schengen Style, Blue Ink, Shield)
// -------------------------------------------------------------
function getStampVerifiedSvg() {
  const color = '#0f3c8a'; // Deep official blue ink
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <filter id="ink-bleed-2" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>

  <g filter="url(#ink-bleed-2)">
    <!-- Outer Octagon -->
    <polygon points="90,14 210,14 286,90 286,210 210,286 90,286 14,210 14,90" 
      fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" />
    <!-- Inner Octagon Line -->
    <polygon points="94,22 206,22 278,94 278,206 206,278 94,278 22,206 22,94" 
      fill="none" stroke="${color}" stroke-width="1.2" stroke-linejoin="round" />

    <!-- Top Passport Header: SKILL VALIDATION (No Immigration) -->
    <g transform="translate(150, 52)">
      <text x="0" y="0" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="9.5" font-weight="900" letter-spacing="2.5">
        SKILL VALIDATION
      </text>
      <line x1="-70" y1="8" x2="70" y2="8" stroke="${color}" stroke-width="1" />
      ${createStar(-78, 7, 3, color)}
      ${createStar(78, 7, 3, color)}
    </g>

    <!-- Center Security Shield with Checkmark Icon -->
    <g transform="translate(150, 96)">
      <path d="M 0,-22 L 23,-11 C 23,10 13,25 0,31 C -13,25 -23,10 -23,-11 Z" 
        fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" />
      <polyline points="-11,3 -3,12 13,-6" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- Main Title Banner -->
    <g transform="translate(150, 146)">
      <rect x="-92" y="-13" width="184" height="26" rx="2" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2" />
      <text x="0" y="5.5" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="15" font-weight="900" letter-spacing="3.5">
        TDS VERIFIED
      </text>
    </g>

    <!-- Subtext: COMPETENCY: VERIFIED (No Security Clearance) -->
    <text x="150" y="172" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      COMPETENCY: VERIFIED
    </text>

    <!-- Clean Dynamic Date/Hours Area -->
    <g transform="translate(150, 206)">
      <line x1="-66" y1="-16" x2="66" y2="-16" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <line x1="-66" y1="18" x2="66" y2="18" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
    </g>

    <!-- Bottom Edge Stamp Code: TALENT DEVELOPMENT SYSTEM (No Border Control) -->
    <text x="150" y="244" text-anchor="middle" fill="${color}" font-family="'Inter', monospace" font-size="7.5" font-weight="800" letter-spacing="2">
      ★ TALENT &amp; DEVELOPMENT ★
    </text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 3. STAMP HOURS (Classic Oval, Antique Gold, Hourglass)
// -------------------------------------------------------------
function getStampHoursSvg() {
  const color = '#996300'; // Rich antique gold / ochre ink
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <path id="hours-top-arc" d="M 40 150 A 115 88 0 0 1 260 150" fill="none" />
    <filter id="ink-bleed-3" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>

  <g filter="url(#ink-bleed-3)">
    <!-- Outer Heavy Oval -->
    <ellipse cx="150" cy="150" rx="136" ry="106" fill="none" stroke="${color}" stroke-width="3" />
    <!-- Inner Dotted Oval -->
    <ellipse cx="150" cy="150" rx="127" ry="97" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 3" />
    <!-- Core Boundary Oval -->
    <ellipse cx="150" cy="150" rx="116" ry="86" fill="none" stroke="${color}" stroke-width="2" />

    <!-- Top Curved Text: CONTINUING EDUCATION CREDIT (No Visa) -->
    <text fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="10.5" font-weight="900" letter-spacing="2.8">
      <textPath href="#hours-top-arc" startOffset="50%" text-anchor="middle">
        ★ CONTINUING EDUCATION CREDIT ★
      </textPath>
    </text>

    <!-- Center Hourglass & Ornaments -->
    <g transform="translate(150, 102)">
      <line x1="-16" y1="-16" x2="16" y2="-16" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
      <line x1="-16" y1="16" x2="16" y2="16" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
      <path d="M -13,-16 C -13,-4 -3,-1 0,0 C 3,-1 13,-4 13,-16 Z" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.6" />
      <path d="M -13,16 C -13,4 -3,1 0,0 C 3,1 13,4 13,16 Z" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="1.6" />
      <circle cx="0" cy="4" r="1.3" fill="${color}" stroke="none" />
      <polygon points="-5,14 5,14 0,7" fill="${color}" stroke="none" />
      ${createStar(-32, 0, 3.5, color)}
      ${createStar(32, 0, 3.5, color)}
    </g>

    <!-- Main Title: LEARNING HOURS (No Visa) -->
    <g transform="translate(150, 138)">
      <rect x="-86" y="-12" width="172" height="24" rx="2" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.8" />
      <text x="0" y="5" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="14" font-weight="900" letter-spacing="3">
        LEARNING HOURS
      </text>
    </g>

    <!-- Subtitle -->
    <text x="150" y="162" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      ACCREDITED DURATION
    </text>

    <!-- Clean Dynamic Date/Hours Area -->
    <g transform="translate(150, 196)">
      <line x1="-60" y1="-14" x2="60" y2="-14" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <line x1="-60" y1="16" x2="60" y2="16" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
    </g>

    <!-- Bottom Footer Text: OFFICIALLY ACCREDITED (No Visa) -->
    <text x="150" y="222" text-anchor="middle" fill="${color}" font-family="'Inter', sans-serif" font-size="7.5" font-weight="800" letter-spacing="2">
      ★ OFFICIALLY ACCREDITED ★
    </text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 4. STAMP ACHIEVEMENT (Arch Dome Gate, Royal Purple, Trophy)
// -------------------------------------------------------------
function getStampAchievementSvg() {
  const color = '#621b96'; // Deep royal purple
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <path id="achieve-top-arc" d="M 50 120 A 100 100 0 0 1 250 120" fill="none" />
    <filter id="ink-bleed-4" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>

  <g filter="url(#ink-bleed-4)">
    <!-- Outer Arch Gate -->
    <path d="M 22,274 L 22,126 A 128 128 0 0 1 278,126 L 278,274 Z" 
      fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" />
    <!-- Inner Arch Gate Line -->
    <path d="M 32,266 L 32,128 A 118 118 0 0 1 268,128 L 268,266 Z" 
      fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="5 3" />
    <!-- Core Boundary Line -->
    <path d="M 40,258 L 40,132 A 110 110 0 0 1 260,132 L 260,258 Z" 
      fill="none" stroke="${color}" stroke-width="2" />

    <!-- Top Dome Curved Text -->
    <text fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="11.5" font-weight="900" letter-spacing="3.5">
      <textPath href="#achieve-top-arc" startOffset="50%" text-anchor="middle">
        ★ EXCELLENCE AWARD ★
      </textPath>
    </text>

    <!-- Center Trophy Cup -->
    <g transform="translate(150, 98)">
      <path d="M -16,-16 L 16,-16 C 16,3 8,13 0,15 C -8,13 -16,3 -16,-16 Z" 
        fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M -16,-10 C -25,-10 -25,2 -13,2" fill="none" stroke="${color}" stroke-width="1.6" />
      <path d="M 16,-10 C 25,-10 25,2 13,2" fill="none" stroke="${color}" stroke-width="1.6" />
      <line x1="0" y1="15" x2="0" y2="22" stroke="${color}" stroke-width="2" />
      <line x1="-11" y1="22" x2="11" y2="22" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
      ${createStar(0, -3, 4.5, color)}
    </g>

    <!-- Title Banner: DISTINCTION -->
    <g transform="translate(150, 142)">
      <rect x="-92" y="-12" width="184" height="24" rx="2" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.8" />
      <text x="0" y="5" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="12.2" font-weight="900" letter-spacing="2">
        DISTINCTION ENTRY
      </text>
    </g>

    <!-- Subtext: OUTSTANDING ACHIEVEMENT (No Pass) -->
    <text x="150" y="166" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      OUTSTANDING ACHIEVEMENT
    </text>

    <!-- Clean Dynamic Date/Hours Area -->
    <g transform="translate(150, 204)">
      <line x1="-66" y1="-16" x2="66" y2="-16" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <line x1="-66" y1="18" x2="66" y2="18" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
    </g>

    <!-- Bottom Footer -->
    <text x="150" y="244" text-anchor="middle" fill="${color}" font-family="'Inter', sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      ★ TDS ACADEMY HONORS ★
    </text>
  </g>
</svg>`;
}

// -------------------------------------------------------------
// 5. STAMP MASTERY (Scalloped 24-Star Rosette, Dark Slate, 3 Stars)
// -------------------------------------------------------------
function getStampMasterySvg() {
  const color = '#2b394a'; // Deep slate / iron ink
  
  const points = [];
  const numPoints = 24;
  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? 138 : 124;
    const angle = (i * Math.PI) / numPoints;
    points.push(`${(150 + r * Math.cos(angle)).toFixed(1)},${(150 + r * Math.sin(angle)).toFixed(1)}`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <path id="master-top-arc" d="M 45 150 A 105 105 0 0 1 255 150" fill="none" />
    <filter id="ink-bleed-5" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>

  <g filter="url(#ink-bleed-5)">
    <!-- 24-Point Scalloped Starburst -->
    <polygon points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" />
    <!-- Inner Concentric Rings -->
    <circle cx="150" cy="150" r="118" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
    <circle cx="150" cy="150" r="110" fill="none" stroke="${color}" stroke-width="2.2" />

    <!-- Top Curved Text -->
    <text fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="11" font-weight="900" letter-spacing="3">
      <textPath href="#master-top-arc" startOffset="50%" text-anchor="middle">
        ★ PROFESSIONAL COMPETENCY ★
      </textPath>
    </text>

    <!-- Center 3 Heraldic Stars -->
    <g transform="translate(150, 96)">
      ${createStar(-30, 5, 7, color)}
      ${createStar(0, -3, 10, color)}
      ${createStar(30, 5, 7, color)}
    </g>

    <!-- Main Title Banner -->
    <g transform="translate(150, 138)">
      <rect x="-90" y="-12" width="180" height="25" rx="2" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2" />
      <text x="0" y="5.5" text-anchor="middle" fill="${color}" font-family="'Inter', 'Arial Black', sans-serif" font-size="14.5" font-weight="900" letter-spacing="3.5">
        TDS MASTERED
      </text>
    </g>

    <!-- Subtitle -->
    <text x="150" y="164" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      OFFICIAL ATTESTATION SEAL
    </text>

    <!-- Clean Dynamic Date/Hours Area -->
    <g transform="translate(150, 200)">
      <line x1="-64" y1="-16" x2="64" y2="-16" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
      <line x1="-64" y1="18" x2="64" y2="18" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 2" />
    </g>

    <!-- Bottom Footer Text -->
    <text x="150" y="228" text-anchor="middle" fill="${color}" font-family="'Inter', sans-serif" font-size="8" font-weight="800" letter-spacing="2">
      ★ TDS MASTER RECORD ★
    </text>
  </g>
</svg>`;
}

const stampDefs = [
  { name: 'stamp-completed', getSvg: getStampCompletedSvg },
  { name: 'stamp-verified', getSvg: getStampVerifiedSvg },
  { name: 'stamp-hours', getSvg: getStampHoursSvg },
  { name: 'stamp-achievement', getSvg: getStampAchievementSvg },
  { name: 'stamp-mastery', getSvg: getStampMasterySvg },
];

for (const stamp of stampDefs) {
  const svgPath = path.join(STAMPS_DIR, `${stamp.name}.svg`);
  fs.writeFileSync(svgPath, stamp.getSvg(), 'utf-8');
  console.log(`[SVG Created] ${svgPath}`);
}

console.log('All 5 vector SVG stamps generated successfully.');
