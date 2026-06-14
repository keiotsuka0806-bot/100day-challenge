# VinRoute Roblox MVP

Roblox Studioに移植するためのLuauスクリプト一式です。

## 方針

- 酒類・飲酒・酩酊表現は使わない
- テーマはブドウ文化、ヴィンテージクラフト、産地交易、文化資産
- サーバーをゲーム状態の正本にする
- クライアントはUI表示と入力送信に専念する

## Roblox Studioへの配置

このフォルダ内の構成を、Roblox StudioのExplorerへ同じ名前で作成してください。

```text
ReplicatedStorage/VinRoute/Shared/*.lua
ServerScriptService/VinRouteServer/*.lua
StarterGui/VinRouteGui/*.lua
Workspace/VinRouteBoard/
```

`ReplicatedStorage/VinRoute/Remotes` には `GameServer.server.lua` が起動時にRemoteEventを自動生成します。

## テスト手順

1. Roblox Studioで空のBaseplateを作る
2. Explorerに `ReplicatedStorage/VinRoute/Shared` を作り、Shared配下のModuleScriptを配置する
3. `ServerScriptService/VinRouteServer` を作り、サーバースクリプトとModuleScriptを配置する
4. `StarterGui/VinRouteGui` を作り、`*.client.lua` をLocalScriptとして配置する
5. `Workspace/VinRouteBoard` を作り、`BoardBuilder.server.lua` をScriptとして配置する
6. StudioのTestから `Start Server` で2〜4人を起動する

MVPは2人以上で自動開始します。1人のSoloテストではWaiting状態のままになります。

## MVP実装範囲

- 20産地データ
- 2〜4人ターン制
- サイコロ移動
- 到着時の資源取得
- 産地カード発見
- 畑 / 工房 / セラー建設
- 市場イベント
- 相場予測カード
- 三択の知識チャレンジ
- シーズン終了時の資産ランキング
