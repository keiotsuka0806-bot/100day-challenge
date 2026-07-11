/* 2Dちびアバター（どう森風・プロトタイプ移植）。国非依存 */
export const PALETTE = [
  { id: 0, name: "ロザリー",   desc: "陽気なソムリエ",   skin: "#fad2ad", hair: "#d65a4a", cloth: "#e8746b", accent: "#fff1d8", face: "sommelier" },
  { id: 1, name: "ヴィクトル", desc: "無口な醸造家",     skin: "#f0c098", hair: "#5a4334", cloth: "#5a86c2", accent: "#7a5a3c", face: "winemaker" },
  { id: 2, name: "アメリ",     desc: "若手バイヤー",     skin: "#fbd9bd", hair: "#8aa4c8", cloth: "#5cb672", accent: "#37506b", face: "buyer" },
  { id: 3, name: "バジル",     desc: "放浪の評論家",     skin: "#e6b088", hair: "#e2e2e2", cloth: "#7a6a90", accent: "#cda33f", face: "critic" },
  { id: 4, name: "クレア",     desc: "畑の管理人",       skin: "#f7c79e", hair: "#e07b2e", cloth: "#b06fd6", accent: "#7a9ad0", face: "farmer" },
  { id: 5, name: "ティモ",     desc: "樽職人見習い",     skin: "#eeb085", hair: "#6a5038", cloth: "#ea8c3e", accent: "#caa05a", face: "cooper" },
];
const OUT = "#43342a";

function hairBack(a) {
  switch (a.face) {
    case "sommelier": return `<path d="M20 34 q-6 30 4 44 q-4 -24 4 -42Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2"/><path d="M60 34 q6 30 -4 44 q4 -24 -4 -42Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2"/>`;
    case "farmer": return `<path d="M22 36 q-5 22 3 34 q-3 -20 2 -34Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2"/><path d="M58 36 q5 22 -3 34 q3 -20 -2 -34Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2"/>`;
    default: return ``;
  }
}
function hairFront(a) {
  switch (a.face) {
    case "sommelier": return `<path d="M19 36 q1 -22 21 -22 q20 0 21 22 q-7 -9 -21 -9 q-14 0 -21 9Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    case "winemaker": return `<path d="M19 36 q-1 -23 21 -23 q22 0 21 23 q-4 -10 -9 -11 l-2 7 l-3 -7 l-2 7 l-3 -7 l-2 7 l-3 -7 q-7 1 -13 11Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    case "buyer": return `<path d="M19 35 q0 -22 21 -22 q21 0 21 22 q-7 -10 -16 -10 q-3 6 -9 7 q-3 -1 -5 0 q-6 -1 -12 3Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    case "critic": return `<path d="M19 33 q2 -20 21 -20 q19 0 21 20 q-10 -7 -21 -6 q-11 -1 -21 6Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    case "farmer": return `<path d="M19 36 q0 -22 21 -22 q21 0 21 22 q-6 -10 -15 -10 l-3 6 l-3 -6 q-14 0 -21 10Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    case "cooper": return `<path d="M19 37 q0 -24 21 -24 q21 0 21 24 q-7 -12 -21 -12 q-14 0 -21 12Z" fill="${a.hair}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
  }
}
function features(a) {
  const eyes = `<ellipse cx="31" cy="40" rx="3.2" ry="4" fill="#3a2a22"/><circle cx="32.2" cy="38.6" r="1.1" fill="#fff"/>
  <ellipse cx="49" cy="40" rx="3.2" ry="4" fill="#3a2a22"/><circle cx="50.2" cy="38.6" r="1.1" fill="#fff"/>`;
  const blush = `<ellipse cx="24" cy="46" rx="3.6" ry="2.4" fill="#f5a89a" opacity=".75"/><ellipse cx="56" cy="46" rx="3.6" ry="2.4" fill="#f5a89a" opacity=".75"/>`;
  switch (a.face) {
    case "sommelier": return `${eyes}${blush}<path d="M35 47 q5 5 10 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "winemaker": return `${eyes}<path d="M27 35 q4 -1.5 7 0 M46 35 q4 -1.5 7 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M37 48 h6" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/><path d="M33 33 q-2 5 1 8 M47 33 q2 5 -1 8" stroke="${a.hair}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case "buyer": return `<circle cx="31" cy="40" r="5.4" fill="#fff" stroke="${OUT}" stroke-width="1.8"/><circle cx="49" cy="40" r="5.4" fill="#fff" stroke="${OUT}" stroke-width="1.8"/><path d="M36.4 40 h7.2" stroke="${OUT}" stroke-width="1.8"/><ellipse cx="31" cy="40.4" rx="2.4" ry="3" fill="#3a2a22"/><ellipse cx="49" cy="40.4" rx="2.4" ry="3" fill="#3a2a22"/><path d="M34 48 q6 5 12 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "critic": return `<ellipse cx="31" cy="40" rx="3" ry="3.8" fill="#3a2a22"/><circle cx="49" cy="40" r="6" fill="rgba(255,255,255,.3)" stroke="${a.accent}" stroke-width="2"/><ellipse cx="49" cy="40" rx="3" ry="3.8" fill="#3a2a22"/><path d="M49 46 l2 7" stroke="${a.accent}" stroke-width="1.6"/><path d="M26 34 l8 2 M54 34 l-8 2" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/><path d="M36 49 q5 -2 9 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "farmer": return `${eyes}<circle cx="26" cy="46" r="0.9" fill="#cf9266"/><circle cx="29" cy="48" r="0.9" fill="#cf9266"/><circle cx="51" cy="46" r="0.9" fill="#cf9266"/><circle cx="54" cy="48" r="0.9" fill="#cf9266"/><path d="M34 47 q6 6 12 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "cooper": return `${eyes}<path d="M27 35 q4 -1 7 1 M46 36 q4 -2 7 -1" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M34 47 q6 6 12 0 q-6 2 -12 0Z" fill="#fff" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
  }
}
function headwear(a) {
  switch (a.face) {
    case "farmer": return `<ellipse cx="40" cy="18" rx="27" ry="7.5" fill="#e6c873" stroke="${OUT}" stroke-width="2"/><path d="M26 16 q14 -12 28 0 q-2 -2 -14 -2 q-12 0 -14 2Z" fill="#ecd488" stroke="${OUT}" stroke-width="2"/><path d="M24 17 h32" stroke="#c2a24e" stroke-width="2.5"/>`;
    case "cooper": return `<path d="M18 22 q22 -11 44 0 l0 3 q-22 -7 -44 0Z" fill="#cf4436" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
    default: return ``;
  }
}
function bodyParts(a) {
  const legs = `<rect x="31" y="92" width="7" height="13" rx="3.5" fill="${a.skin}" stroke="${OUT}" stroke-width="2"/><rect x="42" y="92" width="7" height="13" rx="3.5" fill="${a.skin}" stroke="${OUT}" stroke-width="2"/>
  <ellipse cx="33" cy="106" rx="6" ry="3.5" fill="#5a4632" stroke="${OUT}" stroke-width="2"/><ellipse cx="47" cy="106" rx="6" ry="3.5" fill="#5a4632" stroke="${OUT}" stroke-width="2"/>`;
  const arms = `<rect x="17" y="74" width="7" height="16" rx="3.5" fill="${a.cloth}" stroke="${OUT}" stroke-width="2"/><circle cx="20.5" cy="91" r="4" fill="${a.skin}" stroke="${OUT}" stroke-width="2"/>
  <rect x="56" y="74" width="7" height="16" rx="3.5" fill="${a.cloth}" stroke="${OUT}" stroke-width="2"/><circle cx="59.5" cy="91" r="4" fill="${a.skin}" stroke="${OUT}" stroke-width="2"/>`;
  const torso = `<path d="M23 78 q0 -12 17 -12 q17 0 17 12 l1 18 q-18 6 -36 0Z" fill="${a.cloth}" stroke="${OUT}" stroke-width="2" stroke-linejoin="round"/>`;
  let ex = "";
  switch (a.face) {
    case "sommelier": ex = `<rect x="31" y="70" width="18" height="26" rx="4" fill="#3a3a3a" stroke="${OUT}" stroke-width="1.8"/><path d="M36 69 l4 3.5 l4 -3.5 l-1.5 5 h-5Z" fill="#7a1f3d" stroke="${OUT}" stroke-width="1.3"/>`; break;
    case "winemaker": ex = `<path d="M23 84 q17 6 34 0 l1 12 q-18 6 -36 0Z" fill="${a.accent}" stroke="${OUT}" stroke-width="1.8"/><rect x="31" y="66" width="3.5" height="18" fill="${a.accent}"/><rect x="45" y="66" width="3.5" height="18" fill="${a.accent}"/>`; break;
    case "buyer": ex = `<path d="M40 66 l-4 6 h8Z" fill="#fff" stroke="${OUT}" stroke-width="1.3"/><rect x="38.3" y="70" width="3.4" height="18" fill="${a.accent}"/>`; break;
    case "critic": ex = `<path d="M33 67 l7 9 l-5 0Z" fill="#5a4a6a" stroke="${OUT}" stroke-width="1.3"/><path d="M47 67 l-7 9 l5 0Z" fill="#5a4a6a" stroke="${OUT}" stroke-width="1.3"/><rect x="38" y="67" width="4" height="28" fill="#4a3a5a"/>`; break;
    case "farmer": ex = `<path d="M23 82 q17 6 34 0 l1 14 q-18 6 -36 0Z" fill="${a.accent}" stroke="${OUT}" stroke-width="1.8"/><rect x="31" y="66" width="3.5" height="17" fill="${a.accent}"/><rect x="45" y="66" width="3.5" height="17" fill="${a.accent}"/><rect x="34" y="85" width="12" height="7" rx="2" fill="#5a78ab" stroke="${OUT}" stroke-width="1.3"/>`; break;
    case "cooper": ex = `<path d="M32 70 h16 l-1.5 26 h-13Z" fill="#8a5a32" stroke="${OUT}" stroke-width="1.8"/><path d="M35 70 l5 -4 l5 4Z" fill="#6a4424" stroke="${OUT}" stroke-width="1.3"/>`; break;
  }
  return legs + arms + torso + ex;
}

export function avatarSVG(a, size = 104) {
  return `<svg width="${size * 0.82}" height="${size}" viewBox="0 0 80 114">
  <ellipse cx="40" cy="110" rx="19" ry="3.5" fill="rgba(0,0,0,.12)"/>
  ${hairBack(a)}
  ${bodyParts(a)}
  <rect x="35" y="58" width="10" height="11" rx="4" fill="${a.skin}" stroke="${OUT}" stroke-width="2"/>
  <ellipse cx="40" cy="40" rx="24" ry="23" fill="${a.skin}" stroke="${OUT}" stroke-width="2.2"/>
  <path d="M18 41 q-3.5 0 -3.5 3.5 q0 3.5 3.5 3.5Z" fill="${a.skin}" stroke="${OUT}" stroke-width="1.8"/>
  <path d="M62 41 q3.5 0 3.5 3.5 q0 3.5 -3.5 3.5Z" fill="${a.skin}" stroke="${OUT}" stroke-width="1.8"/>
  ${hairFront(a)}
  ${features(a)}
  ${headwear(a)}
 </svg>`;
}
