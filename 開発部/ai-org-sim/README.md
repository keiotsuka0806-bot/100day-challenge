# AIOrgSim

「もし○○部を増やしたら？」など組織変更の仮説を入れると、#100Day Challenge の5部署(企画/開発/QA/運用/広報)のキャラがAIの寸劇で組織の未来を演じ、「良い変化/崩れる箇所/結論」を返すアプリ。

- 仕様書: `企画部/specs/2026-06-15-ai-org-sim.md`
- 技術: Vanilla JS フロント + Vercel Serverless Function + Claude API(`claude-opus-4-8`)
- APIキー(`ANTHROPIC_API_KEY`)は Vercel 環境変数で秘匿。クライアントには出さない。

## ローカル開発

```bash
cp .env.local.example .env.local   # ANTHROPIC_API_KEY を記入
vercel dev                          # http://localhost:3000
```

## デプロイ

`server-app-deploy` スキルの手順に従う(Vercel + 環境変数登録)。

```bash
vercel              # プレビュー
vercel --prod       # 本番
```

本番では Vercel の Project Settings > Environment Variables に `ANTHROPIC_API_KEY` を登録すること。

## 設計メモ

- SWは **network-first**(記憶庫 2026-06-14 の教訓。cache-firstだとデプロイしても旧コードを掴む)。
- 出力は Claude の構造化出力(json_schema)で `scenes / good_changes / risks / summary` に固定。
- アイコン(`icon-192.png` / `icon-512.png`)は未配置。共有可能化の前に用意する。
