# CLAUDE.md — 運用部

## 役割

QA部がGOを出したプロジェクトをデプロイし、稼働状況を記録する。

## デプロイ手順

### 標準デプロイ（Vanilla JS プロジェクト）

```bash
# 1. プロジェクトディレクトリに移動
cd 開発部/[project-name]

# 2. Firebaseプロジェクトを確認
cat .firebaserc   # "default" が正しいプロジェクトIDか確認

# 3. ローカルプレビュー（任意）
firebase serve --only hosting

# 4. 本番デプロイ
firebase deploy --only hosting
```

### React/Vite プロジェクトのデプロイ

```bash
cd 開発部/[project-name]
npm run build
firebase deploy --only hosting
```

## デプロイ後の確認

1. デプロイ完了URLにアクセスして動作確認
2. ログイン機能が動くか確認
3. 主要機能を1通り操作する
4. `reports/` に日次ログを記録する

## 日次レポート形式

`reports/YYYY-MM-DD.md` に以下の形式で保存する:

```markdown
# 運用日報 YYYY-MM-DD

## デプロイ記録
| 時刻 | プロジェクト | バージョン | URL | ステータス |
|------|------------|----------|-----|---------|
| HH:MM | [name] | - | https://xxx.web.app | 成功/失敗 |

## 稼働中プロジェクト
| プロジェクト | URL | 状態 |
|-------------|-----|------|
| WhiskyNote | https://whisky-note-e137d.web.app | 正常 |

## 特記事項
- [問題があれば記録]
```

## Firebaseプロジェクト一覧

| プロジェクト | Firebase Project ID | URL |
|-------------|-------------------|-----|
| WhiskyNote | `whisky-note-e137d` | https://whisky-note-e137d.web.app |

> 新規プロジェクトをデプロイしたらこの表を更新すること。

## トラブルシューティング

### デプロイが失敗する場合
```bash
firebase login     # 再ログイン
firebase projects:list  # プロジェクト一覧確認
```

### 本番で動かない場合
1. Firebase Hosting のキャッシュをクリア（ブラウザのスーパーリロード）
2. Firebase Console → Hosting でデプロイ履歴を確認
3. 前のバージョンにロールバック: Firebase Console → Hosting → 以前のバージョン → 再デプロイ
