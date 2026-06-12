# 学びのログ

技術・設計・運用面で得た知見。「〜だとわかった」「〜が効果的だった」形式で記録。

---

<!-- 形式: ## YYYY-MM-DD
- **[カテゴリ]** 学んだこと（なぜ重要か）
-->

## 2026-06-11
- **[Git]** 追跡済みファイルがあるフォルダを `.gitignore` に入れると、ローカルは更新を無視しクラウド側エージェントはpushし続け、二重の歴史が育つ（記憶庫・運用部で実際に発生。ignoreは「未追跡ファイル」にしか効かない）
- **[組織設計]** 指示ファイル（CLAUDE.md/AGENTS.md）が7箇所に重複し内容ドリフトが発生していた。グローバル設定を正本にし、他は1行ポインタにすると管理コストが消える
- **[環境]** iCloud上のファイルは自動退避でAIが読めなくなることがある。AIが毎回読むファイル（ペルソナ等）はローカル実体に置く
- **[自動化]** 人間が把握できない自動化は「野良AI」になる。夜間ルーティン10本より、朝の対話1セッションの方が安く・速く・理解できる

## 2026-06-10
- **[エージェント設計]** 記憶庫への書き込みだけでは次のエージェント実行に反映されない（2026-06-09「specs連番命名廃止」を決定したが、翌日の企画部エージェントは `idea1〜10` 形式で再生成した。エージェントに伝えるにはCLAUDE.mdへの転記が必要）
- **[Anthropicプラットフォーム]** Claude Agent SDK・ヘッドレスClaude Code・GitHub Actions連携は2026-06-15よりAPIクレジット課金に移行（無制限vibeコーディング終了。100日チャレンジの自動エージェント運用コストを月額ベースで再設計する必要がある）
- **[Firebase]** Firebase AI Logic GAにより、オンデバイス+クラウドハイブリッド推論とSQL Connect（GraphQL不要でSQL直書き）が本番利用可能に（既存Firebaseスタックのまま、AIチャット・推論機能を追加できるオプションが生まれた）

## 2026-06-09
- **[組織設計]** 記憶庫（学びの蓄積ファイル）が存在しないと、AIエージェントはセッションをまたいで同じミスを繰り返す。「学びを蓄積する」を最優先に掲げても、書き込み先がなければ物理的に不可能（Deming: Check フェーズの欠如）
- **[Claude Code]** CLAUDE.mdに記載されたスクリプトが未実装だと、新しいセッションでClaude Codeがそれを実行しようとして失敗する。ドキュメントが実態より先行する状態は「地図と道路が違う」状態。未実装スクリプトには `[未実装]` タグと手動代替3ステップを付けると混乱が防げる
- **[プロセス]** 生産ペース（1日1件）が修正ペースを上回ると、要修正WIPが単調増加する。Ohnoの仕掛品理論：要修正が3件を超えたら新規着手を止めて修正を優先するWIPキャップが有効
- **[企画部]** specs命名をidea1〜10の連番にすると、後から内容が分からず検索・参照コストが上がる。2026-06-04以降で退化が確認された。ファイル名は最初の索引として意味のある名前にする

## 2026-06-07
- **[AI UI]** AI処理中にローディング表示がないと、ユーザーは「壊れた」と判断して離脱する（SoundFrame教訓）。UI状態は「待機中 / 処理中 / 完了 / エラー」の4ステートを必ず設計する
- **[デプロイ]** ゲームアプリはFirebaseよりVercelの方が設定量が少ない（LexWorld教訓）。Vercel SPAフォールバックはvercel.jsonに1行追加するだけ。firebase.jsonのrewrites設定より大幅にシンプル
- **[デプロイ]** vercel.jsonのSPAフォールバックを忘れると、リロード時に404になる。`{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }` を必ず追加する

## 2026-06-06: システム設計・自動化
- **GitHub MCP** `settings.json`に`mcpServers`設定がなくてもdeferred toolsとして組み込み済み。`ToolSearch select:mcp__github__get_issue`などでスキーマを取得してから使う
- **Remote Routine（CCR）** リモートエージェントはローカルファイル・ローカル環境変数に一切アクセス不可。結果の永続化にはgit push（GitHubの認証が必要）かルーティンログUI（`claude.ai/code/routines/{id}`）の2択で設計する
- **git pushのフェイルセーフ** Remote Routineでgit pushが失敗しても処理を止めない設計にする。`git push 2>/dev/null || echo '[INFO] スキップ'` + 最後にレポート全文を出力することでログURLから必ず確認できる
- **Cronタイムゾーン変換** Cron式はUTC固定。JST 0:00 = UTC 15:00 → `0 15 * * *`。ユーザーにJST時刻を確認してから設定する

## 2026-06-05
- **[Firebase]** Vercel Serverless Functionsの環境変数でAPIキーを隠す方法が確立（FoodScore）
- **[Firebase]** インメモリのレート制限は複数インスタンスで機能しない。本格公開前にUpstash RedisまたはFirestoreに移行が必要
- **[Firebase]** base64写真保存はFirestoreの1MBドキュメント上限に要注意（WhiskyNote・FoodScore教訓）。大量の写真を扱うアプリはFirebase Storageへの分離が必要

## 2026-06-05: FoodScore
- **OpenAI Vision** 料理写真のような画像入力アプリでは、画像をCanvasでリサイズしてからbase64化するとAPI送信サイズを抑えられる。
- **APIキー管理** ブラウザからAI APIを直接呼ぶMVPは短時間検証には有効だが、友達共有では危険。Vercel Serverless Function / Firebase Functions / Cloud Runなどを挟んでAPIキーをサーバー側に隠す必要がある。
- **無料枠運用** Firebase FunctionsはBlazeプランが必要になる場合がある。1日プロジェクトで少人数共有するなら、Vercel Serverless Function + 環境変数 + 簡易レート制限が現実的な選択肢になる。
- **デザイン改善** デプロイ後は First Impression / Core Flow / Shareability の3ループで見ると、1日プロジェクトでも友達に渡せる品質へ上げやすい。
- **AIレスポンス処理** JSONのみ返すようプロンプトで指定しても、アプリ側ではJSON抽出・必須項目・点数範囲の検証を入れるべき。
- **日報運用** セッションログと日報の内容がズレると翌日の企画・QA・広報が連鎖的にズレる。Daily Control Sheetを正本として状態を確定する。

## 2026-06-04（追記）
- **gcloud CLI** gcloud CLIが未インストールだとFirestore APIの有効化がコンソール手動になる。Firebase新規プロジェクト作成時は`brew install --cask google-cloud-sdk`→`gcloud auth login`→`gcloud services enable firestore.googleapis.com`の順が確実
- **自動化設計** 並列タブの会話内容はフックでは取れない（フックはシェルコマンドのため）。CLAUDE.mdにClaudeの行動ルールとして書く方が確実
- **日報設計** 「今日の学び」欄はユーザー向け（気づき・感想）とClaude向け（技術的ハマり）を分離する。Claude向けはretrospectiveスキルで記憶庫へ

## 2026-06-04
- **Firebase** Firebase AuthのGoogle プロバイダー有効化はFirebaseコンソールで1回だけ手動操作が必須。APIやCLIでは再現できない（新プロジェクト作成のたびに必要）
- **自動化** エージェントフックは重くてタイムアウトしやすい。複雑なロジックはNode.jsスクリプトに分離し、フックからそのスクリプトを呼ぶ設計にする
- **自動化** Stopフックは「セッション終了」ではなく「Claudeが返答するたび」に発火する。git commitの有無などでフィルタリングが必要
- **Obsidian** `![[]]`エンベッドはVault外のファイルを参照できない。日報などVault内に直接書く方式が最もシンプルで確実
- **スキル設計** SKILL.mdのdescriptionフィールドがスキルの自動起動トリガー。「いつ使うか」「何と言ったら使うか」を具体的に書かないと起動されない
- **セキュリティ** GitHubトークン等の認証情報はチャット欄に貼らない。macOS Keychainに保存し、`claude mcp add`コマンドで登録するのが正しいフロー
- **MCP** Claude CodeのMCPはsettings.jsonの`mcpServers`より`claude mcp add`コマンドで登録する方が確実（`~/.claude.json`に保存される）
- **MCP** Obsidian VaultはmacOSでは`find ~ -name ".obsidian" -type d`で場所を特定できる
- **組織運営** CLAUDE.md はDay2で既にステイルになった（mood-forecastを「空のプレースホルダー」と記述したまま）。プロジェクト完成時に即 CLAUDE.md を更新しないと、次セッションのコンテキスト品質が劣化する。更新はデプロイ直後にやること。
- **組織運営** Firebase skills が `開発部/whisky-note/.agents/skills/` に閉じている。次の Firebase プロジェクトで再ダウンロードが必要になるか、存在を忘れる。org レベル（`開発部/.agents/skills/`）への移動を検討。
- **スタック判断基準** 「認証・クラウド同期が必要か」が vanilla+Firebase vs React+localStorage の分岐点。必要なら vanilla+Firebase（デプロイ速度優先）、不要なら React+Vite（npm依存が必要な時）。この基準を最初に確認することで迷いゼロにできる。

## 2026-06-01
- **Firebase Auth** `onAuthStateChanged` が発火する前に Firestore を呼ぶと `permission-denied` が出る。Auth リスナーの内側でのみ Firestore アクセスを開始すること。
- **Firebase Auth** Google Sign-In の popup は mobile Safari で失敗することがある（クロスオリジンポップアップブロック）。モバイル向けには `signInWithRedirect` へのフォールバックを検討すること。
- **Firestore** base64 data URL で写真を Firestore document に保存するとサイズが 1MB 上限に近づく。写真があるアプリは早めに Firebase Storage への移行を計画すること（whisky-note は現時点で上限接近リスクあり）。
- **Firestore** `onSnapshot` リスナーは `auth.onAuthStateChanged` でユーザーがログアウトした際に必ず detach すること。detach しないとメモリリーク＋ログアウト後も古いデータが残る。
- **Vanilla JS SPA** DOM 要素に `addEventListener` を複数回呼ぶと重複リスナーが積まれる。要素を `cloneNode(true)` して置き換えることで既存リスナーをすべて剥がせる（whisky-note の `setupTagList()` がこのパターン）。
- **PWA / HEIC** iOS のカメラ写真は HEIC 形式で渡される場合がある。`heic2any` ライブラリで JPEG に変換してから Canvas リサイズ処理に渡すこと。ただし heic2any は CDN 配信のみ（npm ビルドなし環境でも使える）。

