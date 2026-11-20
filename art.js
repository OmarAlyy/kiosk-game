/* Placeholder customers drawn in code, each with 4 expressions (neutral, happy, surprised, sad).
   Temporary art for prototype A only: the point is to test the fun, not the look. */
"use strict";
const ART = (() => {
  const INK = "#3b2016";
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${vb.split(" ")[2]}" height="${vb.split(" ")[3]}"><g stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

  function face(expr, hx, hy) {
    const e = {
      neutral: `<circle cx="${hx - 12}" cy="${hy - 2}" r="4.5" fill="${INK}" stroke="none"/><circle cx="${hx + 12}" cy="${hy - 2}" r="4.5" fill="${INK}" stroke="none"/>
                <path d="M${hx - 9} ${hy + 14} Q${hx} ${hy + 20} ${hx + 9} ${hy + 14}" fill="none" stroke-width="4"/>`,
      happy: `<path d="M${hx - 18} ${hy} Q${hx - 12} ${hy - 9} ${hx - 6} ${hy}" fill="none" stroke-width="4.5"/><path d="M${hx + 6} ${hy} Q${hx + 12} ${hy - 9} ${hx + 18} ${hy}" fill="none" stroke-width="4.5"/>
              <path d="M${hx - 13} ${hy + 10} Q${hx} ${hy + 30} ${hx + 13} ${hy + 10} Z" fill="#7a2a24" stroke-width="4"/><circle cx="${hx - 22}" cy="${hy + 10}" r="5" fill="#f08a7a" stroke="none" opacity=".7"/><circle cx="${hx + 22}" cy="${hy + 10}" r="5" fill="#f08a7a" stroke="none" opacity=".7"/>`,
      surprised: `<circle cx="${hx - 12}" cy="${hy - 3}" r="8" fill="#fff" stroke-width="3.5"/><circle cx="${hx + 12}" cy="${hy - 3}" r="8" fill="#fff" stroke-width="3.5"/><circle cx="${hx - 12}" cy="${hy - 2}" r="3.8" fill="${INK}" stroke="none"/><circle cx="${hx + 12}" cy="${hy - 2}" r="3.8" fill="${INK}" stroke="none"/>
                  <ellipse cx="${hx}" cy="${hy + 17}" rx="6" ry="8" fill="#7a2a24" stroke-width="4"/>`,
      sad: `<circle cx="${hx - 12}" cy="${hy}" r="4.5" fill="${INK}" stroke="none"/><circle cx="${hx + 12}" cy="${hy}" r="4.5" fill="${INK}" stroke="none"/>
            <path d="M${hx - 20} ${hy - 9} L${hx - 7} ${hy - 14}" stroke-width="4"/><path d="M${hx + 20} ${hy - 9} L${hx + 7} ${hy - 14}" stroke-width="4"/>
            <path d="M${hx - 10} ${hy + 20} Q${hx} ${hy + 11} ${hx + 10} ${hy + 20}" fill="none" stroke-width="4"/>`,
    };
    return e[expr];
  }

  const people = {
    // طنط سعاد: a kind neighbour in a blue hijab
    suad: (x) => svg("0 0 150 310", `
      <path d="M30 160 Q75 132 120 160 L132 300 L18 300 Z" fill="#c8553d"/>
      <path d="M28 168 Q14 220 26 250" fill="none" stroke-width="16"/><path d="M28 168 Q14 220 26 250" fill="none" stroke="#c8553d" stroke-width="9"/>
      <path d="M122 168 Q136 220 124 250" fill="none" stroke-width="16"/><path d="M122 168 Q136 220 124 250" fill="none" stroke="#c8553d" stroke-width="9"/>
      <circle cx="26" cy="254" r="9" fill="#d9a074"/><circle cx="124" cy="254" r="9" fill="#d9a074"/>
      <path d="M26 92 Q20 30 75 26 Q130 30 124 92 L128 150 Q75 175 22 150 Z" fill="#5b8fd6"/>
      <ellipse cx="75" cy="90" rx="34" ry="38" fill="#d9a074"/>
      <path d="M40 72 Q75 46 110 72" fill="none" stroke="#5b8fd6" stroke-width="10"/>${face(x, 75, 92)}`),
    // عم شوقي: an old man with a moustache and a flat cap
    shawky: (x) => svg("0 0 150 310", `
      <rect x="45" y="225" width="24" height="75" rx="9" fill="#5a4a3a"/><rect x="81" y="225" width="24" height="75" rx="9" fill="#5a4a3a"/>
      <path d="M28 150 Q75 128 122 150 L126 236 Q75 248 24 236 Z" fill="#8a9a6a"/><path d="M60 140 L75 236 L90 140" fill="#e9e1cf"/>
      <path d="M28 158 Q14 200 22 236" fill="none" stroke-width="16"/><path d="M28 158 Q14 200 22 236" fill="none" stroke="#8a9a6a" stroke-width="9"/>
      <path d="M122 158 Q136 200 128 236" fill="none" stroke-width="16"/><path d="M122 158 Q136 200 128 236" fill="none" stroke="#8a9a6a" stroke-width="9"/>
      <circle cx="75" cy="88" r="38" fill="#c98d5e"/>
      <path d="M36 70 Q40 34 80 36 Q118 38 116 66 L36 72 Z" fill="#6b5a4a"/><path d="M30 70 H124" stroke-width="7"/>
      ${face(x, 75, 90)}
      <path d="M52 100 Q63 94 75 101 Q87 94 98 100 Q88 112 75 106 Q62 112 52 100Z" fill="#d8d2c6" stroke-width="3.5"/>`),
    // الكابتن: a sporty boy in a jersey and headband
    captain: (x) => svg("0 0 150 310", `
      <rect x="50" y="232" width="20" height="68" rx="8" fill="#c98d5e"/><rect x="80" y="232" width="20" height="68" rx="8" fill="#c98d5e"/>
      <rect x="44" y="210" width="62" height="40" rx="10" fill="#2c4a7a"/>
      <path d="M38 152 Q75 134 112 152 L114 222 Q75 232 36 222 Z" fill="#e2574c"/><text x="75" y="200" font-size="34" text-anchor="middle" fill="#fff" stroke="none" font-family="Arial" font-weight="bold">10</text>
      <path d="M38 160 Q22 190 30 214" fill="none" stroke-width="15"/><path d="M38 160 Q22 190 30 214" fill="none" stroke="#c98d5e" stroke-width="8"/>
      <path d="M112 160 Q128 190 120 214" fill="none" stroke-width="15"/><path d="M112 160 Q128 190 120 214" fill="none" stroke="#c98d5e" stroke-width="8"/>
      <circle cx="75" cy="98" r="36" fill="#c98d5e"/><path d="M40 86 Q42 54 75 54 Q108 54 110 86 Q96 66 75 68 Q54 66 40 86Z" fill="#2b1a12"/>
      <rect x="38" y="76" width="74" height="12" rx="6" fill="#f4b63c"/>
      <path d="M108 110 q6 10 0 14 q-6 -4 0 -14z" fill="#9fd3f0" stroke-width="2.5"/>${face(x, 75, 104)}`),
    // a family: mum and two kids, drawn together
    family: (x) => svg("0 0 260 310", `
      <path d="M95 160 Q130 136 165 160 L176 300 L84 300 Z" fill="#7a5aa0"/>
      <path d="M92 94 Q88 40 130 36 Q172 40 168 94 L170 152 Q130 172 90 152 Z" fill="#e2b04a"/>
      <ellipse cx="130" cy="96" rx="30" ry="34" fill="#c98d5e"/>${face(x, 130, 98)}
      <rect x="30" y="250" width="16" height="50" rx="6" fill="#4a5a7a"/><rect x="54" y="250" width="16" height="50" rx="6" fill="#4a5a7a"/>
      <path d="M22 196 Q50 182 78 196 L80 256 Q50 264 20 256 Z" fill="#3fa9a0"/><circle cx="50" cy="158" r="28" fill="#a86b43"/>
      <path d="M24 152 Q28 124 50 126 Q74 126 76 152 Q66 138 50 140 Q34 138 24 152Z" fill="#2b1a12"/>${face(x, 50, 162)}
      <rect x="196" y="250" width="16" height="50" rx="6" fill="#c8553d"/><rect x="220" y="250" width="16" height="50" rx="6" fill="#c8553d"/>
      <path d="M186 196 Q216 182 246 196 L248 256 Q216 264 184 256 Z" fill="#f08aa0"/><circle cx="216" cy="158" r="28" fill="#e0b48a"/>
      <path d="M188 160 Q186 126 216 126 Q246 126 244 160 Q238 138 216 140 Q194 138 188 160Z" fill="#5a3a22"/><circle cx="188" cy="170" r="9" fill="#5a3a22"/><circle cx="244" cy="170" r="9" fill="#5a3a22"/>${face(x, 216, 162)}`),
  };
  const PEOPLE = Object.keys(people);
  const EXPR = ["neutral", "happy", "surprised", "sad"];

  const props = {
    note5: svg("0 0 120 64", `<rect x="4" y="4" width="112" height="56" rx="8" fill="#8cc68a"/><rect x="14" y="13" width="92" height="38" rx="6" fill="none" stroke="#4f8a4a" stroke-width="3"/><circle cx="60" cy="32" r="15" fill="#cfe8c8" stroke-width="3"/><text x="60" y="42" font-size="26" text-anchor="middle" fill="${INK}" stroke="none" font-family="Arial" font-weight="bold">٥</text>`),
    iceBox: svg("0 0 220 190", `<rect x="10" y="40" width="200" height="140" rx="18" fill="#5bb6e6"/><rect x="10" y="22" width="200" height="40" rx="14" fill="#e8f6fd"/><rect x="84" y="30" width="52" height="16" rx="8" fill="#3b8fc0" stroke-width="3"/>
      <text x="110" y="132" font-size="58" text-anchor="middle" fill="#fff" stroke="none">❄</text><path d="M30 70 V160" stroke="#9ad6f5" stroke-width="7"/>`),
    coldCup: svg("0 0 60 80", `<path d="M6 8 H54 L46 74 Q30 78 14 74 Z" fill="#e8f6fd"/><path d="M10 22 H50 L45 70 Q30 74 15 70 Z" fill="#f6c93c"/><rect x="16" y="26" width="12" height="12" rx="3" fill="#ffffff" stroke-width="2.5" opacity=".9"/><rect x="30" y="34" width="12" height="12" rx="3" fill="#ffffff" stroke-width="2.5" opacity=".9"/><path d="M6 8 H54 L46 74 Q30 78 14 74 Z" fill="none"/><path d="M50 14 l6 -6 M54 22 l7 -2" stroke="#9ad6f5" stroke-width="3"/>`),
    fish: svg("0 0 90 50", `<path d="M10 25 Q35 2 62 25 Q35 48 10 25Z" fill="#f0a878"/><path d="M62 25 L84 10 L80 25 L84 40 Z" fill="#f0a878"/><circle cx="25" cy="21" r="3.5" fill="${INK}" stroke="none"/>`),
    heart: svg("0 0 40 36", `<path d="M20 34 Q2 20 4 10 Q8 0 20 8 Q32 0 36 10 Q38 20 20 34Z" fill="#ef5b6b" stroke-width="3"/>`),
    star: svg("0 0 40 40", `<path d="M20 2 L25 15 L38 15 L27 23 L31 37 L20 29 L9 37 L13 23 L2 15 L15 15 Z" fill="#ffd34d" stroke-width="3"/>`),
  };
  const url = s => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s)));
  return { people, PEOPLE, EXPR, props, url };
})();
