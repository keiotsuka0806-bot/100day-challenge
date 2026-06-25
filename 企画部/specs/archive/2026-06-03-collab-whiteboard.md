# CollabWhiteboard 仕様書

## 概要
複数人がリアルタイムで同じキャンバスに落書きできる共有ホワイトボードアプリ。ルームコードで気軽に接続。

## ターゲットユーザー
リモートチームのブレスト・授業・友達との落書き共有。Miro は重すぎる、もっとシンプルなものがほしい人。

## MVP機能一覧
- [ ] ルームコード生成（4 桁）で誰でも参加（認証不要）
- [ ] Canvas でフリーハンド描画
- [ ] 色・太さ選択
- [ ] Firebase Realtime Database でリアルタイム同期
- [ ] 消しゴムツール
- [ ] 全消去ボタン（ルーム内全員に反映）
- [ ] 参加中ユーザー数の表示

## 将来拡張（MVP後）
- テキストツール
- 図形ツール（矩形・円）
- キャンバスをPNGでエクスポート
- ルームのパスワード保護

## 技術スタック
- フロントエンド: Vanilla JS + Canvas API
- データ: Firebase Realtime Database（リアルタイム同期）
- ホスティング: Firebase Hosting
- 特殊ライブラリ: なし

## データモデル
```
Realtime DB:
rooms/{roomId}
  - strokes: [
      { uid, color, width, points: [[x,y],...] }
    ]
  - participants: { uid: { color, lastSeen } }
```

## 画面構成
- ホーム: 「新規ルーム作成」「ルームコードで参加」
- ホワイトボード: 全画面キャンバス + 上部ツールバー + 参加者アバター

## デプロイ先
- Firebase project: collab-whiteboard-100day
- URL: https://collab-whiteboard-100day.web.app

## 難度
高（1日フル）
