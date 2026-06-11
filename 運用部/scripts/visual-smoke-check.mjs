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
    await browser.close();
    return {
      ok: Boolean(title) && visibleText.trim().length > 20,
      mode: 'playwright',
      detail: `title="${title}", screenshot=${screenshotPath}`,
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
