# 学びのログ

技術・設計・運用面で得た知見。「〜だとわかった」「〜が効果的だった」形式で記録。

---

<!-- 形式: ## YYYY-MM-DD
- **[カテゴリ]** 学んだこと（なぜ重要か）
-->

## 2026-06-04（追記）
- **gcloud CLI** gcloud CLIが未インストールだとFirestore APIの有効化がコンソール手動になる。Firebase新規プロジェクト作成時は`brew install --cask google-cloud-sdk`→`gcloud auth login`→`gcloud services enable firestore.googleapis.com`の順が確実
- **自動化設計** 並列タブの会話内容はフックでは取れない（フックはシェルコマンドのため）。CLAUDE.mdにClaudeの行動ルールとして書く方が確実
- **日報設計** 「今日の学び」欄はユーザー向け（気づき・感想）とClaude向け（技術的ハマり）を分離する。Claude向けはretrospectiveスキルで記憶庫へ

## 2026-06-05: FoodScore
- **OpenAI Vision** 料理写真のような画像入力アプリでは、画像をCanvasでリサイズしてからbase64化するとAPI送信サイズを抑えられる。
- **APIキー管理** ブラウザからAI APIを直接呼ぶMVPは短時間検証には有効だが、友達共有では危険。Vercel Serverless Function / Firebase Functions / Cloud Runなどを挟んでAPIキーをサーバー側に隠す必要がある。
- **無料枠運用** Firebase FunctionsはBlazeプランが必要になる場合がある。1日プロジェクトで少人数共有するなら、Vercel Serverless Function + 環境変数 + 簡易レート制限が現実的な選択肢になる。
- **デザイン改善** デプロイ後は First Impression / Core Flow / Shareability の3ループで見ると、1日プロジェクトでも友達に渡せる品質へ上げやすい。
- **AIレスポンス処理** JSONのみ返すようプロンプトで指定しても、アプリ側ではJSON抽出・必須項目・点数範囲の検証を入れるべき。
- **日報運用** セッションログと日報の内容がズレると翌日の企画・QA・広報が連鎖的にズレる。Daily Control Sheetを正本として状態を確定する。

## 2026-06-06: システム設計・自動化
- **GitHub MCP** `settings.json`に`mcpServers`設定がなくてもdeferred toolsとして組み込み済み。`ToolSearch select:mcp__github__get_issue`などでスキーマを取得してから使う
- **Remote Routine（CCR）** リモートエージェントはローカルファイル・ローカル環境変数に一切アクセス不可。結果の永続化にはgit push（GitHubの認証が必要）かルーティンログUI（`claude.ai/code/routines/{id}`）の2択で設計する
- **git pushのフェイルセーフ** Remote Routineでgit pushが失敗しても処理を止めない設計にする。`git push 2>/dev/null || echo '[INFO] スキップ'` + 最後にレポート全文を出力することでログURLから必ず確認できる
- **Cronタイムゾーン変換** Cron式はUTC固定。JST 0:00 = UTC 15:00 → `0 15 * * *`。ユーザーにJST時刻を確認してから設定する

## 2026-06-04
- **Firebase** Firebase AuthのGoogle プロバイダー有効化はFirebaseコンソールで1回だけ手動操作が必須。APIやCLIでは再現できない（新プロジェクト作成のたびに必要）
- **自動化** エージェントフックは重くてタイムアウトしやすい。複雑なロジックはNode.jsスクリプトに分離し、フックからそのスクリプトを呼ぶ設計にする
- **自動化** Stopフックは「セッション終了」ではなく「Claudeが返答するたび」に発火する。git commitの有無などでフィルタリングが必要
- **Obsidian** `![[]]`エンベッドはVault外のファイルを参照できない。日報などVault内に直接書く方式が最もシンプルで確実
- **スキル設計** SKILL.mdのdescriptionフィールドがスキルの自動起動トリガー。「いつ使うか」「何と言ったら使うか」を具体的に書かないと起動されない
- **セキュリティ** GitHubトークン等の認証情報はチャット欄に貼らない。macOS Keychainに保存し、`claude mcp add`コマンドで登録するのが正しいフロー
- **MCP** Claude CodeのMCPはsettings.jsonの`mcpServers`より`claude mcp add`コマンドで登録する方が確実（`~/.claude.json`に保存される）
- **MCP** Obsidian VaultはmacOSでは`find ~ -name ".obsidian" -type d`で場所を特定できる
