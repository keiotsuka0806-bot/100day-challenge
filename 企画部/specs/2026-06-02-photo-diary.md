# 1日1枚 仕様書

## 概要
1日に1枚だけ写真を投稿できるシンプルな日記アプリ。多投稿禁止・1行コメントのみという制約が「毎日続けやすさ」を生む。

## ターゲットユーザー
日々の記録を続けたいが、SNSのような複雑な操作が苦手な人。シンプルな写真日記をつけたい人。

## MVP機能一覧
- [ ] 1日1枚の写真 + 1行テキスト投稿
- [ ] 2枚目の投稿をブロック（今日の投稿済み表示）
- [ ] 過去の投稿をカレンダービューで振り返り
- [ ] Googleログイン（Firebase Auth）
- [ ] PWA対応

## 将来拡張（MVP後）
- フォロー機能（友人の投稿を見る）
- 年間ハイライト自動生成
- 写真のエクスポート（ZIP）

## 技術スタック
- フロントエンド: Vanilla JS + CDN
- データ: Firebase Firestore（base64画像保存）
- 認証: Firebase Auth (Google Sign-In)
- ホスティング: Firebase Hosting
- 特殊ライブラリ: なし（Canvas APIでリサイズ）

## データモデル
Firestoreコレクション: `diaryEntries/{uid}/entries/{YYYY-MM-DD}`
```json
{
  "photo": "data:image/jpeg;base64,...",
  "comment": "今日の夕焼けがきれいだった",
  "createdAt": "timestamp"
}
```
ドキュメントIDをYYYY-MM-DDにすることで1日1件を強制。

## 画面構成
1. **ログイン画面**
2. **ホーム** — 今日の投稿欄 + 最近の投稿3件
3. **カレンダー** — 月ごとのサムネイルカレンダー
4. **投稿詳細** — 写真フルサイズ + コメント

## デプロイ先
- Firebase project: 新規作成（daily-one-photo）
- URL: https://daily-one-photo.web.app
