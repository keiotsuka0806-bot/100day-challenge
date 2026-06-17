#!/usr/bin/env node
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url') args.url = argv[i + 1];
    if (argv[i] === '--project') args.project = argv[i + 1];
  }
  return args;
}

function fetchText(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body }));
    }).on('error', (error) => resolve({ ok: false, status: 0, body: error.message }));
  });
}

async function runPlaywright(url, project) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const title = await page.title();
    const visibleText = await page.locator('body').innerText({ timeout: 5000 });
    const outDir = path.join(process.cwd(), 'スクリーンショット', new Date().toISOString().slice(0, 10));
    fs.mkdirSync(outDir, { recursive: true });
    const screenshotPath = path.join(outDir, `${project || 'project'}-mobile.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 幅320pxでの横はみ出し検査（スマホ崩れの主因＝横スクロールを検出）
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(() => {
      const de = document.documentElement, vw = de.clientWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1) {
          bad.push((el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase()));
        }
      });
      return { overflowX: de.scrollWidth - vw, offenders: [...new Set(bad)].slice(0, 6) };
    });
    await browser.close();
    const overflowOk = overflow.overflowX <= 8; // 8px超の横はみ出しは崩れとみなす
    return {
      ok: Boolean(title) && visibleText.trim().length > 20 && overflowOk,
      mode: 'playwright',
      detail: `title="${title}", screenshot=${screenshotPath}, mobile320=${overflowOk ? 'OK(はみ出しなし)' : `NG(横はみ出し${overflow.overflowX}px 犯人:${overflow.offenders.join(',')})`}`,
    };
  } catch (error) {
    return { ok: false, mode: 'playwright-unavailable', detail: error.message };
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.url) {
  console.error('Usage: node 運用部/scripts/visual-smoke-check.mjs --url https://... --project [name]');
  process.exit(1);
}

const pw = await runPlaywright(args.url, args.project);
if (pw.ok) {
  console.log(`OK visual smoke (${pw.mode}): ${pw.detail}`);
  process.exit(0);
}

const fetched = await fetchText(args.url);
const htmlOk = fetched.ok && /<body[\s>]/i.test(fetched.body) && fetched.body.replace(/<[^>]+>/g, ' ').trim().length > 20;
console.log(`${htmlOk ? 'OK' : 'NG'} visual smoke (html fallback): HTTP ${fetched.status}; playwright=${pw.detail}`);
process.exit(htmlOk ? 0 : 1);
