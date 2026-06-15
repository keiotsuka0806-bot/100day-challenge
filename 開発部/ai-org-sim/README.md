# AIOrgSim — AI組織ワークフロー設計ツール

AI組織を画面上で組み立て、**部署(ノード)と情報の流れ(矢印)を編集すると、構造変化の影響をシミュレートする**ツール。寸劇生成アプリではなく「組織構造そのものを触れる」体験を狙う。

- 仕様書: `企画部/specs/2026-06-15-ai-org-sim.md`
- 技術: **React + Vite + TypeScript + React Flow(@xyflow/react)**。AI分析(任意)は Vercel Function + OpenAI API。
- シミュレーションは**既定でモック**(グラフ構造から決定的に分析)。APIキー無しでも動く。

## 3カラム構成

- 左: 部署の追加・削除 / 接続の追加
- 中央: 組織図キャンバス(ドラッグ移動・点と点をつないで接続)
- 右: シミュレーション実行と結果(全体変化 / 情報フロー / ボトルネック / 各部署の反応 / 改善提案)

## ローカル開発

```bash
npm install
npm run dev        # http://localhost:3000(モードはモック=キー不要)
```

## AI分析モード(任意)

右パネルの「AIで分析」をONにすると `/api/simulate`(OpenAI)を呼ぶ。これは `vercel dev` か本番デプロイ時のみ有効で、失敗/未設定なら自動でモックに戻る。

```bash
cp .env.local.example .env.local   # OPENAI_API_KEY を記入(保管庫 ~/.secrets/keys.env から)
vercel dev
```

## デプロイ

Vercel(framework=vite を自動検出)。本番では Project Settings > Environment Variables に `OPENAI_API_KEY` を登録。`server-app-deploy` スキル参照。

## 設計メモ

- 当初は「組織変更を寸劇で出すアプリ」→ 2026-06-15に「組織図を編集して構造影響をシミュレートするツール」へ方針転換。
- モックシミュレーションは入次数/出次数・孤立・行き止まり・サイクル(改善ループ)などグラフ構造から所見を導く(`src/sim/simulate.ts`)。
- ドラッグ&ドロップ等の複雑UIのため Vanilla ではなく React+Vite を採用(社の基準: 複雑な状態管理が要るとき)。
