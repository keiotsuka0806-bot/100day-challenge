# Release Fix nani-taberu

## Status
Open

## 作成日
2026-06-06

## 失敗項目

### Genius Council report exists
- Detail: missing
- Next Action: Genius Councilを実行し、レポートを生成する。

### GC-L1 closed
- Detail: Missing
- Next Action: 該当GCタスクを実装するか、明確な見送り理由を記録する。

### GC-L2 closed
- Detail: Missing
- Next Action: 該当GCタスクを実装するか、明確な見送り理由を記録する。

### GC-L3 closed
- Detail: Missing
- Next Action: 該当GCタスクを実装するか、明確な見送り理由を記録する。

### Genius Council score >= 12
- Detail: total=0; GC-L1=0; GC-L2=0; GC-L3=0
- Next Action: Genius Councilを実行し、レポートを生成する。

## 完了条件
- `node 運用部/scripts/release-check.mjs --project [project-name]` が通る
- 必要に応じて `--visual` 付きでも通る
