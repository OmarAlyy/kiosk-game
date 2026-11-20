/* Props drawn in the same flat style as our characters: thick dark-brown outline, flat colour, one soft shade at most.
   Each is an SVG string turned into a texture. */
"use strict";
const PROPS = (() => {
  const INK = "#3b2016";
  const s = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
  const p = {
    counterTop: s(760, 90, `<rect x="-6" y="6" width="772" height="70" rx="16" fill="#e3a46a"/><path d="M-6 58 H766" stroke="#b9743c" stroke-width="5"/><path d="M60 26 H200 M420 22 H560" stroke="#efbb85" stroke-width="5"/>`),
    counterFront: s(760, 360, `<rect x="-6" y="0" width="772" height="380" fill="#c9824a"/><path d="M-6 92 H766 M-6 184 H766 M-6 276 H766" stroke="#a9653a" stroke-width="4"/>
      <path d="M120 0 V380 M380 0 V380 M640 0 V380" stroke="#a9653a" stroke-width="3" opacity=".55"/>`),
    jug: s(150, 180, `<path d="M28 34 Q28 16 46 16 H98 Q116 16 116 34 L124 160 Q74 176 18 160 Z" fill="#e8f6fd"/>
      <path d="M24 70 H120 L124 158 Q74 172 19 158 Z" fill="#f6c93c"/><circle cx="58" cy="112" r="14" fill="#ffe56b" stroke-width="4"/><circle cx="88" cy="132" r="10" fill="#ffe56b" stroke-width="4"/>
      <path d="M116 44 Q146 54 142 98 Q138 126 122 126" fill="none" stroke-width="9"/><path d="M28 34 Q28 16 46 16 H98 Q116 16 116 34 L124 160 Q74 176 18 160 Z" fill="none"/>
      <path d="M40 30 Q38 60 42 120" stroke="#fff" stroke-width="5" opacity=".7"/>`),
    iceBox: s(200, 150, `<rect x="8" y="40" width="184" height="102" rx="18" fill="#5bb6e6"/><rect x="18" y="52" width="20" height="78" rx="8" fill="#8fd0f2" stroke="none"/>
      <path d="M100 66 V118 M78 79 L122 105 M122 79 L78 105" stroke="#fff" stroke-width="8"/>`),
    iceLid: s(200, 50, `<rect x="6" y="8" width="188" height="36" rx="13" fill="#e8f6fd"/><rect x="72" y="14" width="56" height="14" rx="7" fill="#3b8fc0" stroke-width="3"/>`),
    cupBack: s(90, 120, `<path d="M8 12 H82 L70 108 Q45 114 20 108 Z" fill="#fffaf0"/>`),
    cupFront: s(90, 120, `<path d="M8 12 H82 L70 108 Q45 114 20 108 Z" fill="none"/><path d="M18 22 Q16 60 22 100" stroke="#fff" stroke-width="5" opacity=".75"/>`),
    juice: s(90, 120, `<path d="M11 12 H79 L67.5 106 Q45 111 22.5 106 Z" fill="#f6c93c" stroke="none"/>`),
    cube: s(34, 34, `<rect x="4" y="4" width="26" height="26" rx="6" fill="#ffffff" stroke-width="4"/><path d="M10 10 L16 10" stroke="#bfe6f8" stroke-width="4"/>`),
    coin: s(64, 64, `<circle cx="32" cy="32" r="27" fill="#d49a2a"/><circle cx="32" cy="29" r="21" fill="#f6c443" stroke="none"/><circle cx="32" cy="29" r="12" fill="none" stroke="#c98a24" stroke-width="3.5"/>`),
    note5: s(150, 82, `<rect x="5" y="5" width="140" height="72" rx="10" fill="#8cc68a"/><rect x="17" y="16" width="116" height="50" rx="7" fill="none" stroke="#4f8a4a" stroke-width="4"/><circle cx="75" cy="41" r="20" fill="#cfe8c8" stroke-width="4"/>`),
    piggy: s(170, 140, `<ellipse cx="86" cy="80" rx="70" ry="52" fill="#f4a3b4"/><circle cx="150" cy="70" r="20" fill="#f4a3b4"/><ellipse cx="160" cy="72" rx="9" ry="7" fill="#e07b92" stroke-width="4"/>
      <path d="M52 126 v10 M110 126 v10" stroke-width="12"/><path d="M60 36 Q66 22 78 30" fill="#f4a3b4"/><circle cx="132" cy="58" r="5" fill="${INK}" stroke="none"/>
      <rect x="68" y="30" width="40" height="9" rx="4" fill="${INK}" stroke="none"/><path d="M18 76 Q2 72 8 60" fill="none" stroke-width="5"/>`),
    tray: s(250, 120, `<rect x="6" y="10" width="238" height="104" rx="24" fill="#6b4630"/><rect x="20" y="22" width="210" height="80" rx="16" fill="#5a3a26" stroke="none"/>`),
    dish: s(230, 90, `<ellipse cx="115" cy="50" rx="104" ry="34" fill="#e8dcc6"/><ellipse cx="115" cy="44" rx="80" ry="22" fill="#f5ecdc" stroke-width="4"/>`),
    star: s(48, 48, `<path d="M24 3 L30 18 L45 18 L33 28 L38 44 L24 35 L10 44 L15 28 L3 18 L18 18 Z" fill="#ffd34d" stroke-width="4"/>`),
    heart: s(48, 44, `<path d="M24 41 Q3 25 5 12 Q9 1 24 10 Q39 1 43 12 Q45 25 24 41Z" fill="#ef5b6b" stroke-width="4"/>`),
    drop: s(24, 30, `<path d="M12 3 Q22 16 21 21 Q19 28 12 28 Q5 28 3 21 Q2 16 12 3Z" fill="#9fd3f0" stroke-width="3"/>`),
    snow: s(40, 40, `<path d="M20 4 V36 M6 12 L34 28 M34 12 L6 28" stroke="#ffffff" stroke-width="5"/>`),
  };
  const url = svg => "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  return { p, url };
})();
