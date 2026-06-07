#!/bin/bash
# 企画部 毎朝アイデア生成 — 毎朝3:03に実行

WORKDIR="/Users/kei/dev/100day-challenge"
LOGFILE="$WORKDIR/運用部/logs/routine-kikakubu.log"
CLAUDE="/Users/kei/.local/bin/claude"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 企画部ルーティン 開始" >> "$LOGFILE"

cd "$WORKDIR"

"$CLAUDE" --print --permission-mode bypassPermissions -p "あなたは#100Day Challenge の企画部です。翌日の企画10案を生成するタスクです。

## Step 1: トレンドリサーチ（必須・スキップ不可）
以下をWebSearchで調査し、今のトレンドを把握してください：
- site:qiita.com 作ってみた 2025 で人気記事を確認
- site:zenn.dev 個人開発 2025 でトレンドを確認
- GitHub trending Japan でスター急上昇リポジトリを確認
- Product Hunt top products this week で注目プロダクトを確認

## Step 2: 既存企画を確認（重複回避）
企画部/specs/ のファイル一覧を確認し、直近14日の企画テーマと重複しないようにすること。

## Step 3: 翌日の企画10案を生成
翌日の日付（YYYY-MM-DD）で 企画部/specs/YYYY-MM-DD-idea1.md 〜 idea10.md を作成。

各ファイルのフォーマット：
# [企画名]（[英語名]）

## 概要
[1〜2文]

## MVP機能
- 機能1
- 機能2
- 機能3

## 技術スタック
- フロントエンド: [Vanilla JS / React / etc.]
- データ: [Firebase / localStorage / etc.]
- 特殊ライブラリ: [なし or ライブラリ名]

## 難度
**[低（1〜2h）/ 中（半日）/ 高（1日フル）]**

## 備考
[補足]

選定基準：
- 難度バランス: 低5案 + 中3案 + 高2案
- トレンド反映: リサーチ結果を2〜3案に反映
- 重複回避: 直近14日の企画と同じテーマを避ける
- AI活用: 2〜3案はClaude APIを使う企画を含める

## Step 4: GitHubにpush
git add して git commit して git push すること。" >> "$LOGFILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 企画部ルーティン 完了" >> "$LOGFILE"
