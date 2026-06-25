# LinkBoard 仕様書

## 概要
「後で読む」リンクをタグ付きで保存し、カード形式で管理するブックマークアプリ。OGP 自動取得でリッチに表示。

## ターゲットユーザー
気になった記事やサイトをストックしたいエンジニア・リサーチャー。ブラウザのブックマークが溢れている人。

## MVP機能一覧
- [ ] Google ログイン（Firebase Auth）
- [ ] URL を入力してリンクを保存
- [ ] OGP（og:title / og:image）を Cloud Functions で取得してカード表示
- [ ] タグを自由に追加
- [ ] タグ・キーワードで絞り込み
- [ ] 「読んだ」でアーカイブ

## 将来拡張（MVP後）
- Chrome 拡張でワンクリック保存
- AI 要約（OpenAI API）
- 公開コレクション共有

## 技術スタック
- フロントエンド: Vanilla JS
- データ: Firebase Firestore + Firebase Auth
- バックエンド: Firebase Cloud Functions（OGP スクレイピング）
- ホスティング: Firebase Hosting
- 特殊ライブラリ: cheerio（Functions側）

## データモデル
```
Firestore:
links/{uid}/{linkId}
  - url: "https://..."
  - title: "OGP取得タイトル"
  - image: "https://og-image-url..."
  - tags: ["react", "設計"]
  - read: false
  - savedAt: Timestamp
```

## 画面構成
- リスト画面: カードグリッド（タグフィルター付き）
- 追加: URL 入力 → OGP 自動取得 → タグ追加 → 保存
- アーカイブ: 読んだリンク一覧

## デプロイ先
- Firebase project: link-board-100day
- URL: https://link-board-100day.web.app

## 難度
中（半日）
