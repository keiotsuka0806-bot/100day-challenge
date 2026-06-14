---
name: job-scout
description: 求人スカウトスキル。ランサーズ・クラウドワークス・Upworkから新着の受注案件を検索・スコアリングして日次レポートを生成する。「Job Scout」「Job Scoutして」「案件を探して」「求人スカウト」「受注案件チェック」と言われたときに実行する。※以前は朝会(morning-routine)に含まれていたが、毎朝ではなく依頼時のみ実行する運用に分離した。
---

# Job Scout（求人スカウト）

ランサーズ・クラウドワークス・Upworkの新着案件を探し、スコアリングして日次レポートを出す。
**毎朝の定常実行ではなく、Keiが「Job Scoutして」と頼んだときにだけ動かす**（2026-06-14に朝会から分離）。

## 実行原則（コスト最小）

- WebSearchは**最大5回**に抑える（対話セッション内で実行＝追加課金なし。ヘッドレス/クラウド実行はしない）
- 新着が0件のときも「0件」レポートを残し、`seen-jobs.json` の `last_updated` だけ更新する

## 手順

詳細な検索クエリ・スコアリング基準・レポート書式は `運用部/job-scout/AGENT-PROMPT.md` に従う。要点：

1. `運用部/job-scout/search-config.md` と `運用部/job-scout/seen-jobs.json` を読み、`seen` 配列を既読リストとして把握する
2. AGENT-PROMPT.md の6クエリのうち**5回まで**をWebSearchで実行し、案件タイトル・URL・予算・締切・概要を抽出する
3. `seen` にないURLだけを新着として処理する
4. 新着を3軸（技術適合40% / 予算35% / 締切25%）でスコアリングし、総合3.5未満は掲載しない
5. `運用部/reports/job-scout-YYYY-MM-DD.md` にレポートを保存（書式はAGENT-PROMPT.md準拠。0件時は0件フォーマット）
6. 今回ヒットした全URL（新着・既読とも）を `seen` に追加し、`last_updated` を当日に更新して `運用部/job-scout/seen-jobs.json` を保存

## commit

朝会と同じく**自分が触ったファイルだけ**をスコープでcommitする（`git add -A` は使わない）：

```bash
git commit -m "job-scout: レポート YYYY-MM-DD" -- 運用部/reports/job-scout-YYYY-MM-DD.md 運用部/job-scout/seen-jobs.json
git push
```

> 注: `AGENT-PROMPT.md` 末尾にあるbot用のgit identity設定や `automation-push-main.sh` は旧・自動実行用。対話セッションではKeiの通常のgit設定のまま上記でcommitしてよい。
