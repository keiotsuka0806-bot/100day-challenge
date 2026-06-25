# SoundFrame — 仕様書

**作成日**: 2026-06-06  
**ステータス**: 開発中

## 概要

MP3（または任意の音声ファイル）と静止画像を組み合わせて、MP4動画を生成するWebアプリ。  
処理はすべてブラウザ内（FFmpeg.wasm）で完結し、ファイルは外部に送信されない。

## ユースケース

- 音楽に合うカバー画像を付けてSNS投稿用MP4を作りたい
- ポッドキャスト音源をYouTube用動画に変換したい
- 友人の写真と思い出のBGMを組み合わせたい

## 技術仕様

| 項目 | 内容 |
|------|------|
| フロントエンド | Vanilla JS + CSS |
| 変換エンジン | FFmpeg.wasm v0.11.6 (WebAssembly) |
| 入力 | 画像: JPG/PNG/WebP/GIF、音声: MP3/AAC/WAV/FLAC |
| 出力 | MP4 (H.264映像 + AAC音声 192kbps) |
| ホスティング | Firebase Hosting |
| PWA | manifest.json + service worker |

## FFmpegコマンド

```bash
ffmpeg -loop 1 -i <image> -i <audio> \
  -c:v libx264 -tune stillimage \
  -c:a aac -b:a 192k \
  -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -movflags +faststart \
  -shortest output.mp4
```

## MVP機能

- [x] 画像・音声のドラッグ&ドロップ / クリック選択
- [x] 画像プレビュー表示
- [x] 音声ファイルの長さ・サイズ表示
- [x] 変換進捗バー
- [x] MP4ダウンロード
- [x] リセット機能

## 非機能要件

- 初回FFmepgロード: 約20MB（CDN）
- プライバシー: ファイル非送信を明示
- レスポンシブ: モバイル対応

## 将来の拡張候補

- 音量調整スライダー
- 出力解像度選択（720p / 1080p）
- 複数画像スライドショー
- テキストオーバーレイ（タイトル表示）
