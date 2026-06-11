const WORKFLOW_STEPS = [
  {
    id: 'kikakubu',
    icon: '💡',
    name: '企画部',
    phase: 'STEP 1',
    purpose: 'アイデアを「作れる仕様」に変換する。実装を始める前に必ずここを通す。',
    tasks: [
      'プロジェクト名・目的を1〜2文で言語化する',
      'ターゲットユーザーを具体的に決める',
      'MVP機能を3〜5項目に絞る',
      '技術スタックを選定する（Vanilla JS or React / Firebase or Vercel）',
      'specs/YYYY-MM-DD-[name].md に仕様書を保存する'
    ],
    completionCriteria: [
      'specs/ に仕様書ファイルが存在する',
      'MVP機能一覧が3項目以上書かれている',
      '技術スタックが決定している',
      'ターゲットユーザーが明文化されている'
    ],
    prompts: [
      {
        type: 'ai',
        label: 'Claudeへ投げるプロンプト',
        text: `企画部として、以下のプロジェクトの仕様書を作成してください。

プロジェクト名: {{projectName}}
概要: {{projectDescription}}

以下の形式で 企画部/specs/{{date}}-{{projectSlug}}.md を作成してください：

# {{projectName}} 仕様書

## 概要
[1〜2文でアプリの目的]

## ターゲットユーザー
[誰が使うか]

## MVP機能一覧
- [ ] 機能1
- [ ] 機能2
- [ ] 機能3

## 将来拡張（MVP後）
- 機能A

## 技術スタック
- フロントエンド: Vanilla JS / Firebase CDN
- データ: Firebase Firestore / localStorage
- ホスティング: Firebase Hosting

## データモデル
[Firestoreのコレクション構造]

## 画面構成
[どんな画面があるか]

## デプロイ先
- Firebase project: [project-id]
- URL: https://[project-id].web.app`
      }
    ]
  },
  {
    id: 'kaihatsubu',
    icon: '⚙️',
    name: '開発部',
    phase: 'STEP 2',
    purpose: '仕様書を動くコードに変換する。1日で動くMVPを完成させる。',
    tasks: [
      '開発ディレクトリを作成する（開発部/[name]/）',
      'index.html / styles.css / app.js を実装する',
      'manifest.json + service worker でPWA対応する',
      'Firebase初期設定（.firebaserc / firebase.json）',
      'firebase serve でローカル動作確認する'
    ],
    completionCriteria: [
      '開発部/[name]/ ディレクトリが存在する',
      'firebase serve でエラーなく動作する',
      'MVPの主要機能が一通り動く',
      'manifest.json が存在する'
    ],
    prompts: [
      {
        type: 'command',
        label: 'ディレクトリ作成',
        text: `mkdir -p 開発部/{{projectSlug}}
cd 開発部/{{projectSlug}}`
      },
      {
        type: 'ai',
        label: 'Claudeへ投げるプロンプト',
        text: `開発部として、以下の仕様書に基づいて実装してください。

仕様書: 企画部/specs/{{date}}-{{projectSlug}}.md を読んでください。

実装の優先順位：
1. index.html（全UIマークアップ）
2. styles.css（デザイン）
3. app.js（全ロジック）
4. manifest.json（PWA設定）

ルール：
- Vanilla JS + Firebase CDN のみ使用（npm不要）
- ビルドステップなし
- 日本語UI
- firebase serve でそのまま動くこと

完了したら firebase serve で動作確認してください。`
      }
    ]
  },
  {
    id: 'qabu',
    icon: '🔍',
    name: 'QA部',
    phase: 'STEP 3',
    purpose: 'コードの品質・セキュリティ・バグを確認し、デプロイ前に問題を潰す。',
    tasks: [
      '/code-review を実行する',
      '指摘されたバグ・セキュリティ問題を修正する',
      '主要な操作フローを手動で確認する',
      'モバイル表示を確認する（デベロッパーツール）'
    ],
    completionCriteria: [
      '/code-review で致命的な指摘がない',
      '主要機能が一通り動作する',
      'コンソールエラーが出ていない',
      'モバイルでレイアウトが崩れていない'
    ],
    prompts: [
      {
        type: 'command',
        label: 'コードレビュー実行',
        text: `/code-review`
      },
      {
        type: 'ai',
        label: 'QAチェックプロンプト',
        text: `QA部として、開発部/{{projectSlug}}/ を確認してください。

チェックリスト：
- [ ] XSS脆弱性（innerHTMLに未サニタイズの変数がないか）
- [ ] 認証フローが正常か（ログイン前にデータにアクセスできないか）
- [ ] エラーハンドリング（API失敗時にUIが壊れないか）
- [ ] レスポンシブ（375px幅で確認）
- [ ] PWA manifest が正しいか

問題があれば修正箇所と理由を教えてください。`
      }
    ]
  },
  {
    id: 'deploy',
    icon: '🚀',
    name: 'デプロイ',
    phase: 'STEP 4',
    purpose: '本番環境に公開する。QA通過後に実行する。',
    tasks: [
      '.firebaserc のプロジェクトIDを確認する',
      'firebase deploy --only hosting を実行する',
      '本番URLにアクセスして動作確認する',
      'HTTP 200 が返ることを確認する'
    ],
    completionCriteria: [
      'firebase deploy が成功している',
      '本番URLが HTTP 200 を返す',
      '主要機能が本番で動く'
    ],
    prompts: [
      {
        type: 'command',
        label: 'デプロイ実行',
        text: `cd 開発部/{{projectSlug}}
cat .firebaserc   # プロジェクトIDを確認
firebase deploy --only hosting`
      },
      {
        type: 'command',
        label: '疎通確認',
        text: `# デプロイ完了後に表示される URL にアクセスして確認
# 例: https://your-project-id.web.app`
      }
    ]
  },
  {
    id: 'genius-council',
    icon: '🧠',
    name: 'Genius Council',
    phase: 'STEP 5',
    purpose: 'プロ集団の視点で3ループ改善する。デプロイ完了条件の一部。',
    tasks: [
      'post-deploy-genius-cycle.mjs を実行する',
      'GC-L1（初見体験・コアバリュー）の改善を実施する',
      'GC-L2（専門品質・ドメイン深度）の改善を実施する',
      'GC-L3（リプレイ・シェア・運用）の改善を実施する',
      '改善後に再デプロイする'
    ],
    completionCriteria: [
      'デザイン部/reports/ にGCレポートが存在する',
      'GC-L1 / L2 / L3 の各タスクが Done or Skipped',
      '品質スコア合計12点以上',
      '改善後の本番URLが確認済み'
    ],
    prompts: [
      {
        type: 'command',
        label: 'Genius Council 実行',
        text: `cd /Users/kei/dev/100day-challenge
node 運用部/scripts/post-deploy-genius-cycle.mjs \\
  --project 開発部/{{projectSlug}} \\
  --url https://YOUR_PROJECT_URL.web.app`
      },
      {
        type: 'ai',
        label: '改善実施プロンプト（L1〜L3共通）',
        text: `Genius Councilのレポートを読んで、GC-L1の改善を実施してください。

レポート: デザイン部/reports/{{date}}-{{projectSlug}}-genius-council.md
タスクカード: 運用部/tasks/{{projectSlug}}/GC-L1.md

改善後は firebase deploy --only hosting で再デプロイし、
update-council-task.mjs でタスクをDoneにしてください。

# L2、L3も同様に繰り返す`
      }
    ]
  },
  {
    id: 'release-check',
    icon: '✅',
    name: 'リリースチェック',
    phase: 'STEP 6',
    purpose: '共有可能ゲートを通過する。このチェックが通るまで「共有可能」と言わない。',
    tasks: [
      'release-check.mjs を実行する',
      '失敗した項目を修正する',
      '再度 release-check.mjs を実行して通過を確認する',
      '必要なら --visual オプションでビジュアル確認する'
    ],
    completionCriteria: [
      'release-check.mjs がエラーなし通過',
      '本番URL が HTTP 200',
      'GCスコア合計12点以上',
      'project-registry.json が更新されている'
    ],
    prompts: [
      {
        type: 'command',
        label: 'リリースチェック実行',
        text: `cd /Users/kei/dev/100day-challenge
node 運用部/scripts/release-check.mjs --project {{projectSlug}}`
      },
      {
        type: 'command',
        label: 'ビジュアル確認あり（オプション）',
        text: `node 運用部/scripts/release-check.mjs \\
  --project {{projectSlug}} \\
  --visual`
      }
    ]
  },
  {
    id: 'share',
    icon: '🎉',
    name: '共有可能',
    phase: 'STEP 7',
    purpose: '友達にURLを渡せる状態にする。ここまで来たら1プロジェクト完成。',
    tasks: [
      'sync-project-registry.mjs を実行する',
      '本社 CLAUDE.md のプロジェクト表を更新する（ステータス→共有可能）',
      '運用日報を作成・更新する',
      'Obsidian の日報・プロジェクトノートを更新する'
    ],
    completionCriteria: [
      'project-registry.json の status が「共有可能」',
      '本社 CLAUDE.md のプロジェクト表が更新されている',
      '運用日報に記録されている'
    ],
    prompts: [
      {
        type: 'command',
        label: 'レジストリ同期',
        text: `cd /Users/kei/dev/100day-challenge
node 運用部/scripts/sync-project-registry.mjs`
      },
      {
        type: 'ai',
        label: '日報更新プロンプト',
        text: `日報を更新してください。

本日完成したプロジェクト: {{projectName}}
本番URL: https://YOUR_PROJECT_URL.web.app

以下を更新：
1. 運用部/daily/{{date}}.md
2. /Users/kei/Documents/Kei/100 Day Challenge/日報/{{date}}.md
3. /Users/kei/Documents/Kei/日報/{{date}}.md
4. 本社 CLAUDE.md のプロジェクト表（ステータスを「共有可能」に）
5. project-registry.json の {{projectSlug}} を「共有可能」に更新`
      }
    ]
  }
];
