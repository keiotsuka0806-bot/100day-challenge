# MoneyNote 仕様書

## 概要
シンプルな家計簿アプリ。支出をカテゴリ別に記録し、当月の合計と内訳を即座に把握できる。

## ターゲットユーザー
家計を把握したい一人暮らし・カップル。複雑な機能は不要、記録と集計だけほしい人。

## MVP機能一覧
- [ ] Google ログイン（Firebase Auth）
- [ ] 支出を入力（金額 / カテゴリ / メモ）
- [ ] カテゴリ: 食費・交通・娯楽・日用品・その他
- [ ] 今月の合計金額と残り（予算から計算）
- [ ] カテゴリ別内訳を円グラフで表示
- [ ] 日別リストで入力履歴を確認

## 将来拡張（MVP後）
- 月別推移グラフ
- 収入の記録（収支管理）
- レシート写真の添付

## 技術スタック
- フロントエンド: Vanilla JS
- データ: Firebase Firestore + Firebase Auth
- ホスティング: Firebase Hosting
- 特殊ライブラリ: Chart.js（CDN）

## データモデル
```
Firestore:
expenses/{uid}/{expenseId}
  - amount: 1200
  - category: "食費"
  - memo: "コンビニ"
  - date: "2026-06-03"
  - timestamp: Timestamp

settings/{uid}
  - monthlyBudget: 150000
```

## 画面構成
- 入力画面（デフォルト）: 金額入力 + カテゴリ選択 + 追加ボタン
- サマリー: 今月合計 + 円グラフ + カテゴリ別金額
- 履歴: 日付グループで支出一覧

## デプロイ先
- Firebase project: money-note-100day
- URL: https://money-note-100day.web.app

## 難度
中（半日）
