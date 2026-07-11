/* Step 10: 構造の証明 — italy.json を追加するだけで（エンジン変更ゼロ）
   盤面が生成・検証をパスし、ゲームが最後まで回ること */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCountry, validateCountry } from "../engine/country.js";
import { buildBoard, validateBoard } from "../engine/board.js";
import { createGame, runHeadless } from "../engine/state.js";

const italyJson = JSON.parse(readFileSync(new URL("../data/italy.json", import.meta.url)));
const quizJson = JSON.parse(readFileSync(new URL("../data/quiz_italy.json", import.meta.url)));

test("Step10: italy.json がスキーマ検証をパス（10産地・タイプ4種）", () => {
  assert.deepEqual(validateCountry(italyJson), []);
  assert.equal(Object.keys(italyJson.regions).length, 10);
  assert.deepEqual(italyJson.sets.typeLabels, ["赤", "白", "泡", "ロゼ"]);
});

test("Step10: イタリア盤面が生成され検証3項目をパス（エンジン変更ゼロ）", () => {
  const country = loadCountry(italyJson);
  for (const seed of [7, 1, 42]) {
    const board = buildBoard(country, { seed });
    const v = validateBoard(board, country);
    assert.ok(v.ok, `seed=${seed}: ${v.errors.join(" / ")}`);
  }
});

test("Step10: イタリアでNPC3人が5シーズン完走できる", async () => {
  const country = loadCountry(italyJson);
  const g = createGame(country, {
    seed: 7,
    players: [
      { name: "A", isNpc: true }, { name: "B", isNpc: true }, { name: "C", isNpc: true },
    ],
    quizzes: quizJson.quiz,
  });
  const ranked = await runHeadless(g);
  assert.equal(ranked.length, 3);
  assert.ok(ranked[0].total >= ranked[2].total);
});
