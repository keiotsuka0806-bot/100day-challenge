# CLAUDE.md — 企画部

## 役割

アイデアを「作れる仕様」に変換する。実装を始める前に必ずここを通す。

## 朝のフレーズ — 「おはよう」

ユーザーが「おはよう」と言ったら、**その日の10案企画のサマリーを表示する**。
（企画書は前夜に作成済み）

**重要：必ず10案すべてを表示すること。5案や8案で終わらない。**

```
入力: 「おはよう」
処理: specs/YYYY-MM-DD-*.md をすべて読む（10個のファイル）
出力: リスト形式で10案すべてのサマリー表示

例：
# プロジェクト | 難度 | 技術
1 **PomoTimer** — ポモドーロ技法タイマー | 低（1〜2h） | Vanilla JS / localStorage
2 **夕飯ルーレット** — 晩ごはん決定アプリ | 低（1〜2h） | Vanilla JS / 料理JSON
3 **CodeLog** — コード読書メモ | 中（半日） | Vanilla JS / Firebase
4 **1日1枚** — 写真日記 | 中（半日） | Vanilla JS / Firebase
5 **PomoCafe** — ポモドーロ × 環境音 | 低（2〜3h） | Vanilla JS / Web Audio API
6 **TypingZen** — 名言タイピング練習 | 低（2〜3h） | Vanilla JS / 名言JSON
7 **PaletteGen** — 配色パレット生成 | 低（2〜3h） | Vanilla JS
8 **MyCard** — 共有プロフィールカード | 中（半日） | Vanilla JS / Firebase
9 **WordBattle** — しりとり対戦 | 中（半日） | Vanilla JS / 単語辞書
10 **WarikanPro** — 割り勘計算機 | 低（2〜3h） | Vanilla JS / URLシェア

---
**今日のおすすめ**: [Firebase不要でシンプルなもの 2-3個をハイライト]

**すべての10案を表示するまで終わらない。**
```

## 夜のフレーズ — 毎晩0時に自動実行（スケジュール済み）

毎晩深夜0時に自動実行。**明日の10案企画を生成する**。

```
トリガー: 毎晩0時（自動・スケジュール済み）
処理: 明日の日付で10案企画を作成
出力: specs/YYYY-MM-DD-idea1.md
      specs/YYYY-MM-DD-idea2.md
      ...
      specs/YYYY-MM-DD-idea10.md （計10ファイル）
```

**ユーザーが言う必要なし** — CronCreate で設定済み

### 10案の選定基準
- **難度の幅** — 低（1-2時間）5案 + 中（半日）3案 + 高（1日フル）2案
- **多様性** — Web、モバイルアプリ、ツール、ゲームなど様々なジャンル
- **面白さ** — 2-3件は「ユーザーに響きそう」「並行改善の価値あり」と思う企画を混ぜる
- **技術バリエーション** — Vanilla JS、React、Firebase など複数の技術スタックを試す

## 主な業務

1. **朝の10案生成** — ユーザーが「おはよう」と言ったら `specs/` に10ファイル作成
2. **仕様書テンプレート** — 各仕様書に以下を必ず含める
3. **技術選定** — スタック・ライブラリ・Firebase構成を決定
4. **スコープ定義** — MVP（最小限の製品）と将来拡張を明確に分ける

## 仕様書テンプレート

新規プロジェクトの仕様書は以下の構成で `specs/` に保存すること。

```markdown
# [プロジェクト名] 仕様書

## 概要
[1〜2文でアプリの目的を説明]

## ターゲットユーザー
[誰が使うか]

## MVP機能一覧
- [ ] 機能1
- [ ] 機能2
- [ ] 機能3

## 将来拡張（MVP後）
- 機能A
- 機能B

## 技術スタック
- フロントエンド: [Vanilla JS / React / etc.]
- データ: [Firebase / LocalStorage / etc.]
- ホスティング: Firebase Hosting
- 特殊ライブラリ: [必要なもの]

## データモデル
[Firestoreのコレクション構造など]

## 画面構成
[どんな画面があるか]

## デプロイ先
- Firebase project: [project-id]
- URL: https://[project-id].web.app
```

## 技術選定ガイドライン

| 条件 | 選択 |
|------|------|
| シンプルなUI | Vanilla JS + CDN |
| 状態管理が複雑 | React + Vite |
| データ永続化が必要 | Firebase Firestore |
| 認証が必要 | Firebase Auth (Google Sign-In) |
| ファイルアップロード | Firebase Storage or base64 in Firestore |
| オフライン対応 | PWA (manifest + service worker) |

## スコープ判断基準

**MVPに含める**（1日で完成するもの）:
- コアとなる1〜2の主要機能
- 最低限のUI/UX
- Firebase deploy済みの状態

**MVPに含めない**（将来拡張）:
- 設定画面
- 高度なフィルタリング
- ソーシャル機能
- アニメーション凝りすぎ
