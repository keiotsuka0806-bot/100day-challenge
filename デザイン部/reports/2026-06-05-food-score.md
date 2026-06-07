# デザイン部レビュー 2026-06-05 FoodScore

## 対象

- プロジェクト: FoodScore
- 友達共有URL: https://food-score-sigma.vercel.app
- 目的: 友達がURLを開いて、APIキー不要で料理写真を採点し、結果を共有できる状態にする

## Webリサーチ要約

- 2026年のモバイルUXでは、初回オンボーディングを短くし、最初の行動までの距離を縮める流れが強い。
- AIアプリでは、AIを前面に出しすぎるより「何をしてくれるか」「どこまで人間の判断を助けるか」が伝わるUIが重要。
- 写真系アプリでは、完璧な加工よりも、人に見せたくなる自然な結果・共有しやすい成果物が価値になりやすい。

参考:
- Mobile app UI/UX design trends 2026: https://www.elinext.com/services/ui-ux-design/trends/key-mobile-app-ui-ux-design-trends/
- Mobile onboarding best practices: https://www.dots-mobile.com/blog-posts/mobile-app-onboarding-best-practices
- 2026 photography trends: https://www.digitalcameraworld.com/tech/artificial-intelligence/the-trend-in-photography-in-2026-will-be-for-less-perfection-and-more-human-and-even-this-ai-focused-software-company-agrees

## Loop 1: First Impression

### 課題

- 初回画面で「友達がAPIキーなしで使える」ことが伝わりにくい。
- Claude / Anthropic 時代の文言が残り、現在のOpenAI構成と矛盾していた。

### 実行

- ファーストビューに短い説明、`APIキー不要`、`約30秒`、`スマホ対応`を追加。
- 古いClaude / Anthropic 表記を削除。
- ローディング文言を「AIが採点中...」へ変更。

## Loop 2: Core Flow

### 課題

- 写真を選ぶ前に、どんな写真を撮ると良いか分からない。
- 写真選択後、次に採点ボタンを押せる状態になったことが弱かった。

### 実行

- 撮影前ヒントとして `真上 or 45度`、`明るい場所`、`皿全体` を追加。
- 写真選択後に「写真を読み込みました。次に採点へ進めます。」を表示。
- API関数名を `callScoringApi()` に変更し、実装意図をOpenAI/Claude非依存に整理。

## Loop 3: Shareability

### 課題

- 共有時の文言が「写真が点数」中心で、FoodScoreを試す導線が弱かった。
- URL共有時のタイトル・説明メタ情報が不足していた。

### 実行

- OGP / description / Twitter card を追加。
- シェア文に `https://food-score-sigma.vercel.app` を追加。
- ボタン文言を「結果をシェア」に変更。
- シェア補助文として「スコア入り画像を作成して共有できます。」を追加。

## 判定

GO。

1日プロジェクトとしては、追加実装よりも「URLを渡された友達が迷わず試せること」を優先した改善ができている。次に深掘りするなら、実機スマホでの写真選択、Web Share API、シェア画像の見切れ確認を重点的に見る。
