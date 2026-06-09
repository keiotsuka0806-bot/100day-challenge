import fs from 'node:fs';
import vm from 'node:vm';

const code = `${fs.readFileSync('levels.js', 'utf8')};globalThis.out={T,LEVELS};`;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);

const { T, LEVELS } = ctx.out;
const key = (pos) => `${pos.x},${pos.y}`;
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const matchingNext = (rule, rules) => rules.filter((next) => next.id !== rule.id && rule.to === next.from && adjacent(rule, next));

function initialEffects(level) {
  const active = new Set();
  level.rules.forEach((rule) => {
    if (matchingNext(rule, level.rules).length > 0) active.add(rule.id);
    level.rules.forEach((prev) => {
      if (prev.id !== rule.id && prev.to === rule.from && adjacent(prev, rule)) active.add(rule.id);
    });
  });

  function resolve(base) {
    let current = base;
    const seen = new Set();
    for (let i = 0; i < 8; i += 1) {
      const nextRule = level.rules.find((rule) => {
        if (rule.from !== current) return false;
        if (seen.size === 0) return matchingNext(rule, level.rules).length > 0;
        return active.has(rule.id) || matchingNext(rule, level.rules).length > 0;
      });
      if (!nextRule || seen.has(nextRule.id)) break;
      seen.add(nextRule.id);
      current = nextRule.to;
      if (current === 'walk' || current === 'gone') break;
    }
    return current;
  }

  return { active, resolve };
}

function reachableInitially(level) {
  const tiles = new Map(level.tiles.map((tile) => [key(tile), tile.type]));
  const { active, resolve } = initialEffects(level);
  const goal = level.tiles.find((tile) => tile.type === T.GOAL);
  const queue = [level.playerStart];
  const seen = new Set([key(level.playerStart)]);

  const passable = (pos) => {
    const base = tiles.get(key(pos)) || T.EMPTY;
    if (base === T.GOAL) return true;
    const effect = resolve(base);
    return effect === T.EMPTY || effect === 'walk' || effect === 'gone';
  };

  for (const pos of queue) {
    if (goal && key(pos) === key(goal)) return { reachable: true, activeCount: active.size };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: pos.x + dx, y: pos.y + dy };
      if (next.x < 0 || next.y < 0 || next.x >= level.cols || next.y >= level.rows) continue;
      if (seen.has(key(next)) || !passable(next)) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }

  return { reachable: false, activeCount: active.size };
}

function maxChainLength(level) {
  const rules = level.rules;
  function walk(rule, seen = new Set()) {
    if (seen.has(rule.id)) return 0;
    const nextSeen = new Set(seen);
    nextSeen.add(rule.id);
    const nextRules = rules.filter((candidate) => candidate.id !== rule.id && candidate.from === rule.to);
    if (nextRules.length === 0) return 1;
    return 1 + Math.max(...nextRules.map((next) => walk(next, nextSeen)));
  }
  return Math.max(...rules.map((rule) => walk(rule)));
}

const findings = [];
const rows = LEVELS.map((level, index) => {
  const reach = reachableInitially(level);
  const chain = maxChainLength(level);
  const trapCount = level.rules.filter((rule) => rule.to === 'fire').length;
  const wallCount = level.tiles.filter((tile) => tile.type !== T.GOAL).length;

  if (reach.reachable) findings.push(`Level ${index + 1}: initial state is reachable without solving.`);
  if (reach.activeCount > 0) findings.push(`Level ${index + 1}: starts with active rules.`);
  if (index >= 2 && chain < 3) findings.push(`Level ${index + 1}: chain depth is too shallow for mid/late game.`);
  if (index >= 3 && trapCount === 0) findings.push(`Level ${index + 1}: lacks trap pressure.`);

  return {
    level: index + 1,
    title: level.title,
    difficulty: level.difficulty,
    par: level.par,
    rules: level.rules.length,
    chain,
    traps: trapCount,
    walls: wallCount,
    initial: reach.reachable ? 'BAD' : 'blocked',
  };
});

const now = new Date().toISOString();
const report = [
  '# LexWorld Pro Gamer Review',
  '',
  `Generated: ${now}`,
  '',
  '## Scorecard',
  '',
  '| Level | Title | Diff | Par | Rules | Chain | Traps | Walls | Initial |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ...rows.map((row) => `| ${row.level} | ${row.title} | ${row.difficulty} | ${row.par} | ${row.rules} | ${row.chain} | ${row.traps} | ${row.walls} | ${row.initial} |`),
  '',
  '## Three-Loop Protocol',
  '',
  '1. Competitive Read: check whether the player has visible goals, par pressure, rank feedback, and best-score motivation.',
  '2. Puzzle Integrity: check whether initial clear is impossible, rule chains are necessary, traps create meaningful risk, and late stages have multiple required transformations.',
  '3. Replay Value: check whether clears produce a better target, whether stage selection shows performance, and whether the next run has a reason to exist.',
  '',
  '## Findings',
  '',
  findings.length ? findings.map((finding) => `- ${finding}`).join('\n') : '- GO: no blocking pro-gamer findings detected.',
  '',
].join('\n');

fs.mkdirSync('../../デザイン部/reports', { recursive: true });
fs.writeFileSync('../../デザイン部/reports/2026-06-06-lexworld-pro-gamer.md', report);
console.log(report);
