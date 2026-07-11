/* コンセプトアート生成（ステップ1：スタイル決め用の少数サンプル）
   使い方: source ~/.secrets/keys.env && node tools/gen-concept.mjs
   モデル: gpt-image-1 / 透過背景 / medium品質（1枚あたり数十円未満） */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("OPENAI_API_KEY がありません。source ~/.secrets/keys.env を先に"); process.exit(1); }

/* 統一スタイル（全素材共通の言い回し。本生産でもこれを使い回す） */
const STYLE = `Cute miniature game asset in the style of a cozy life-sim video game (Animal Crossing-inspired),
made of soft matte silicone like a squishy vinyl toy: rounded plump forms, smooth matte rubbery surface,
gentle subsurface softness, no hard edges, subtle warm pastel colors,
viewed from a 3/4 high angle like a board game piece, single object centered,
soft ambient occlusion contact shadow directly beneath the object,
clean silhouette, no text, no watermark, isolated on transparent background`;

const ITEMS = [
  ["tree",      "a single round fluffy tree with a chubby trunk and two or three soft blob-shaped leaf clusters in fresh green"],
  ["house",     "a small French half-timbered cottage (colombage) with cream walls, brown beams and a plump terracotta roof"],
  ["eiffel",    "a chibi Eiffel Tower, short and plump proportions, warm bronze color"],
  ["barrel",    "a plump wooden wine barrel lying slightly tilted, with a small purple grape bunch resting on top"],
  ["character", "a cute chibi sommelier girl game character, big head small body (2-head proportions), simple dot eyes and tiny smile, rosy cheeks, dark red hair in a bob, black vest over cream shirt, holding a tiny wine glass, standing facing slightly left"],
];

const outDir = fileURLToPath(new URL("../assets/concept/", import.meta.url)); // 日本語パスでも正しく解決
mkdirSync(outDir, { recursive: true });

for (const [name, desc] of ITEMS) {
  process.stdout.write(`生成中: ${name} ... `);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${desc}. ${STYLE}`,
      size: "1024x1024",
      quality: "medium",
      background: "transparent",
      n: 1,
    }),
  });
  if (!res.ok) { console.error("失敗", res.status, await res.text()); process.exit(1); }
  const json = await res.json();
  writeFileSync(outDir + name + ".png", Buffer.from(json.data[0].b64_json, "base64"));
  console.log("OK");
}
console.log("完了 →", outDir);
