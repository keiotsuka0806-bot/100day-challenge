# VoiceDiary 仕様書

## 概要
話すだけで日記が書ける音声メモアプリ。Web Speech API で音声をテキスト変換し、Firebase に保存。「書く」ハードルをゼロにする。

## ターゲットユーザー
日記を書きたいが続かない人。移動中や寝る前にサッと記録したい人。タイピングが苦手な人。

## MVP機能一覧
- [ ] Google ログイン（Firebase Auth）
- [ ] マイクボタンで録音開始 → Web Speech API でリアルタイム文字起こし
- [ ] テキストを確認・編集してから保存
- [ ] 今日のエントリーを一覧表示
- [ ] 過去の日記をカレンダーで振り返り
- [ ] 音声録音データも Firebase Storage に保存（再生可能）

## 将来拡張（MVP後）
- キーワード検索
- 感情分析タグ（Claude API）
- PDF エクスポート
- 音声の文字起こし精度向上（Whisper API）

## 技術スタック
- フロントエンド: Vanilla JS
- 音声認識: Web Speech API（SpeechRecognition）
- データ: Firebase Firestore + Firebase Storage + Firebase Auth
- ホスティング: Firebase Hosting
- 特殊ライブラリ: なし

## データモデル
```
Firestore:
diaries/{uid}/{entryId}
  - text: "今日は良い天気で..."
  - audioPath: "voices/{uid}/{entryId}.webm"
  - date: "2026-06-03"
  - timestamp: Timestamp

Firebase Storage:
voices/{uid}/{entryId}.webm
```

## 画面構成
- ホーム: 今日の日記エントリー一覧 + 新規録音ボタン
- 録音画面: マイクアニメーション + リアルタイム文字起こし表示
- 確認・編集: テキスト編集 + 保存 / 破棄
- カレンダー: 月別の記録日をハイライト → タップでその日のエントリーへ

## デプロイ先
- Firebase project: voice-diary-100day
- URL: https://voice-diary-100day.web.app

## 難度
高（1日フル）
