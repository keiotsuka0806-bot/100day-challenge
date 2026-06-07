# Organization Health Report 2026-06-07

## Summary
- total_projects: 10
- shareable_ready: 2
- deploy_ready: 1
- needs_fix: 5

## Status Breakdown
| Status | Count |
| --- | --- |
| 共有可能 | 2 |
| デプロイ済み | 1 |
| 開発中 | 2 |
| 要修正 | 5 |

## Today's Learning
- 組織の方針、部署ルール、Step 0の文脈は versioned にして共有資産にする。秘密情報と端末依存の設定だけ local-only に分ける。

## Shareable Output
- lexworld (共有可能) — https://lexworld-seven.vercel.app
- sound-frame (共有可能) — https://sound-frame-kei-2026.web.app

## Risk Notes
- 共有可能目前のプロジェクトが 1 件ある: tatsuro
- 要修正のプロジェクトが 5 件ある: food-score, mini-kanban, nani-taberu, quote-court, whisky-note
- `CLAUDE.local.md` が存在し、秘密情報の退避先がある
- working tree dirty:
  - M  "\351\201\213\347\224\250\351\203\250/CLAUDE.md"

## Next Best Action
- tatsuro を次に共有可能へ進める
- 推奨コマンド: `cd /Users/kei/dev/100day-challenge && node 運用部/scripts/release-check.mjs --project tatsuro`
