# VinRoute アートスタイルガイド（確定版 2026-07-08）

コンセプト検証(assets/concept〜concept6)で確定した世界観・プロンプト集。
**新しい素材はすべてこのガイドの言語で生成する。** モデル: gpt-image-1 / background: transparent / 後処理: alpha<200のもや除去。

## 世界観の合意事項（Keiと確定）

- 全体: **あつまれどうぶつの森**の世界観に統一（高級陶磁器路線は廃止）
- 質感: 形はあつ森・質感は「トゥーン3D」（粘土NG・平面イラストNG・輪郭線NG）
- 視点: **正面固定カメラ**（あつ森と同じ）。**例外=ランドマーク級の建物のみ少し斜めOK**（例: エッフェル塔 v10）
- 道: 石畳テクスチャ（concept3/road_tile.png）
- マス: **真上視点の平らなタイル**・ビビッド6色（黄緑赤青紫水色）・**金の縁**（concept6/cell_*.png）
- 産地/都市: **真上視点の丸い広場**（モザイク石畳＋紋章＋金リング）。タイプ色分け=赤ルビー/白黄緑/泡シャンパンゴールド/ロゼピンク/都市青灰（concept6/plaza_*.png）
- 海: concept4/sea_tex.png（深い青のpainterly版。あつ森ターコイズ版は不採用）
- 芝: concept4/grass_tex.png（市松の芝目）
- 木: **ぶどう畑と同じ「うろこ状の葉が重なる」質感**（concept6/tree_v2.png）
- ぶどう畑: 正面ビュー・横連結可・前後重ね置き可（concept5/vineyard_row.png）
- 配置ルール: **装飾スプライトは道・マス・広場に被せない**（map.js実装時は当たり判定から一定距離を取る）
- 色調: **明るい中立昼光・鮮やかな発色・セピア禁止**
- キャラ: 編集の継ぎ足しをせず**クリーン新規生成**（編集連鎖はセピア化が蓄積するため）

## 主人公キャラ（確定: character_doll7.png）

2.5頭身・シリコンフィギュア・ツヤありガラスの瞳（横長アーモンド）・閉じた微笑み。
仲間は**同じ等身・同じ様式**で、顔・服装・性別・年齢・職業を変える。

### キャラ生成プロンプト雛形

```
Product photo of a premium collectible SILICONE DOLL figure (high-end designer toy quality),
photographed from a distance so the ENTIRE doll occupies only the middle 60% of the image height —
generous empty transparent space above the head and below the shoes, head-to-toe fully visible,
both shoes standing flat on the ground.
PROPORTIONS: cute chibi, about 2.5 heads tall, big round head, small plump body, short legs.
FACE: smooth matte-satin silicone skin with a fresh peachy glow, big glossy GLASS doll eyes
(wide almond shape, translucent iris with real depth and wet highlights), fine sculpted lashes,
tiny nose, gentle smile, soft rosy blush. NOT anime, NO cel shading, NO outlines, NOT photoreal human.
HAIR: sculpted vinyl hair with smooth satin sheen.
OUTFIT: 【職業別に記述】
COLOR GRADING: bright clean neutral daylight, fresh VIVID colors, pure whites, NO sepia, NO warm brown haze.
Standing perfectly front-facing, symmetric stance, soft neutral studio lighting, soft contact shadow beneath,
isolated on transparent background, no glow, no text
（size: 1024x1536 / quality: high）
```

## 物・建物の生成プロンプト雛形（トゥーン3D・正面）

```
【対象の記述】, rendered exactly like an object in Animal Crossing New Horizons:
cozy 3D toon render with soft volumetric shading and clear depth, rounded plump forms,
warm vivid saturated colors, smooth polished surfaces with subtle sheen,
NOT flat illustration, NOT clay, NO outlines,
viewed straight from the front and slightly above (fixed Animal Crossing game camera),
fully front-facing and left-right symmetric, NO diagonal angle, NO isometric rotation,
flat bottom sitting directly on the ground, no base, single object centered,
soft contact shadow directly beneath, isolated on transparent background, no glow, no halo, no text
```

- 高級ランドマーク（石造）: 「carved from warm light-grey STONE ... fine lattice/detail chiseled as relief ... 」＋
  立体感が欲しいときは「camera slightly above looking gently down (10-15°), physically-based render」
  → 斜めに回った場合は images/edits で「same object ... but rotated to face PERFECTLY straight」で正面化できる
- マス: 「flat square game tile viewed perfectly from above (top-down), vivid saturated ○○ glossy tile,
  thin elegant GOLD border line inside the edge, flat (NOT domed, NOT candy), slightly rounded corners」
- 広場: 「round decorative plaza inlaid flush into the ground, viewed perfectly from above,
  circular mosaic of small rounded stones in ○○ tones, flat painted ○○ emblem at center, thin GOLD ring around the rim」

## 教訓（失敗から）

- 「すりガラスの瞳」→ 虹彩のない灰色目になる。仕上げだけ変えるなら「iris stays fully colored」を明記
- 「アニメ感を消す」を強くしすぎるとリアル赤ちゃん人形化（不気味の谷）
- チビキャラは足が見切れがち → 「figure occupies middle 60% of image height」で解決
- HTML置換はassert必須（サイレント失敗事故あり）
- 日本語パスは fileURLToPath を使う（URL.pathname はエンコードされ別フォルダができる）
