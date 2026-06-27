# 仕様書: VinRoute Roblox MVP - ブドウ文化と産地交易ゲーム

**作成日**: 2026-06-08  
**ステータス**: Roblox向け再設計  
**対象**: Roblox Studio / Luau  

---

## コンセプト

世界の産地を旅しながら、ブドウ文化・ヴィンテージクラフト・産地交易・市場予測を学ぶ戦略ボードゲーム。

既存のVinRouteの「産地を旅する」「資源を集める」「施設に投資する」「知識を戦略に変える」という核は残す。一方で、Roblox版では酒類としての表現を前面に出さず、全年齢向けの文化・交易・経営ゲームとして再設計する。

---

## 表現ルール

### 使用しない表現

- ワインを飲む
- アルコール摂取
- 酔う
- 酒場
- 試飲
- 飲酒体験
- 酒として楽しむ

### 使用する表現

- ブドウ文化
- ヴィンテージクラフト
- 産地交易
- クラフトボトル
- 熟成品
- 文化資産
- 工房
- セラー
- 市場情報
- 相場予測

### 置換ルール

| 旧表現 | Roblox版 |
| --- | --- |
| ワイン | クラフトボトル / 熟成品 |
| 醸造 | クラフト制作 |
| 醸造所 | 工房 |
| ワインバー | 交易所 |
| ソムリエクイズ | 知識チャレンジ |
| 試飲カード | 市場情報カード |
| ワイン産地 | ブドウ文化産地 |

---

## 目指すゲーム性

| 参照ゲーム | 取り入れる要素 | VinRoute Robloxでの役割 |
| --- | --- | --- |
| 桃鉄 | 世界マップをサイコロで移動 | 旅と到達の楽しさ |
| カタン | 産地ごとの資源収集 | 投資判断の材料 |
| モノポリー | 施設建設と収益 | 資産価値の成長 |
| ポケモン図鑑 | 産地カード収集 | 探索とコレクション |
| 投資ゲーム | 市場情報と相場変動 | 知識を戦略へ変換 |

重要なのは、知識チャレンジを単なる得点獲得にしないこと。

```
知識を得る
→ 市場を読む
→ 産地に投資する
→ 施設収益と資産価値が増える
```

この流れをゲームの中心に置く。

---

## MVP範囲

- 産地数: 20
- プレイヤー数: 2〜4人
- AIプレイヤー: Phase外
- 想定プレイ時間: 標準35〜45分（短縮20〜25分 / ロング50〜60分）
- 勝利条件: シーズン終了時の総資産価値ランキング
- マップ: 3Dボード上の20産地ノード + 接続ルート
- 対戦形式: 同一Robloxサーバー内のターン制

---

## ターン構成

1. サイコロを振る
2. マップ上を移動する
3. 止まった産地で資源を得る
4. その産地を発見済みカードとして登録する
5. 条件を満たせば畑・工房・セラーを建設できる
6. 知識チャレンジに成功すると市場情報カードを得る
7. 市場イベントにより特定の産地・品種・地域の価値が上がる
8. シーズン終了時に資産価値を集計する

---

## Phase計画

### Phase 1: コアループ

- [ ] 20産地のデータ定義
- [ ] プレイヤーのターン管理
- [ ] サイコロ移動
- [ ] マス到着処理
- [ ] 資源取得
- [ ] 産地カード発見

Phase 1の完了条件:

- 2〜4人が順番にサイコロを振れる
- 20産地の3Dノード上を移動できる
- 着地した産地から資源を得られる
- 発見済み産地がプレイヤーごとに記録される

### Phase 2: 建設システム

- [ ] 畑
- [ ] 工房
- [ ] セラー
- [ ] 建設コスト
- [ ] 施設ごとの収益

施設効果:

| 施設 | 役割 | 収益 |
| --- | --- | --- |
| 畑 | 産地資源の安定収集 | 自分または他プレイヤーが通過・到着時に資源+1 |
| 工房 | クラフトボトル制作の拠点 | シーズン終了時に文化資産価値+3 |
| セラー | 熟成品の価値上昇 | 対象産地の市場イベント補正+1 |

### Phase 3: 市場イベント

- [ ] 市場イベント
- [ ] 産地価値の変動
- [ ] 相場予測カード

市場イベント例:

| イベント | 効果 |
| --- | --- |
| Cool Climate Boom | Cool産地の価値+2 |
| Pinot Popularity | Pinot Noir産地の収益+3 |
| New World Trend | USA / Chile / Australia産地の価値+2 |
| Old World Prestige | France / Italy / Spain産地の価値+2 |
| Sparkling Festival | Sparkling系産地の収益+3 |

相場予測カード:

- 次の市場イベント候補を1枚見る
- 特定気候の産地建設コスト-1
- 特定品種の収益+1
- 市場イベントの対象産地を1つだけ追加で補正する

### Phase 4: 知識チャレンジ

- [ ] 三択クイズ
- [ ] 正解報酬を戦略効果にする
- [ ] 不正解でも短い解説を表示する

報酬候補:

| 報酬 | 効果 |
| --- | --- |
| 市場情報カード | 次の市場イベントを予測できる |
| 資源ボーナス | 対象産地の資源+1 |
| 建設割引 | 次の建設コスト-1 |
| 地域洞察 | 同じ地域の未発見カードを1枚公開 |
| 価格保護 | 次の不利な市場変動を1回無効化 |

### Phase 5: 勝敗判定

- [ ] 35〜45分を標準にしたシーズン制
- [ ] 最終資産ランキング
- [ ] 勝敗演出

MVPでは標準5シーズン制にする。1シーズンは各プレイヤー2ターン、2〜4人で約20〜40ターン。ゲーム開始時に短縮・標準・ロングを選べるようにし、短縮は3シーズン、標準は5シーズン、ロングは7シーズンにする。

---

## 産地カード構造

```lua
{
    id = "burgundy",
    name = "Burgundy",
    country = "France",
    region = "Old World",
    grapeType = "Pinot Noir",
    climate = "Cool",
    rarity = "Rare",
    baseValue = 8,
    resources = { "Grape", "Knowledge" },
    specialEffect = "PinotMarketBonus",
    discoveredBy = {}
}
```

### フィールド

| フィールド | 内容 |
| --- | --- |
| id | 内部ID |
| name | 表示名 |
| country | 国 |
| region | Old World / New World / Asia / Mediterraneanなど |
| grapeType | 品種・スタイル |
| climate | Cool / Warm / Hot / Dryなど |
| rarity | Common / Rare / Epic / Legendary |
| baseValue | 基礎資産価値 |
| resources | 着地時に得られる資源 |
| specialEffect | 産地固有効果 |
| discoveredBy | 発見済みプレイヤーIDリスト |

---

## 20産地MVPデータ

| id | name | country | region | grapeType | climate | rarity | baseValue | resources | specialEffect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| burgundy | Burgundy | France | Old World | Pinot Noir | Cool | Rare | 8 | Grape, Knowledge | Pinot系市場イベント時に収益+2 |
| bordeaux | Bordeaux | France | Old World | Cabernet Blend | Temperate | Rare | 8 | Grape, Gold | Old Worldイベント時に価値+1 |
| champagne | Champagne | France | Old World | Sparkling | Cool | Epic | 9 | Crystal, Knowledge | Sparklingイベント時に収益+3 |
| tuscany | Tuscany | Italy | Old World | Sangiovese | Warm | Rare | 7 | Grape, Gold | セラー価値+1 |
| piedmont | Piedmont | Italy | Old World | Nebbiolo | Cool | Rare | 7 | Grape, Knowledge | Rare産地カード価値+1 |
| rioja | Rioja | Spain | Old World | Tempranillo | Warm | Common | 6 | Grape, Gold | 建設済み施設の収益+1 |
| mosel | Mosel | Germany | Old World | Riesling | Cool | Rare | 7 | Knowledge, Crystal | 知識チャレンジ成功時に追加カード+1 |
| douro | Douro | Portugal | Old World | Blend | Warm | Common | 6 | Grape, Crystal | 交易資源+1 |
| napa | Napa | USA | New World | Cabernet Sauvignon | Warm | Epic | 9 | Grape, Gold | 工房建設コスト-1 |
| willamette | Willamette | USA | New World | Pinot Noir | Cool | Rare | 7 | Grape, Knowledge | Pinot系市場イベント時に価値+2 |
| mendoza | Mendoza | Argentina | New World | Malbec | Dry | Common | 6 | Grape, Gold | Dry産地イベント時に収益+2 |
| maipo | Maipo | Chile | New World | Cabernet Sauvignon | Warm | Common | 6 | Grape, Gold | New Worldイベント時に価値+1 |
| barossa | Barossa | Australia | New World | Shiraz | Hot | Rare | 7 | Grape, Gold | Hot産地の収益+1 |
| marlborough | Marlborough | New Zealand | New World | Sauvignon | Cool | Rare | 7 | Knowledge, Crystal | Coolイベント時に市場情報カード+1 |
| yamanashi | Yamanashi | Asia | Koshu-inspired | Cool | Rare | 7 | Knowledge, Grape | 知識チャレンジ報酬+1 |
| capetown | Cape Town | New World | Blend | Warm | Common | 6 | Grape, Gold | 交易時に任意資源+1 |
| santorini | Santorini | Mediterranean | Mineral | Dry | Epic | 8 | Crystal, Knowledge | Crystal価値+1 |
| tokaj | Tokaj | Old World | Sweet Craft | Cool | Rare | 7 | Knowledge, Crystal | セラー建設コスト-1 |
| ningxia | Ningxia | Asia | Cabernet Sauvignon | Dry | Rare | 7 | Grape, Gold | Asiaイベント時に価値+2 |
| bekaa | Bekaa | Mediterranean | Blend | Warm | Common | 6 | Grape, Knowledge | 隣接産地発見時に資源+1 |

---

## 資源

| 資源 | 役割 |
| --- | --- |
| Grape | 畑・工房の基礎資源 |
| Knowledge | 知識チャレンジや市場情報カードに関係 |
| Gold | 建設・投資用資源 |
| Crystal | セラー・熟成品・文化資産に関係 |

---

## 建設コスト

| 施設 | コスト | 建設条件 |
| --- | --- | --- |
| 畑 | Grape x2 | 発見済み産地 |
| 工房 | Grape x1, Gold x2 | 畑がある産地 |
| セラー | Crystal x2, Knowledge x1 | 工房がある産地 |

---

## 資産価値計算

```
総資産価値 =
  所持資源価値
  + 発見済み産地カード価値
  + 建設施設価値
  + 現在の市場イベント補正
  + 市場情報カード補正
  + 文化資産ボーナス
```

MVPの単価:

| 項目 | 価値 |
| --- | --- |
| Grape | 1 |
| Knowledge | 2 |
| Gold | 2 |
| Crystal | 3 |
| 畑 | 4 |
| 工房 | 7 |
| セラー | 10 |

---

## Roblox構成案

```text
ReplicatedStorage/
  VinRoute/
    Remotes/
      RollDiceRequest
      MoveRequest
      BuildRequest
      KnowledgeChallengeRequest
      ClientStateUpdate
      OpenKnowledgeChallenge
    Shared/
      RegionData.lua
      MarketEvents.lua
      KnowledgeChallenges.lua
      BuildingData.lua
      GameConstants.lua

ServerScriptService/
  VinRouteServer/
    GameServer.server.lua
    GameState.lua
    TurnService.lua
    MovementService.lua
    ResourceService.lua
    BuildingService.lua
    MarketService.lua
    KnowledgeService.lua
    AssetValueService.lua

StarterGui/
  VinRouteGui/
    MainHud.client.lua
    PlayerStatus.client.lua
    ResourcePanel.client.lua
    RegionDex.client.lua
    MarketEventPanel.client.lua
    TurnLog.client.lua
    KnowledgeChallenge.client.lua

Workspace/
  VinRouteBoard/
    BoardNodes/
    RouteLines/
    PlayerTokens/
    RegionModels/
```

---

## UI

- メイン3Dボード
- プレイヤーステータス
- 所持資源
- 産地カード図鑑
- 市場イベント表示
- ターンログ
- 知識チャレンジ画面

UIはRobloxのScreenGuiで構成し、ゲーム状態の正本はサーバー側に置く。クライアントはボタン入力と表示に専念する。

---

## 実装順序

1. `RegionData.lua` と20産地ノードを作成
2. `GameState.lua` でプレイヤー状態を定義
3. `TurnService.lua` で2〜4人ターン制を実装
4. `MovementService.lua` でサイコロ移動と到着処理を実装
5. `ResourceService.lua` で資源取得を実装
6. `RegionDex.client.lua` で発見済み産地カードを表示
7. `BuildingService.lua` と `BuildingData.lua` で建設を実装
8. `MarketService.lua` で市場イベントと相場予測カードを実装
9. `KnowledgeService.lua` と `KnowledgeChallenge.client.lua` で三択チャレンジを実装
10. `AssetValueService.lua` でシーズン終了時のランキングを実装

---

## MVPでやらないこと

- 260産地の移植
- AIプレイヤー
- 永続データ保存
- 課金
- 複雑な交渉システム
- 自由入力チャットに依存した取引
- 酒類・飲酒・酩酊表現
