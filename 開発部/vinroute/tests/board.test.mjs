import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCountry, validateCountry } from "../engine/country.js";
import { buildBoard, validateBoard, bfsDistances, CELL_KINDS } from "../engine/board.js";

const franceJson = JSON.parse(readFileSync(new URL("../data/france.json", import.meta.url)));
const quizJson = JSON.parse(readFileSync(new URL("../data/quiz_france.json", import.meta.url)));

test("Step0: france.json の件数検証（産地20・都市10・links全件・タイプ4種）", () => {
  assert.equal(validateCountry(franceJson).length, 0);
  assert.equal(Object.keys(franceJson.regions).length, 20, "産地は20");
  assert.equal(Object.keys(franceJson.cities).length, 10, "都市は10");
  // プロトタイプ56本 − paris-loire直行1本 ＋ (paris-orleans, orleans-loire)2本 = 57本
  assert.equal(franceJson.links.length, 57, `links全件（${franceJson.links.length}件）`);
  assert.deepEqual(franceJson.sets.typeLabels, ["赤", "白", "泡", "ロゼ"]);
  assert.equal(franceJson.cities.paris.isStart, true, "パリが開始地点");
  // 地理セット5つ・全産地がいずれかのセットに属する
  assert.equal(Object.keys(franceJson.sets.geo).length, 5);
  const inSets = new Set(Object.values(franceJson.sets.geo).flat());
  assert.equal(inSets.size, 20, "全20産地が地理セットに属する");
});

test("Step0: クイズデータが読み込める", () => {
  assert.ok(quizJson.quiz.length >= 5);
  quizJson.quiz.forEach(q => {
    assert.ok(q.q && Array.isArray(q.choices) && q.choices.length >= 2);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.ok(q.explain);
  });
});

const country = loadCountry(franceJson);

test("Step1: 盤面が生成され検証3項目をパスする", () => {
  const board = buildBoard(country, { seed: 7 });
  const v = validateBoard(board, country);
  assert.ok(v.ok, "検証エラー: " + v.errors.join(" / "));
  assert.ok(board.cellArr.length > 100, "十分なマス数");
});

test("Step1: 全マスが開始地点から到達可能（BFS実測）", () => {
  const board = buildBoard(country, { seed: 7 });
  const dist = bfsDistances(board, board.startCellId);
  assert.equal(Object.keys(dist).length, board.cellArr.length);
});

test("Step1: 同じseedなら同じ盤面（決定性）", () => {
  const a = buildBoard(country, { seed: 7 });
  const b = buildBoard(country, { seed: 7 });
  assert.equal(a.cellArr.length, b.cellArr.length);
  assert.deepEqual(
    a.cellArr.map(c => [c.id, c.type, c.next.slice().sort()]),
    b.cellArr.map(c => [c.id, c.type, c.next.slice().sort()])
  );
});

test("Step1: 複数seedでも検証をパスする（頑健性）", () => {
  for (const seed of [1, 2, 3, 11, 42, 99]) {
    const board = buildBoard(country, { seed });
    const v = validateBoard(board, country);
    assert.ok(v.ok, `seed=${seed} 検証エラー: ${v.errors.join(" / ")}`);
  }
});

test("Step1: 道中マスの種類は定義済みのものだけ", () => {
  const board = buildBoard(country, { seed: 7 });
  board.cellArr.forEach(c => {
    assert.ok(c.type === "node" || CELL_KINDS.includes(c.type), c.type);
  });
});
