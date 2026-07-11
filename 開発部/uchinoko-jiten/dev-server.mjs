// ローカル試験用サーバー(Vercel不要で /api/jiten まで動かす)
// 使い方: OPENAI_API_KEY=... node dev-server.mjs → http://localhost:3456
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import handler from './api/jiten.js';

const PORT = 3456;
const ROOT = resolve('.');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

createServer(async (req, res) => {
  try {
    if (req.url === '/api/jiten' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const vReq = { method: 'POST', headers: req.headers, body };
      const vRes = {
        _status: 200,
        setHeader: (k, v) => res.setHeader(k, v),
        status(c) { this._status = c; return this; },
        json(obj) { res.writeHead(this._status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
      };
      await handler(vReq, vRes);
      return;
    }
    const path = req.url === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
    const full = resolve(join(ROOT, '.' + path));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403); res.end('forbidden'); return; }
    const data = await readFile(full);
    res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500);
    res.end(e.code === 'ENOENT' ? 'not found' : 'server error');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
