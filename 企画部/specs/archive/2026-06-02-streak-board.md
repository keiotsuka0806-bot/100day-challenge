# StreakBoard 仕様書

## 概要
毎日の習慣をチェックするだけのシンプルなトラッカー。連続達成日数（ストリーク）をGitHub草風のグリッドで可視化する。

## ターゲットユーザー
毎日の習慣を続けたい人。継続の記録を見て達成感を得たい人。

## MVP機能一覧
- [ ] 習慣を最大5つ登録（名前のみ）
- [ ] 今日のチェックボタン（1タップ）
- [ ] ストリーク日数カウント表示
- [ ] 過去30日のグリッド表示（達成日を色付け）
- [ ] PWA対応（ホーム画面から起動）

## 将来拡張（MVP後）
- リマインダー通知（Push Notification API）
- 習慣ごとの統計グラフ
- 複数ユーザー対応（Firebase Auth）

## 技術スタック
- フロントエンド: Vanilla JS + CDN
- データ: localStorage のみ（Firebaseなし）
- ホスティング: Firebase Hosting
- 特殊ライブラリ: なし

## データモデル
```json
{
  "habits": [
    { "id": "uuid", "name": "筋トレ", "createdAt": "2026-06-02" }
  ],
  "logs": {
    "habitId": ["2026-06-01", "2026-06-02"]
  }
}
```
localStorage キー: `streak_board_v1`

## 画面構成
1. **ホーム** — 習慣リスト + 今日のチェック状態
2. **詳細** — 選択した習慣のグリッドカレンダー + ストリーク数
3. **設定** — 習慣の追加・削除

## デプロイ先
- Firebase project: 新規作成（streak-board）
- URL: https://streak-board.web.app
