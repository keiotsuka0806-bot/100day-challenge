# WorkoutLog 仕様書

## 概要
筋トレ・運動の記録アプリ。種目・セット数・重量・回数を素早く入力し、日々の成長をトラッキング。

## ターゲットユーザー
ジムに通う人、自宅トレーニングをしている人。記録をつけて重量や回数の伸びを実感したい人。

## MVP機能一覧
- [ ] Google ログイン（Firebase Auth）
- [ ] トレーニング種目を選択または自由入力
- [ ] セット・回数・重量を記録
- [ ] 今日のトレーニング一覧表示
- [ ] 過去 7 日分の履歴を日付で参照
- [ ] 種目ごとのベスト記録表示

## 将来拡張（MVP後）
- ボリューム（総重量）のグラフ表示
- 部位別トレーニングカレンダー
- プッシュ通知（今日はまだ記録がないよ！）

## 技術スタック
- フロントエンド: Vanilla JS
- データ: Firebase Firestore + Firebase Auth
- ホスティング: Firebase Hosting
- 特殊ライブラリ: なし

## データモデル
```
Firestore:
workouts/{uid}/{date}/{workoutId}
  - exercise: "ベンチプレス"
  - sets: [{ reps: 10, weight: 60 }, { reps: 8, weight: 65 }]
  - note: "フォームを意識"
  - timestamp: Timestamp
```

## 画面構成
- ログイン画面
- 今日の記録画面: 種目追加ボタン + セットの入力欄
- 種目選択モーダル: よく使う種目リスト + フリー入力
- 履歴画面: 日付別の過去トレーニング

## デプロイ先
- Firebase project: workout-log-100day
- URL: https://workout-log-100day.web.app

## 難度
中（半日）
