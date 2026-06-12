// ShortsStudio — 音源+画像+字幕 → 縦動画(1080x1920 MP4)をブラウザ内で生成
// FFmpeg.wasm v0.11 シングルスレッド構成(SharedArrayBuffer不要 = 追加ヘッダーなしでホスティング可)

const W = 1080, H = 1920;

const state = {
  audioFile: null,
  audioDuration: 0,
  imageBitmap: null,
  bgBlob: null,          // 1080x1920に整形済みの背景PNG
  subs: [],              // {id, text, start, end}
  nextId: 1,
};

const $ = (id) => document.getElementById(id);
const audioEl = $('audioEl');

/* ---------- Step 1: 音源 ---------- */

function setupDrop(zoneId, inputId, onFile) {
  const zone = $(zoneId), input = $(inputId);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });
}

setupDrop('audioDrop', 'audioInput', (file) => {
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) {
    alert('音声ファイルを選んでください'); return;
  }
  state.audioFile = file;
  audioEl.src = URL.createObjectURL(file);
  audioEl.addEventListener('loadedmetadata', () => {
    state.audioDuration = audioEl.duration;
    $('audioInfo').textContent = `🎵 ${file.name}(${fmtTime(audioEl.duration)} / ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    $('audioInfo').classList.remove('hidden');
    $('seekBar').max = audioEl.duration;
    updateTimeDisplay();
    maybeShowEditor();
  }, { once: true });
});

/* ---------- Step 2: 背景画像 ---------- */

setupDrop('imageDrop', 'imageInput', async (file) => {
  if (!file.type.startsWith('image/')) { alert('画像ファイルを選んでください'); return; }
  const bmp = await createImageBitmap(file);
  state.imageBitmap = bmp;

  // 1080x1920 にカバートリミングして背景PNG化
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const dw = bmp.width * scale, dh = bmp.height * scale;
  ctx.drawImage(bmp, (W - dw) / 2, (H - dh) / 2, dw, dh);
  state.bgBlob = await new Promise((r) => c.toBlob(r, 'image/png'));

  const url = URL.createObjectURL(state.bgBlob);
  $('preview').style.backgroundImage = `url(${url})`;
  $('imageLabel').innerHTML = `🖼 ${file.name} 設定済み<br><small>タップで変更</small>`;
  maybeShowEditor();
});

function maybeShowEditor() {
  if (state.audioFile && state.bgBlob) {
    $('editorCard').classList.remove('hidden');
    $('exportCard').classList.remove('hidden');
    if (state.subs.length === 0) addSub(0, Math.min(3.5, state.audioDuration || 3.5), 'ここに歌詞やメッセージ');
  }
}

/* ---------- Step 3: プレビュー & 字幕エディタ ---------- */

$('playBtn').addEventListener('click', () => {
  if (audioEl.paused) { audioEl.play(); $('playBtn').textContent = '⏸ 停止'; }
  else { audioEl.pause(); $('playBtn').textContent = '▶ 再生'; }
});
audioEl.addEventListener('ended', () => { $('playBtn').textContent = '▶ 再生'; });
audioEl.addEventListener('timeupdate', () => { $('seekBar').value = audioEl.currentTime; updateTimeDisplay(); renderPreviewSub(); });
$('seekBar').addEventListener('input', () => { audioEl.currentTime = parseFloat($('seekBar').value); updateTimeDisplay(); renderPreviewSub(); });
$('fontSize').addEventListener('change', renderPreviewSub);
$('subPos').addEventListener('change', renderPreviewSub);

function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
}
function updateTimeDisplay() {
  $('timeDisplay').textContent = `${fmtTime(audioEl.currentTime)} / ${fmtTime(state.audioDuration)}`;
}

function renderPreviewSub() {
  const t = audioEl.currentTime;
  const active = state.subs.find((s) => t >= s.start && t <= s.end);
  const el = $('previewSub');
  el.textContent = active ? active.text : '';
  el.className = 'preview-sub pos-' + $('subPos').value;
  // プレビューは実寸の240/1080倍
  el.style.fontSize = (parseInt($('fontSize').value, 10) * 240 / W) + 'px';
  document.querySelectorAll('.sub-row').forEach((row) => {
    row.classList.toggle('active', active && row.dataset.id == active.id);
  });
}

function addSub(start, end, text) {
  state.subs.push({ id: state.nextId++, text: text || '', start: round1(start), end: round1(end) });
  renderSubList();
}
function round1(n) { return Math.round(n * 10) / 10; }

$('addSubBtn').addEventListener('click', () => {
  const t = round1(audioEl.currentTime);
  addSub(t, round1(Math.min(t + 3.5, state.audioDuration || t + 3.5)), '');
  const rows = document.querySelectorAll('.sub-row input[type="text"]');
  if (rows.length) rows[rows.length - 1].focus();
});

function renderSubList() {
  state.subs.sort((a, b) => a.start - b.start);
  const list = $('subList');
  list.innerHTML = '';
  for (const sub of state.subs) {
    const row = document.createElement('div');
    row.className = 'sub-row';
    row.dataset.id = sub.id;
    row.innerHTML = `
      <input type="text" placeholder="字幕テキスト(改行は / で)" value="">
      <div class="sub-times">
        <input type="number" class="t-start" min="0" step="0.1" value="${sub.start}">
        <button class="btn-tiny set-start">⏱開始=今</button>
        →
        <input type="number" class="t-end" min="0" step="0.1" value="${sub.end}">
        <button class="btn-tiny set-end">⏱終了=今</button>
        <button class="btn-tiny btn-del">🗑</button>
      </div>`;
    const textInput = row.querySelector('input[type="text"]');
    textInput.value = sub.text;
    textInput.addEventListener('input', () => { sub.text = textInput.value; renderPreviewSub(); });
    row.querySelector('.t-start').addEventListener('change', (e) => { sub.start = parseFloat(e.target.value) || 0; renderPreviewSub(); });
    row.querySelector('.t-end').addEventListener('change', (e) => { sub.end = parseFloat(e.target.value) || 0; renderPreviewSub(); });
    row.querySelector('.set-start').addEventListener('click', () => { sub.start = round1(audioEl.currentTime); row.querySelector('.t-start').value = sub.start; renderPreviewSub(); });
    row.querySelector('.set-end').addEventListener('click', () => { sub.end = round1(audioEl.currentTime); row.querySelector('.t-end').value = sub.end; renderPreviewSub(); });
    row.querySelector('.btn-del').addEventListener('click', () => {
      state.subs = state.subs.filter((s) => s.id !== sub.id);
      renderSubList(); renderPreviewSub();
    });
    list.appendChild(row);
  }
}

/* ---------- 自動文字起こし(Transformers.js + Whisper / すべて端末内で実行) ---------- */

let whisperPipeline = null;

async function loadWhisper(onStatus) {
  if (whisperPipeline) return whisperPipeline;
  onStatus('文字起こしAIを読み込み中…');
  const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
  const progress_callback = (p) => {
    if (p.status === 'progress' && p.total) {
      onStatus(`AIモデルをダウンロード中…(初回のみ)${Math.round(p.progress)}% — ${p.file}`);
    }
  };
  const model = 'Xenova/whisper-small';
  try {
    // WebGPU(ブラウザのGPU実行)が使えれば高速に。ダメならCPU版へフォールバック
    whisperPipeline = await pipeline('automatic-speech-recognition', model, {
      device: 'webgpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
      progress_callback,
    });
  } catch (_) {
    whisperPipeline = await pipeline('automatic-speech-recognition', model, {
      dtype: 'q8',
      progress_callback,
    });
  }
  return whisperPipeline;
}

// Whisperは16kHzモノラルの生波形を受け取るため、音源ファイルをデコード&リサンプリングする
async function decodeTo16kMono(file) {
  const arrayBuffer = await file.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await ac.decodeAudioData(arrayBuffer);
  ac.close();
  const sr = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sr), sr);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

$('transcribeBtn').addEventListener('click', async () => {
  if (!state.audioFile) { alert('先に音源を選んでください'); return; }

  const hasUserSubs = state.subs.some((s) => s.text.trim() && s.text !== 'ここに歌詞やメッセージ');
  if (hasUserSubs && !confirm('今ある字幕を消して、自動文字起こしの結果に置き換えます。よろしいですか?')) return;

  const btn = $('transcribeBtn');
  const setStatus = (msg) => { $('transcribeStatus').textContent = msg; };
  btn.disabled = true;

  try {
    const transcriber = await loadWhisper(setStatus);

    setStatus('音源を解析する準備をしています…');
    const audio = await decodeTo16kMono(state.audioFile);

    setStatus(`文字起こし中…(${fmtTime(state.audioDuration)}の音源を解析しています。少し時間がかかります)`);
    const out = await transcriber(audio, {
      language: 'japanese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    const chunks = (out.chunks || []).filter((c) => c.text && c.text.trim());
    if (chunks.length === 0) {
      setStatus('⚠ 歌声やセリフを聞き取れませんでした(インスト曲の場合は手動で字幕を追加してください)');
      return;
    }

    state.subs = [];
    for (const c of chunks) {
      const start = c.timestamp[0] ?? 0;
      let end = c.timestamp[1];
      if (end == null || end <= start) end = Math.min(start + 3.5, state.audioDuration || start + 3.5);
      addSub(start, end, c.text.trim());
    }
    renderPreviewSub();
    setStatus(`✅ ${state.subs.length}件の字幕を自動生成しました。テキストやタイミングは下のリストで修正できます`);
  } catch (err) {
    console.error(err);
    setStatus('❌ 文字起こしに失敗しました: ' + err.message + '(通信環境を確認して再度お試しください)');
  } finally {
    btn.disabled = false;
  }
});

/* ---------- 字幕PNGの生成(Canvasで日本語フォントを焼き込み) ---------- */

async function renderSubPng(sub) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const px = parseInt($('fontSize').value, 10);
  ctx.font = `700 ${px}px -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // "/" で手動改行 + 長すぎる行は自動折り返し
  const maxWidth = W * 0.88;
  const lines = [];
  for (const part of sub.text.split('/')) {
    let line = '';
    for (const ch of part.trim()) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
  }
  if (lines.length === 0) return null;

  const lineH = px * 1.35;
  const blockH = lineH * lines.length;
  const pos = $('subPos').value;
  let centerY;
  if (pos === 'top') centerY = H * 0.10 + blockH / 2;
  else if (pos === 'center') centerY = H / 2;
  else centerY = H * 0.88 - blockH / 2;

  lines.forEach((line, i) => {
    const y = centerY - blockH / 2 + lineH * (i + 0.5);
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = px * 0.14;
    ctx.strokeStyle = '#000';
    ctx.strokeText(line, W / 2, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillText(line, W / 2, y);
  });
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/* ---------- Step 4: 書き出し(FFmpeg.wasm) ---------- */

let ffmpegLoaded = false;
async function loadFFmpeg(onStatus) {
  if (!window.FFmpeg) {
    onStatus('変換エンジンを読み込み中…(初回のみ・約25MB)');
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
      s.onload = resolve; s.onerror = () => reject(new Error('FFmpeg読み込み失敗'));
      document.head.appendChild(s);
    });
  }
  if (!ffmpegLoaded) {
    const { createFFmpeg } = FFmpeg;
    // crossOriginIsolated(COOP/COEPヘッダーあり)ならマルチスレッド版(速い)、
    // なければシングルスレッド版(SharedArrayBuffer不要でどこでも動く)
    const useMT = !!window.crossOriginIsolated;
    window._ff = createFFmpeg(useMT
      ? { corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js', log: false }
      : { corePath: 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js', mainName: 'main', log: false });
    await window._ff.load();
    ffmpegLoaded = true;
  }
  return window._ff;
}

$('exportBtn').addEventListener('click', async () => {
  if (!state.audioFile || !state.bgBlob) { alert('音源と背景画像を先に設定してください'); return; }
  const subs = state.subs.filter((s) => s.text.trim() && s.end > s.start);

  const btn = $('exportBtn');
  btn.disabled = true;
  $('downloadLink').classList.add('hidden');
  $('progressWrap').classList.remove('hidden');
  const setStatus = (msg) => { $('progressText').textContent = msg; };
  const setBar = (r) => { $('progressFill').style.width = Math.min(100, Math.round(r * 100)) + '%'; };

  try {
    const ff = await loadFFmpeg(setStatus);
    const { fetchFile } = FFmpeg;
    const fps = $('fpsSelect').value;

    setStatus('素材を準備中…');
    setBar(0.02);

    // 入力ファイルをFFmpegの仮想FSへ
    const ext = (state.audioFile.name.match(/\.(\w+)$/) || [, 'mp3'])[1].toLowerCase();
    ff.FS('writeFile', 'input.' + ext, await fetchFile(state.audioFile));
    ff.FS('writeFile', 'bg.png', await fetchFile(state.bgBlob));

    const subPngs = [];
    for (let i = 0; i < subs.length; i++) {
      const png = await renderSubPng(subs[i]);
      if (png) {
        ff.FS('writeFile', `sub${i}.png`, await fetchFile(png));
        subPngs.push({ idx: subPngs.length, start: subs[i].start, end: subs[i].end });
      }
    }

    // 引数を組み立て(背景=入力0、音声=入力1、字幕PNG=入力2以降をoverlayで時間指定合成)
    const args = ['-loop', '1', '-framerate', fps, '-i', 'bg.png', '-i', 'input.' + ext];
    for (let i = 0; i < subPngs.length; i++) args.push('-i', `sub${i}.png`);

    if (subPngs.length > 0) {
      let graph = '';
      let prev = '0:v';
      subPngs.forEach((s, i) => {
        const out = i === subPngs.length - 1 ? 'vout' : `v${i + 1}`;
        graph += `[${prev}][${i + 2}:v]overlay=0:0:enable='between(t,${s.start},${s.end})'[${out}];`;
        prev = out;
      });
      args.push('-filter_complex', graph.slice(0, -1), '-map', '[vout]', '-map', '1:a');
    } else {
      args.push('-map', '0:v', '-map', '1:a');
    }

    args.push(
      '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p', '-r', fps,
      '-c:a', 'aac', '-b:a', '192k',
      '-shortest', 'out.mp4'
    );

    setStatus(`変換中…(${fmtTime(state.audioDuration)}の動画を生成しています)`);
    ff.setProgress(({ ratio }) => {
      if (ratio >= 0 && ratio <= 1) { setBar(0.05 + ratio * 0.93); setStatus(`変換中… ${Math.round(ratio * 100)}%`); }
    });

    await ff.run(...args);

    const data = ff.FS('readFile', 'out.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const base = state.audioFile.name.replace(/\.\w+$/, '');
    const link = $('downloadLink');
    link.href = URL.createObjectURL(blob);
    link.download = `${base}_shorts.mp4`;
    link.classList.remove('hidden');
    setBar(1);
    setStatus(`✅ 完成!(${(blob.size / 1024 / 1024).toFixed(1)}MB)下のボタンからダウンロードできます`);

    // 仮想FSの後片付け(メモリ解放)
    ['out.mp4', 'bg.png', 'input.' + ext, ...subPngs.map((_, i) => `sub${i}.png`)]
      .forEach((f) => { try { ff.FS('unlink', f); } catch (_) {} });
  } catch (err) {
    console.error(err);
    setStatus('❌ 変換に失敗しました: ' + err.message + '(ページを再読み込みして再度お試しください)');
  } finally {
    btn.disabled = false;
  }
});
