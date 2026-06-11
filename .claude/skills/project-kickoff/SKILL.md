---
name: project-kickoff
description: 新プロジェクトを即座にキックオフするスキル。仕様書を読んでフォルダ・HTML・JS・CSS・PWA設定・Firebase設定を一括生成する。「キックオフして」「プロジェクト始めて」「実装開始」「今日の企画を始める」「[プロジェクト名]を作り始める」と言ったら使う。仕様書が決まった直後に積極的に起動する。
---

# Project Kickoff

仕様書から開発部のプロジェクト一式を生成する。

## 手順

### Step 1: 仕様書を特定する

ユーザーがプロジェクト名・仕様書ファイル名を言った場合はそれを使う。言わなかった場合は `企画部/specs/` から今日の日付のファイルを探し、選定済みのものを確認する。

```bash
ls 企画部/specs/ | grep $(date '+%Y-%m-%d')
```

仕様書を読んで以下を把握する：
- プロジェクト名（英語スラッグ・日本語名）
- 概要・MVP機能
- 技術スタック（Vanilla JS / React+Vite / Firebaseの有無）
- 主要画面・UI要素

### Step 2: ディレクトリ構造を作成する

```
開発部/[project-name]/
├── index.html
├── app.js
├── styles.css
├── manifest.json
├── service-worker.js
├── firebase.json       ← Firebase使用時のみ
└── .firebaserc         ← Firebase使用時のみ
```

### Step 3: 各ファイルを生成する

#### index.html
- 仕様書のUI要素・画面構成をHTML構造として実装
- Firebase CDN（使用時）: `firebase-app-compat` + `firebase-auth-compat` + `firebase-firestore-compat`
- PWA: `<link rel="manifest">` + `<meta name="theme-color">`
- app.jsをdeferで読み込む

#### app.js
- 仕様書のMVP機能をすべて実装するスターターコード
- Firebase初期化（使用時）・Auth・Firestoreのboilerplate
- 主要な関数の骨格（中身は`// TODO`で印をつけてもよいが、できるだけ実装する）

#### styles.css
- モバイルファースト
- CSS変数でカラーパレットを定義（`--primary`, `--bg`, `--text`等）
- 仕様書のUIイメージに合ったスタイル

#### manifest.json
```json
{
  "name": "[日本語アプリ名]",
  "short_name": "[短縮名]",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#[bg色]",
  "theme_color": "#[theme色]",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### service-worker.js
```js
const CACHE = 'v1';
const ASSETS = ['/', '/index.html', '/app.js', '/styles.css'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
```

#### firebase.json（Firebase使用時）
```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

#### .firebaserc（Firebase使用時）
```json
{
  "projects": {
    "default": "[project-id]"
  }
}
```
※ project-idはユーザーに確認するか、`[project-name]-[4桁数字]` のプレースホルダーにしておく。

### Step 4: CLAUDE.md のプロジェクト表を更新する

本社 `CLAUDE.md` のプロジェクト一覧テーブルに新行を追加する：
```
| [プロジェクト名] | `開発部/[name]/` | 開発中 | [技術スタック] |
```

### Step 5: 完了報告

生成したファイル一覧と次のアクションを伝える：

```
✅ [プロジェクト名] キックオフ完了

生成ファイル:
- 開発部/[name]/index.html
- 開発部/[name]/app.js
- 開発部/[name]/styles.css
- 開発部/[name]/manifest.json
- 開発部/[name]/service-worker.js

次のステップ:
1. firebase serve --only hosting でローカル確認
2. 実装を進める（app.jsのTODO部分）
3. 完成したら firebase deploy
```

## 重要な判断基準

**技術選定**:
- 認証・DB不要 → Vanilla JS + localStorage のみ（Firebase不要）
- 認証またはDB必要 → Vanilla JS + Firebase
- 複雑な状態管理が必要 → React + Vite（ビルドステップ許容）

**実装の深さ**:
- スターターコードは「動く状態」まで実装する。空の関数だけ作って終わりにしない
- ログイン画面・メイン画面の切り替えロジックまで実装する
- Firebaseのonsnapshotとローカル状態の接続まで実装する

**Firebase project-id**:
- `.firebaserc` の `default` に入れるIDは、後でユーザーが `firebase init` または `firebase use --add` で設定する
- プレースホルダー `"[project-name]-xxxx"` を入れておいて、コメントで「要変更」と書く
