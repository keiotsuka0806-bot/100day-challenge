// ローカル確認用サーバー（本番はVercelが担う）。静的配信 + /api/interview をVercel関数ハンドラで処理。
// Nodeのhttpは並行接続に耐える（python http.serverの単線問題を回避 — 記憶庫 2026-07-09）。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/interview.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = process.env.PORT || 8789;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

function vercelRes(res) {
  return {
    status(code) { res.statusCode = code; return this; },
    json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); },
  };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/interview') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      handler({ method: req.method, headers: req.headers, body }, vercelRes(res));
    });
    return;
  }

  // パストラバーサル防止: 正規化してROOT配下のみ配信
  const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath === '/' ? 'index.html' : safePath.slice(1));
  if (!filePath.startsWith(ROOT)) { res.statusCode = 403; res.end('Forbidden'); return; }
  try {
    const data = await readFile(filePath);
    res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }
}).listen(PORT, () => console.log(`dev server: http://localhost:${PORT}`));
