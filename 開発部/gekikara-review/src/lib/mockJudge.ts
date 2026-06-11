/**
 * mockJudge.ts — Mock evaluation engine
 *
 * To swap for real AI (OpenAI / Claude):
 * Replace generateReport() body with an API call using the same signature.
 * The rest of the app doesn't care about the implementation.
 */

import type {
  ProjectInput,
  JudgeMode,
  JudgeReport,
  CategoryScore,
  ReviewResult,
} from '@/types/review';

// ─── Analysis signals ────────────────────────────────────────────────────────

interface Signals {
  descLen: number;
  hasNumbers: boolean;
  hasSpecificMetrics: boolean;
  isVague: boolean;
  isOverpromising: boolean;
  priceNum: number;
  isPriceFree: boolean;
  isPriceLow: boolean;
  isPricePremium: boolean;
  hasCompetitorMention: boolean;
  hasTargetClarity: boolean;
  keywordScore: number;
}

function parsePrice(price: string): number {
  const cleaned = price.replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function extractSignals(input: ProjectInput): Signals {
  const text = `${input.description} ${input.notes} ${input.target}`;
  const priceNum = parsePrice(input.price);

  const hasNumbers = /[0-9０-９]/.test(input.description);
  const hasSpecificMetrics = /万円|%|人|件|日|週|月|年|倍|割/.test(text);
  const isVague = input.description.length < 80;
  const isOverpromising = /誰でも|簡単に|すぐに|必ず|保証|絶対|不労|自動で稼/.test(text);
  const hasCompetitorMention = /競合|他社|比較|違い|対して|より/.test(text);
  const hasTargetClarity = input.target.length > 20;

  // Keyword quality score: 0-10
  let keywordScore = 5;
  if (hasSpecificMetrics) keywordScore += 2;
  if (isVague) keywordScore -= 3;
  if (isOverpromising) keywordScore -= 2;
  if (hasCompetitorMention) keywordScore += 1;
  if (hasTargetClarity) keywordScore += 1;
  keywordScore = Math.max(0, Math.min(10, keywordScore));

  return {
    descLen: input.description.length,
    hasNumbers,
    hasSpecificMetrics,
    isVague,
    isOverpromising,
    priceNum,
    isPriceFree: priceNum === 0,
    isPriceLow: priceNum > 0 && priceNum < 1000,
    isPricePremium: priceNum >= 10000,
    hasCompetitorMention,
    hasTargetClarity,
    keywordScore,
  };
}

// ─── Score helpers ───────────────────────────────────────────────────────────

function clamp(n: number, min = 1.0, max = 5.0): number {
  return Math.round(Math.max(min, Math.min(max, n)) * 10) / 10;
}

function verdict(score: number): string {
  if (score >= 4.5) return '優秀';
  if (score >= 3.8) return '合格';
  if (score >= 3.0) return '要改善';
  if (score >= 2.0) return '危険';
  return '論外';
}

// ─── Category builders ───────────────────────────────────────────────────────

function buildUniqueness(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.8;
  if (s.keywordScore >= 7) score += 0.5;
  if (s.isVague) score -= 0.7;
  if (s.hasCompetitorMention) score += 0.3;
  if (s.isOverpromising) score -= 0.4;
  score = clamp(score);

  const low = [
    'ゼロからこれを選ぶ理由が見当たらない。同カテゴリに3つ以上の選択肢がすでに存在する。',
    'コンセプトはありふれている。「新しい」という証拠がどこにもない。',
  ];
  const mid = [
    '差別化ポイントは一応存在する。ただし競合が1週間で真似られる程度の違いだ。',
    `「${input.type}」というカテゴリ自体が成熟しており、後発の独自性主張は相当な根拠が必要。`,
  ];
  const high = [
    '差別化の芽はある。問題はそれを前面に打ち出せていないことだ。',
    '独自性は認められる。ただし、その主張を証明するエビデンスが不足している。',
  ];

  const comments = score < 2.5 ? low : score < 3.5 ? mid : high;
  const comment = comments[Math.floor(score * 100) % comments.length];

  return {
    key: 'uniqueness',
    label: '独自性',
    score,
    verdict: verdict(score),
    comment,
    details: score < 3.0
      ? `説明文を読む限り、既存サービスとの明確な差異が見えない。「なぜこれでないといけないのか」という問いに答えられていない。${s.isVague ? '説明が短すぎて独自性を判断する材料すら足りない。' : ''}`
      : `差別化の方向性は見えているが、具体的な証拠・実績・技術的優位性の提示が不十分。競合比較を明文化すれば説得力が増す。`,
    penalties: [
      s.isVague ? '概要が短すぎて独自性を評価できない' : null,
      !s.hasCompetitorMention ? '競合との比較が全くない' : null,
      s.isOverpromising ? '過剰な約束が独自性への信頼を損なう' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}の独自性を競合と比較した表を作ってください。競合はこのカテゴリ上位3サービスを想定し、価格・機能・ターゲット・差別化ポイントの4軸でマトリクスを作成してください」`,
      `「${input.name}のトップページに『なぜ他の${input.type}ではなくこれなのか』を1文で答えるセクションを追加してください。競合との違いを事実ベースで書き、断言調にしてください」`,
      `「${input.name}の独自性を裏付ける実績・数値・体験談を3つ収集し、それぞれ『事実』『出典または根拠』『読者へのインパクト』の形式で整理してください」`,
    ],
  };
}

function buildMarketability(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.5;
  if (s.hasTargetClarity) score += 0.5;
  if (s.hasSpecificMetrics) score += 0.4;
  if (s.isPriceFree) score += 0.2;
  if (s.isVague) score -= 0.6;
  score = clamp(score);

  return {
    key: 'marketability',
    label: '市場性',
    score,
    verdict: verdict(score),
    comment: score < 2.5
      ? `ターゲットが広すぎるか、存在しないか。「全員に刺さる」は「誰にも刺さらない」と同義。`
      : score < 3.5
      ? `市場はある。ただし「${input.type}」は競争が激化しており、タイミング優位性の説明が必要。`
      : `市場の選定は悪くない。取りに行く層の解像度をもう一段上げれば訴求が鋭くなる。`,
    details: `対象: ${input.target || '（未記入）'}。${s.hasTargetClarity ? 'ターゲット定義は及第点だが' : 'ターゲットが抽象的すぎる。'}市場規模・成長率・購買意欲の高さを定量化できていない。感覚的な「需要ある」では投資家もユーザーも動かない。`,
    penalties: [
      !s.hasTargetClarity ? 'ターゲット定義が曖昧' : null,
      !s.hasSpecificMetrics ? '市場規模を示す数値がゼロ' : null,
      s.isVague ? '説明が少なすぎて市場性を判断できない' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}のターゲット定義を『${input.target || '現在のターゲット'}』からさらに絞り込んでください。年齢・職業・月収・現在の悩み・試したが失敗した方法を含む、150文字のペルソナ文を作成してください」`,
      `「${input.name}が狙う市場について、TAM（全体市場）・SAM（対応可能市場）・SOM（獲得目標）を数値で試算してください。情報源はXのトレンド・note売上ランキング・類似Brain商品の販売数を参考にしてください」`,
      `「競合${input.type}が対応できていないニーズを3つ列挙し、それぞれ『競合の限界』と『${input.name}での解決方法』の形式で整理してください」`,
    ],
  };
}

function buildProfitability(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.8;
  if (s.isPriceFree) score -= 1.2;
  if (s.isPriceLow) score -= 0.5;
  if (s.isPricePremium) score += 0.3;
  if (s.hasSpecificMetrics) score += 0.4;
  score = clamp(score);

  const priceNote = s.isPriceFree
    ? '無料モデルは収益ゼロのリスクを内包する。マネタイズ設計が明示されていない。'
    : s.isPriceLow
    ? `価格${input.price}は低すぎる可能性がある。LTVとCAの試算はあるか？`
    : s.isPricePremium
    ? `価格${input.price}はプレミアム圏。それに見合う価値提示ができているかが全て。`
    : `価格${input.price}は妥当なレンジ。継続課金・アップセルへの設計が見えない。`;

  return {
    key: 'profitability',
    label: '収益性',
    score,
    verdict: verdict(score),
    comment: priceNote,
    details: `収益モデルの設計が表面にしか見えない。単価・購買頻度・LTV・獲得コストの試算なしに「稼げる」と主張するのは根拠薄弱。特に${s.isPriceFree ? '無料提供の場合、どこでマネタイズするかが不明確' : '価格設定の根拠が「競合と同じ」だけでは不十分'}。`,
    penalties: [
      s.isPriceFree ? '収益モデルが不明確' : null,
      !s.hasSpecificMetrics ? '売上・LTV・CAの試算が見えない' : null,
      s.isOverpromising ? '「絶対稼げる」系の主張はむしろ信頼を下げる' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}の収益計画を逆算してください。月間売上目標を30万円と設定した場合、必要な販売数・CVR・流入数をそれぞれ計算し、現在の価格${input.price || '（未設定）'}で達成可能かを判定してください」`,
      `「${input.name}のLTV（顧客生涯価値）を試算してください。初回購入後の追加購入・紹介・SNS拡散の3経路を想定し、1顧客あたりの期待収益を計算してください」`,
      `「${input.name}の収益シナリオを悲観・中立・楽観の3パターンで作成してください。各パターンのCVR・月間訪問者数・単価の前提を明示し、6ヶ月後の累積収益を表形式で出力してください」`,
    ],
  };
}

function buildTrustworthiness(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.6;
  if (s.hasSpecificMetrics) score += 0.6;
  if (s.isOverpromising) score -= 1.0;
  if (s.hasNumbers) score += 0.2;
  if (s.isPricePremium) score -= 0.3;
  score = clamp(score);

  return {
    key: 'trustworthiness',
    label: '信頼性',
    score,
    verdict: verdict(score),
    comment: s.isOverpromising
      ? `「必ず」「誰でも」「簡単に」系のコピーは最速で信頼を失う。現代ユーザーは免疫を持っている。`
      : score < 3.0
      ? `実績・根拠・作者の信頼性を示す情報が不足。「誰が作ったか」が現代では訴求の核になる。`
      : `信頼性の基盤はある。ただし証拠の見せ方を強化しないと埋もれる。`,
    details: `信頼性は「誰が言っているか」×「何を証明できるか」で決まる。現状、作者の実績・使用実績・第三者評価のどれが見えているかを棚卸しする必要がある。${s.isOverpromising ? '過剰なコピーは教材・情報商材ジャンルでは特に警戒される。' : ''}`,
    penalties: [
      s.isOverpromising ? '過剰約束ワードが信頼を著しく損なう' : null,
      !s.hasSpecificMetrics ? '具体的な実績数値がない' : null,
      s.isPricePremium && !s.hasSpecificMetrics ? 'プレミアム価格帯なのに信頼根拠が薄い' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}のLP・販売ページ内にある『誰でも』『必ず』『簡単に』などの過剰約束ワードを全て列挙し、それぞれを『実績ベースの事実表現』に書き換えてください。例：『誰でも月10万』→『受講者○名中△%が90日以内に初収益を達成』」`,
      `「${input.name}の作者・制作者の実績を『期間』『具体的な成果』『数値』の3点セットで3〜5個リストアップし、販売ページのファーストビュー直下に入れる信頼セクションのHTMLを書いてください」`,
      `「${input.name}の購入者・利用者の声を集めるアンケートを設計してください。質問は5問以内、回答結果をそのままLP上の社会的証明として使える形式にしてください」`,
    ],
  };
}

function buildUX(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.7;
  if (input.type === 'アプリ' || input.type === 'SaaS') score -= 0.2;
  if (s.isVague) score -= 0.5;
  if (s.hasTargetClarity) score += 0.3;
  score = clamp(score);

  const typeNote: Record<string, string> = {
    LP: 'LPはファーストビューで全てが決まる。3秒で価値が伝わらなければ離脱される。',
    アプリ: '最初の起動から5分が全て。その間に「使い方がわかった」と思わせられるか。',
    ゲーム: '最初のセッションでリプレイしたいと思わせられるか。チュートリアルの設計が鍵。',
    教材: '購入直後の「どこから始めるか」で実行率が決まる。目次と導線の設計を見直せ。',
    SaaS: 'オンボーディングの摩擦がそのままチャーン率に直結する。',
  };

  return {
    key: 'ux',
    label: 'UX / 分かりやすさ',
    score,
    verdict: verdict(score),
    comment: typeNote[input.type] || '「何ができるか」「誰のためか」「次に何をすれば良いか」この3つが初見で伝わらなければUXは失敗。',
    details: `${input.type}として見たとき、説明の範囲ではUXの設計意図が読み取れない。特に「最初の成功体験に何秒かかるか」という観点が抜け落ちている。ユーザーは「難しそう」と感じた瞬間に離脱する。`,
    penalties: [
      s.isVague ? '説明が少なすぎてUXを評価できない' : null,
      '初回体験のフロー設計が見えない',
      '「詰まりポイント」への対処が記述されていない',
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}のユーザーが購入・登録から最初の成功体験を得るまでのステップを現状と改善案の2バージョンで書いてください。改善案はステップ数を3以内に収め、各ステップの所要時間も明記してください」`,
      `「${input.name}のファーストビューを『誰が』『何のために』『何を得られるか』の3要素が5秒で伝わるキャッチコピー＋サブコピーの組み合わせに書き直してください。現在の文言と並べて比較できる形で3パターン出力してください」`,
      `「${input.name}で初見ユーザーが詰まる可能性のある箇所を3つ特定し、それぞれに対して『エラーメッセージの文言』または『ガイドテキストの追加案』を具体的に書いてください」`,
    ],
  };
}

function buildAppeal(s: Signals, input: ProjectInput): CategoryScore {
  let score = 2.5;
  if (s.hasSpecificMetrics) score += 0.5;
  if (s.isVague) score -= 0.7;
  if (s.isOverpromising) score -= 0.3;
  if (s.hasTargetClarity) score += 0.4;
  score = clamp(score);

  return {
    key: 'appeal',
    label: '訴求力',
    score,
    verdict: verdict(score),
    comment: score < 2.5
      ? '「何がいいのか」が一言で言えない商品は売れない。価値の言語化から始め直しが必要。'
      : score < 3.5
      ? '訴求の軸は存在するが、「この人のための商品だ」と感じさせるまでの解像度がない。'
      : '訴求の方向性は悪くないが、感情を動かすストーリーとエビデンスの組み合わせが弱い。',
    details: `訴求力は「誰のどんな痛みを解決するか」×「なぜ今買うべきか」の掛け算。${s.hasSpecificMetrics ? '数値はあるが' : '数値がなく、'}感情フックが弱い。「読んで終わり」で行動を起こさせるフックがない。`,
    penalties: [
      s.isVague ? 'コピーの材料が薄すぎる' : null,
      !s.hasTargetClarity ? 'ターゲットが曖昧なため訴求が散弾銃になっている' : null,
      s.isOverpromising ? '過剰な言葉で「また怪しいやつ」と思われるリスク' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}のキャッチコピーを『[痛みを抱えた具体的なターゲット]が、[期間]で[数値で示せる成果]を得られる[手段]』の型に当てはめて5パターン作成してください。現在の訴求と何が違うかも説明してください」`,
      `「${input.name}のLPまたは販売ページに、ターゲットが購入前に感じている『Before（現状の痛み）』を描写するセクションを追加してください。箇条書き5項目で、読んだターゲットが『これ自分のことだ』と感じるレベルの具体性で書いてください」`,
      `「${input.name}を購入した後の90日後・180日後・1年後の具体的な変化を数値込みで描写してください。収益・スキル・時間・人間関係など複数軸で変化を示し、LPの『購入後の未来』セクションとして使える文章にしてください」`,
    ],
  };
}

function buildFeasibility(s: Signals, input: ProjectInput): CategoryScore {
  let score = 3.0;
  if (s.hasSpecificMetrics) score += 0.4;
  if (s.isVague) score -= 0.5;
  if (s.isPricePremium && !s.hasSpecificMetrics) score -= 0.5;
  score = clamp(score);

  return {
    key: 'feasibility',
    label: '実行可能性',
    score,
    verdict: verdict(score),
    comment: score < 2.5
      ? '計画の実現可能性に疑問符がつく。リソース・スキル・時間軸の試算が見えない。'
      : score < 3.5
      ? '作ること自体は可能に見える。ただし「作った後に売れるか」の設計が甘い。'
      : '実行の障壁は高くない。問題はスピードと優先順位づけ。',
    details: `${input.type}として実現するための技術・リソース・コストの見積もりが示されていない。「できる」という意思と「できる」という根拠は別物。特に継続運用フェーズの設計が抜けている。`,
    penalties: [
      '運用・保守コストの試算が見えない',
      s.isVague ? '計画が抽象的すぎて実行可能性を判断できない' : null,
    ].filter(Boolean) as string[],
    improvements: [
      `「${input.name}のMVP（最小限の製品）を定義してください。今ある機能・コンテンツのうち、核となる価値を届けるのに不要なものを全て除外し、1週間以内にリリースできる最小構成をリストアップしてください」`,
      `「${input.name}の月次運用コストを試算してください。制作・更新・サポート・広告・ツール費用を時間と金額の両方で見積もり、月間収益と対比した損益分岐点を計算してください」`,
      `「${input.name}が失敗するリスクを技術・市場・運用の3カテゴリで各2つ列挙し、それぞれに対して『検知方法』と『対策（具体的なアクション）』をセットで書いてください」`,
    ],
  };
}

// ─── Mode-specific adjustments ───────────────────────────────────────────────

type CategoryKey = 'uniqueness' | 'marketability' | 'profitability' | 'trustworthiness' | 'ux' | 'appeal' | 'feasibility';

const MODE_WEIGHTS: Record<string, Partial<Record<CategoryKey, number>>> = {
  investor: { marketability: 0.4, profitability: 0.4, feasibility: 0.2, uniqueness: 0.3, trustworthiness: 0.1, ux: -0.1, appeal: 0.1 },
  marketer: { appeal: 0.5, trustworthiness: 0.3, ux: 0.2, marketability: 0.2, uniqueness: 0.1, profitability: 0.0, feasibility: 0.0 },
  ux: { ux: 0.6, appeal: 0.2, trustworthiness: 0.1, feasibility: 0.1, uniqueness: 0.0, marketability: 0.0, profitability: 0.0 },
  user: { trustworthiness: 0.4, ux: 0.4, appeal: 0.3, profitability: 0.1, uniqueness: 0.1, marketability: 0.0, feasibility: 0.0 },
  comprehensive: {},
};

const MODE_LABELS: Record<string, string> = {
  comprehensive: '総合',
  investor: '投資家',
  marketer: 'マーケター',
  ux: 'UX専門家',
  user: '実際のユーザー',
};

const MODE_VERDICTS: Record<string, (overall: number, input: ProjectInput) => string> = {
  comprehensive: (o, i) => o >= 4.0
    ? `「${i.name}」は総合的に見て戦える水準にある。ただし「戦える」と「売れる」は別の話だ。指摘した3点を直せば一段上の評価になる。`
    : o >= 3.0
    ? `「${i.name}」は平均的なプロダクトだ。特筆すべき強みも、致命的な弱みもある。このまま出して「なんとなく売れない」状態になる前に、核となる価値を研ぎ澄ませ。`
    : `率直に言う。「${i.name}」は今の状態では売れない。良いアイデアの芽はあるかもしれないが、完成度が市場の要求水準に届いていない。出す前に根本から見直す勇気を持て。`,

  investor: (o, i) => o >= 4.0
    ? `「${i.name}」はプロダクト品質は認められる。ただし投資家として聞きたいのはTAM・SAM・SOMと出口戦略だ。それが答えられなければ話にならない。`
    : `「${i.name}」に今の段階で投資する理由が見えない。市場性・収益性・スケーラビリティの3点で具体的な数値を出してから出直してほしい。`,

  marketer: (o, i) => o >= 4.0
    ? `「${i.name}」の訴求力は基準を超えている。問題は媒体・タイミング・予算の組み合わせだ。コアメッセージを磨けばCVRはまだ伸びる。`
    : `「${i.name}」の現状のコピーと訴求設計ではコンバージョンは期待できない。「誰の・どんな痛みを・なぜ今解決するか」が一本の筋で貫通していない。`,

  ux: (o, i) => o >= 4.0
    ? `「${i.name}」のUXは及第点だ。初回体験の設計は悪くないが、ユーザーが「また使いたい」と思う仕掛けがまだ弱い。`
    : `「${i.name}」はユーザーを迷子にさせる設計になっている。「次に何をすればいいか」が常に明確でなければ離脱が起きる。まず導線の整理から始めよ。`,

  user: (o, i) => o >= 4.0
    ? `「${i.name}」は買ってもいいと思える水準にある。ただし「なぜ今買うか」の後押しが弱い。期間限定・特典・社会的証明のどれかを強化せよ。`
    : `「${i.name}」は今の状態では買わない。理由は単純で、「自分のためのものだ」という確信が持てないからだ。もっとターゲットを絞って語りかけるべきだ。`,
};

// ─── Main generator ──────────────────────────────────────────────────────────

/**
 * Entry point. Replace this function's body with an API call to use real AI.
 * Signature stays the same: (input, mode) => Promise<JudgeReport>
 */
export async function generateReport(
  input: ProjectInput,
  mode: JudgeMode
): Promise<JudgeReport> {
  // Simulate async (API call latency in real version)
  await new Promise((r) => setTimeout(r, 0));

  const s = extractSignals(input);
  const weights = MODE_WEIGHTS[mode];

  const rawCategories = [
    buildUniqueness(s, input),
    buildMarketability(s, input),
    buildProfitability(s, input),
    buildTrustworthiness(s, input),
    buildUX(s, input),
    buildAppeal(s, input),
    buildFeasibility(s, input),
  ];

  // Apply mode-specific score adjustments
  const categories = rawCategories.map((cat) => {
    const delta = (weights as Record<string, number>)[cat.key] ?? 0;
    return { ...cat, score: clamp(cat.score + delta), verdict: verdict(clamp(cat.score + delta)) };
  });

  const overall = clamp(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  const canCompete = overall >= 3.0;
  const top3 = categories
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((c) => c.improvements[0]);
  // Restore sort order
  categories.sort((a, b) =>
    ['uniqueness','marketability','profitability','trustworthiness','ux','appeal','feasibility']
      .indexOf(a.key) - ['uniqueness','marketability','profitability','trustworthiness','ux','appeal','feasibility'].indexOf(b.key)
  );

  const verdictFn = MODE_VERDICTS[mode];
  const harshVerdict = verdictFn(overall, input);

  const targetHits = [
    s.hasTargetClarity ? `明確なターゲット定義がある層（${input.target.slice(0, 30)}...）` : null,
    s.hasSpecificMetrics ? '具体的な数値・成果に反応する読者' : null,
    `${input.type}に慣れ親しんだユーザー`,
  ].filter(Boolean) as string[];

  const targetMisses = [
    s.isVague ? '今の説明では誰も「自分のことだ」とは思えない' : null,
    s.isOverpromising ? '情報感度の高い・リテラシーの高い読者（過剰コピーで即離脱）' : null,
    !s.hasTargetClarity ? 'ターゲットが曖昧なため、全員に刺さらない可能性がある' : null,
  ].filter(Boolean) as string[];

  const saleReadiness = canCompete
    ? '軽微修正で販売可'
    : '抜本的な見直しが必要';

  const idealState = `「${input.name}」が理想の状態になったとき、ターゲットは一読して「これは自分のためのものだ」と確信し、価格に対して迷わずに意思決定できる。その状態は${canCompete ? '今から3〜5回の改善ループで到達できる範囲にある' : '現状から数週間の本格的な再設計が必要'}。`;

  return {
    mode,
    modeLabel: MODE_LABELS[mode],
    overall,
    overallComment: harshVerdict,
    canCompete,
    canCompeteReason: canCompete
      ? '基本的な要件は満たしている。ただし改善なしでは埋もれる。'
      : '現状では市場で生き残れない。指摘事項の対処が先決。',
    categories,
    harshVerdict,
    top3Fixes: top3,
    targetHits,
    targetMisses,
    saleReadiness,
    idealState,
  };
}

export async function generateAllReports(input: ProjectInput): Promise<ReviewResult> {
  const modes: JudgeMode[] = ['comprehensive', 'investor', 'marketer', 'ux', 'user'];
  const entries = await Promise.all(
    modes.map(async (mode) => [mode, await generateReport(input, mode)] as const)
  );

  return {
    input,
    reports: Object.fromEntries(entries) as ReviewResult['reports'],
    generatedAt: new Date().toISOString(),
  };
}
