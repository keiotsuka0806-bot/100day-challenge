/* 効果音＋BGM
   - 初回のユーザー操作で AudioContext を起動（ブラウザの自動再生制限対応）
   - BGM本編は音源ファイル（assets/audio/bgm.mp3）のループ再生。
     読み込めない場合はオルゴール風の生成ループにフォールバック。ミュートは localStorage に保存 */
const BGM_FILE = "assets/audio/bgm.mp3";
const LS_KEY = "vinroute_sound";
let ctx = null, master = null, bgmGain = null, sfxGain = null;
let enabled = localStorage.getItem(LS_KEY) !== "off";
let bgmTimer = null, bgmBeat = 0, bgmNextTime = 0;
let bgmEl = null, bgmStarted = false;

function ensureCtx() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.14; bgmGain.connect(master);
  return true;
}

/* 初回ジェスチャーで起動（index側から一度呼ぶ） */
export function armSoundOnGesture() {
  const boot = () => {
    if (ensureCtx()) { ctx.resume(); startBgm(); }
    removeEventListener("pointerdown", boot);
    removeEventListener("keydown", boot);
  };
  addEventListener("pointerdown", boot);
  addEventListener("keydown", boot);
}

export function soundEnabled() { return enabled; }
export function toggleSound() {
  enabled = !enabled;
  localStorage.setItem(LS_KEY, enabled ? "on" : "off");
  if (ctx && master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
  return enabled;
}

/* ===== 音の素 ===== */
function tone(freq, dur, { type = "sine", vol = 0.2, at = 0, slide = 0, decay } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gn.gain.setValueAtTime(0, t0);
  gn.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
  o.connect(gn); gn.connect(sfxGain);
  o.start(t0); o.stop(t0 + (decay ?? dur) + 0.05);
}
function noise(dur, { vol = 0.15, at = 0, lp = 800 } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + at;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp;
  const gn = ctx.createGain(); gn.gain.value = vol;
  src.connect(f); f.connect(gn); gn.connect(sfxGain);
  src.start(t0);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* ===== 効果音 ===== */
export const sfx = {
  click()   { tone(660, 0.05, { type: "sine", vol: 0.10 }); },
  tick()    { tone(2100, 0.02, { type: "square", vol: 0.035 }); },
  hop()     { tone(430 + Math.random() * 90, 0.07, { type: "triangle", vol: 0.10, slide: 190 }); },
  land()    { noise(0.09, { vol: 0.10, lp: 420 }); },
  coin()    { tone(988, 0.07, { vol: 0.16 }); tone(1319, 0.16, { vol: 0.16, at: 0.07 }); },
  claim()   { [1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, { vol: 0.14, at: i * 0.07 })); },
  build()   { tone(170, 0.1, { type: "triangle", vol: 0.22 }); noise(0.07, { vol: 0.12, lp: 900, at: 0.02 }); },
  quizOk()  { [1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, { vol: 0.15, at: i * 0.08 })); },
  quizNg()  { tone(220, 0.24, { type: "sawtooth", vol: 0.08, slide: -40 }); },
  critic()  { tone(233, 0.5, { type: "sawtooth", vol: 0.07 }); tone(220, 0.5, { type: "sawtooth", vol: 0.07 }); },
  card()    { noise(0.16, { vol: 0.08, lp: 2400 }); tone(880, 0.1, { vol: 0.1, at: 0.1, slide: 300 }); },
  chime()   { tone(1568, 0.3, { vol: 0.1 }); tone(2093, 0.5, { vol: 0.08, at: 0.12 }); },
  bell()    { // 街の教会の鐘（低いゴーン×2）
    [0, 0.55].forEach(at => {
      tone(392, 1.6, { vol: 0.09, at, decay: 1.6 });
      tone(587, 1.2, { vol: 0.05, at, decay: 1.2 });
      tone(988, 0.5, { vol: 0.025, at, decay: 0.5 });
    });
  },
  birds()   { // 小鳥のさえずり（環境音）
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      tone(2300 + Math.random() * 900, 0.09, { type: "sine", vol: 0.022, at: i * 0.14 + Math.random() * 0.05, slide: 500 - Math.random() * 1200 });
    }
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.16, at: i * 0.11 }));
    [523, 659, 784].forEach(f => tone(f, 0.7, { vol: 0.07, at: 0.44, decay: 0.9 }));
  },
};

/* ===== BGM（オルゴール風ワルツ・8小節ループ） ===== */
const BPM = 92, BEAT = 60 / BPM;
/* [拍, MIDIノート, 長さ(拍)]。C durのやさしい3拍子 */
const MELODY = [
  [0, 76, 1], [1, 79, 1], [2, 84, 1],
  [3, 83, 1], [4, 79, 1], [5, 76, 1],
  [6, 81, 1], [7, 84, 1], [8, 88, 1],
  [9, 86, 1], [10, 83, 1], [11, 79, 1],
  [12, 84, 1], [13, 88, 1], [14, 91, 1],
  [15, 89, 1], [16, 88, 1], [17, 86, 1],
  [18, 88, 1], [19, 84, 1], [20, 81, 1],
  [21, 79, 2.6],
];
const BASS = [[0, 48], [3, 43], [6, 45], [9, 43], [12, 48], [15, 41], [18, 45], [21, 43]];
const LOOP_BEATS = 24;

function bgmNote(midi, tAbs, durBeats, vol, isBass) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = isBass ? "sine" : "triangle";
  o.frequency.value = mtof(midi);
  const dur = durBeats * BEAT;
  gn.gain.setValueAtTime(0, tAbs);
  gn.gain.linearRampToValueAtTime(vol, tAbs + 0.015);
  gn.gain.exponentialRampToValueAtTime(0.0001, tAbs + dur * 1.6);
  o.connect(gn); gn.connect(bgmGain);
  o.start(tAbs); o.stop(tAbs + dur * 1.6 + 0.1);
  if (!isBass) { // オルゴールの倍音（1オクターブ上を薄く）
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = "sine"; o2.frequency.value = mtof(midi + 12);
    g2.gain.setValueAtTime(0, tAbs);
    g2.gain.linearRampToValueAtTime(vol * 0.3, tAbs + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, tAbs + dur * 1.2);
    o2.connect(g2); g2.connect(bgmGain);
    o2.start(tAbs); o2.stop(tAbs + dur * 1.2 + 0.1);
  }
}

/* BGM本編：mp3ループ。ゲインは bgmGain 経由なのでミュートトグルがそのまま効く */
function startBgm() {
  if (bgmStarted || !ctx) return;
  bgmStarted = true;
  const el = new Audio(BGM_FILE);
  el.loop = true;
  el.preload = "auto";
  let wired = false;
  try {
    ctx.createMediaElementSource(el).connect(bgmGain);
    wired = true;
    bgmGain.gain.value = 0.5; // 楽曲用の音量（合成音より上げる）
  } catch {}
  if (!wired) el.volume = 0.35; // WebAudioに繋げない環境は素の音量で
  const fallback = () => { bgmEl = null; bgmGain.gain.value = 0.14; startSynthBgm(); };
  el.addEventListener("error", fallback, { once: true });
  el.play().then(() => { bgmEl = el; window.__bgm = el; }).catch(fallback);
  startAmbience();
}

/* 環境音：ときどき小鳥がさえずる（旅の空気感） */
let ambTimer = null;
function startAmbience() {
  if (ambTimer) return;
  ambTimer = setInterval(() => {
    if (ctx && enabled && Math.random() < 0.5) sfx.birds();
  }, 11000);
}

function startSynthBgm() {
  if (bgmTimer || !ctx) return;
  bgmBeat = 0;
  bgmNextTime = ctx.currentTime + 0.3;
  bgmTimer = setInterval(() => {
    /* 1拍ずつ、0.5秒先まで予約するルックアヘッド方式 */
    while (bgmNextTime < ctx.currentTime + 0.5) {
      const b = bgmBeat % LOOP_BEATS;
      MELODY.filter(n => n[0] === b).forEach(n => bgmNote(n[1], bgmNextTime, n[2], 0.16, false));
      BASS.filter(n => n[0] === b).forEach(n => bgmNote(n[1], bgmNextTime, 2.4, 0.10, true));
      bgmBeat++;
      bgmNextTime += BEAT;
    }
  }, 150);
}
