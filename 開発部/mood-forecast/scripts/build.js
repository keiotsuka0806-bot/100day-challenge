#!/usr/bin/env node
// Workaround: Vite/Rollup can't handle "#" in paths (treated as URL fragment).
// This script copies source files to a temp dir, builds, then copies dist back.
import { execSync } from 'child_process'
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tmp  = `/tmp/mood-forecast-build-${process.pid}`

console.log('Building Mood Forecast...')
try {
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })

  for (const entry of ['src', 'public', 'index.html', 'vite.config.js', 'package.json']) {
    const src = resolve(root, entry)
    if (existsSync(src)) cpSync(src, resolve(tmp, entry), { recursive: true })
  }

  // Rewrite index.html to use relative path (avoids # URL fragment issue in Rollup)
  const htmlPath = resolve(tmp, 'index.html')
  writeFileSync(htmlPath, readFileSync(htmlPath, 'utf8').replace(
    'src="/src/main.jsx"', 'src="./src/main.jsx"'
  ))

  // Symlink node_modules to avoid re-installing
  execSync(`ln -s "${root}/node_modules" "${tmp}/node_modules"`)

  execSync(`cd "${tmp}" && node_modules/.bin/vite build --outDir "${root}/dist" --emptyOutDir`, {
    stdio: 'inherit',
  })
  console.log('\n✅ Build complete! Output: dist/')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
