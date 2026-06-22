# 組織改善レポート 2026-06-22

## エグゼクティブサマリー
直近1週間は1日1公開を概ね維持（WhenToPing・QRLivePoll改修など）し、3ゲート運用も定着している。一方で「朝会で出した最終3案がそのまま当日の制作物にならない」日が連続しており、企画の生成と“作りたい芯”の接続に弱さがある。さらに**git hygieneチェックが6/15から1週間鳴り続け（オオカミ少年化）**ており、これが今いちばん早く潰すべき技術的負債。

## 分析結果

### スピード・リズム
- 1日1成果のリズムは維持。ただしWhenToPing(6/21)は「朝会の最終3案も追加案も芯が弱く未制作→過去の落選案を引っ張り出して制作」という流れだった。3日連続で“朝会の3案≠制作物”が起きている兆候があり、企画選定が制作の着火に結びついていない。
- 100day repo外（`~/dev/when-to-ping`）での実装が増え、`project-registry.json` 未登録のまま。registry/release-checkの運用ルールが repo外プロジェクトに追従できていない。

### 品質トレンド
- 3ゲート（Genius Council→QA→セキュリティ）は機能。WhenToPellでは曜日の英語混入をQAで捕捉、セキュリティ100/100。QRLivePollでは多重投票/記名流出をFirestoreルールで塞いだ。レビューの“捕まえる力”は健全。
- QA部のreviewログは6/16が最新で、以降はプロジェクト側のGenius Councilレポートに記録が寄っている。QA部としての成果物の置き場が分散気味。

### 技術的観察
- Intl.DateTimeFormat / DeviceMotion / Firestore共有倉庫 / .vercelignoreでのconfig同梱、と再利用可能な型が着実に増えた（本日 reusable-patterns に Intl パターンを追加）。技術資産の蓄積は順調。
- **git hygiene NGの放置が最大の負債**: ①コピーされたスキルカタログ（job-scout/morning-routine/server-app-deploy/weekly-narrative の SKILL.md）がコミット対象 ②`.env.example`/`.env.local.example`（ai-debate-stage・ai-org-sim）がコミット済み。6/15から毎朝NGが鳴り、本物の警告に気づけなくなっている。

### 組織の健全性
- 記憶庫（lessons/patterns/decisions）への蓄積は継続でき、学び優先の原則は守れている。
- 一方で「朝会の企画が制作に乗らない」状態が続くと、企画部の出力が“消化されない在庫”になりモチベーションと意味を損なう。企画の量より「今日これを作りたい」と思える1案の質に重心を移すべき局面。

## 明日のアクションアイテム
1. **【最優先】git hygieneを実際に対処する（追記ではなく実行）**: スキルカタログ4本を `git rm --cached` で追跡から外し（複製なので消えても実体は `.claude/skills/` に残る）、`.env*.example` を `.gitignore` に追加してキャッシュから除外。フックがNGを出さない状態にして“オオカミ少年”を解消する。※Keiに一声かけてから実行。
2. **朝会の出口を「3案」から「今日作る1案の宣言」に締める**: 最終3案を出したら、その場で「どれを today 作るか」をKeiと1往復で確定する運用にし、“朝会の案≠制作物”の連続を断つ。
3. **repo外プロジェクトのregistry運用を1つに決める**: WhenToPing含む `~/dev/` 直下プロジェクトを `project-registry.json` にどう登録/release-checkするかのルールを短く明文化する。
