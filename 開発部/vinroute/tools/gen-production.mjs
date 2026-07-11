/* 本生産：名所・名産・汎用素材の一括生成（スタイルガイド準拠）
   使い方: set -a; source ~/.secrets/keys.env; set +a; node tools/gen-production.mjs */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("OPENAI_API_KEY がありません"); process.exit(1); }
const outDir = fileURLToPath(new URL("../assets/landmarks/", import.meta.url));
mkdirSync(outDir, { recursive: true });

/* スタイルガイドの共通言語（あつ森トゥーン3D・正面固定） */
const AC = `rendered exactly like an object in Animal Crossing New Horizons:
cozy 3D toon render with soft volumetric shading and clear depth, rounded plump forms,
warm vivid saturated colors, smooth polished surfaces with subtle sheen,
NOT flat illustration, NOT clay, NO outlines,
viewed straight from the front and slightly above (fixed Animal Crossing game camera),
fully front-facing and left-right symmetric, NO diagonal angle, NO isometric rotation,
flat bottom sitting directly on the ground, no base, single object centered,
soft contact shadow directly beneath, isolated on transparent background, no glow, no halo, no text,
bright clean neutral daylight, fresh vivid colors, NO sepia`;

const ITEMS = [
  /* ===== 産地の名物・名所（20） ===== */
  ["sp_champ",     `a festive champagne bottle in golden-green glass with gold foil top, tiny white bubbles popping out, next to a slim champagne flute`],
  ["sp_alsace",    `a tall narrow colorful half-timbered Alsatian house (Colmar style) in pink and cream with brown timber frames and steep roof`],
  ["sp_chablis",   `a plate with two cute oysters (one open showing a shiny pearl-like interior) and a slice of lemon`],
  ["sp_bourgogne", `a cute escargot dish: a round plate with six snail shells with tiny herb butter, one cute snail peeking out happily`],
  ["sp_jura",      `a big wheel of Comté cheese with one wedge cut out lying in front, warm golden color with small holes`],
  ["sp_beaujo",    `a small wine barrel decorated with a colorful ribbon and a bouquet of small flowers on top (nouveau celebration)`],
  ["sp_savoie",    `a cozy cheese fondue pot in red enamel over a tiny burner, with two long forks with bread cubes leaning on it`],
  ["sp_loire",     `an elegant fairytale white château (Loire castle) with blue-grey conical tower roofs and small windows`],
  ["sp_sancerre",  `a cute white goat with tiny horns standing next to two small round white goat cheeses (crottin)`],
  ["sp_muscadet",  `a black pot full of steamed mussels with open shells, one lemon wedge on the rim`],
  ["sp_rhone",     `a stone bridge fragment with two arches (Pont d'Avignon style) in warm beige stone`],
  ["sp_tavel",     `a rosé wine bottle in pale pink glass next to a stemmed glass of pink rosé wine`],
  ["sp_provence",  `three rows of plump purple lavender bushes with tiny buds, slightly staggered heights`],
  ["sp_languedoc", `a medieval fortress wall fragment with two round towers with pointed slate roofs (Carcassonne style)`],
  ["sp_banyuls",   `a small red-and-white striped lighthouse on a tiny rock with two seagulls perched on top`],
  ["sp_bordeaux",  `a grand elegant wine château facade in cream stone with slate mansard roof, tall windows and a small clock`],
  ["sp_cognac",    `a shiny copper alembic still (onion-shaped pot with a curved swan neck pipe) for distilling brandy`],
  ["sp_cahors",    `a medieval stone bridge with two tall pointed defensive towers (Pont Valentré style) in honey stone`],
  ["sp_madiran",   `a fluffy cute sheep with a round wooly body and a tiny bell collar, standing on a patch of grass`],
  ["sp_gaillac",   `a round stone dovecote tower (pigeonnier) with a tiled pointed roof and two white doves perched at the small openings`],

  /* ===== 都市のランドマーク（パリ=エッフェル塔は既存） ===== */
  ["ct_lyon",       `a cozy French bistro pot: a red enameled cocotte pot with steam wisps, a golden baguette and a chef's hat beside it`],
  ["ct_bourges",    `a gothic cathedral facade with two square towers, a big round rose window and a pointed portal, in light grey stone`],
  ["ct_clermont",   `a gentle green volcano (Puy de Dôme) with rounded slopes and a small stone observatory on its summit`],
  ["ct_toulouse",   `a cute small passenger airplane in white with red accents, plump rounded body, propeller nose, parked on the ground`],
  ["ct_marseille",  `a bouillabaisse feast: a wide orange pot of fish soup with a whole cute fish, mussels and a slice of bread with rouille`],
  ["ct_nantes",     `a whimsical giant mechanical elephant made of wood and steel with riveted plates and a small canopy on its back`],
  ["ct_strasbourg", `a white stork standing in a big round twig nest on top of a chimney, one baby stork peeking out`],
  ["ct_dijon",      `a classic mustard crock: a cream ceramic pot labeled with a simple mustard-yellow band, with a tiny wooden spoon, and two mustard jars beside it`],
  ["ct_orleans",    `a golden equestrian statue of a knight heroine holding a banner, on a very low flat stone slab (not a tall pedestal)`],

  /* ===== 汎用バリエーション ===== */
  ["tree_cypress",  `a tall slim Mediterranean cypress tree, plump rounded cone shape in deep green, with the same layered scalloped leaf texture as a grapevine hedge`],
  ["tree_olive",    `a small olive tree with a gnarled pale trunk and a round silvery-green canopy with the same layered scalloped leaf texture as a grapevine hedge`],
  ["house_stone",   `a small rustic French stone cottage with cream stone walls, blue wooden shutters and door, and a grey slate roof`],
  ["mountain_snow", `a rounded snow-capped mountain in soft blue-grey stone with white snow on top and a little pine tree at its foot`],
];

const failed = [];
for (const [name, desc] of ITEMS) {
  const path = outDir + name + ".png";
  if (existsSync(path)) { console.log("スキップ(既存):", name); continue; }
  process.stdout.write(`生成中: ${name} ... `);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt: `${desc}, ${AC}`, size: "1024x1024", quality: "medium", background: "transparent", n: 1 }),
    });
    if (!res.ok) { console.error("失敗", res.status, (await res.text()).slice(0, 160)); failed.push(name); continue; }
    writeFileSync(path, Buffer.from((await res.json()).data[0].b64_json, "base64"));
    console.log("OK");
  } catch (e) { console.error("エラー", e.message); failed.push(name); }
}
console.log(failed.length ? `失敗: ${failed.join(", ")}（再実行でリトライ）` : "全件完了");
