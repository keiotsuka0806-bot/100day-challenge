import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ReviewResult, JudgeMode, ProjectType } from '@/types/review';

function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  // Block localhost and private/link-local ranges
  if (host === 'localhost' || host === '0.0.0.0') return false;
  if (/^127\./.test(host) || /^10\./.test(host)) return false;
  if (/^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '[::1]' || host.endsWith('.local')) return false;
  // Block IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 → loopback)
  if (/^\[::ffff:/i.test(host)) return false;
  return true;
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000);
}

const CATEGORY_KEYS = [
  { key: 'uniqueness', label: '独自性' },
  { key: 'marketability', label: '市場性' },
  { key: 'profitability', label: '収益性' },
  { key: 'trustworthiness', label: '信頼性' },
  { key: 'ux', label: 'UX / 分かりやすさ' },
  { key: 'appeal', label: '訴求力' },
  { key: 'feasibility', label: '実行可能性' },
];

const MODES: { mode: JudgeMode; label: string; focus: string }[] = [
  { mode: 'comprehensive', label: '総合', focus: '全評価軸をバランスよく評価する' },
  { mode: 'investor', label: '投資家', focus: '市場性・収益性・スケーラビリティを重視する' },
  { mode: 'marketer', label: 'マーケター', focus: '訴求力・導線・ターゲット精度を重視する' },
  { mode: 'ux', label: 'UX専門家', focus: 'UX・分かりやすさ・初回体験を重視する' },
  { mode: 'user', label: '実際のユーザー', focus: '信頼性・UX・「本当に買うか」を重視する' },
];

function buildPrompt(pageText: string, mode: { mode: JudgeMode; label: string; focus: string }): { system: string; user: string } {
  const system = `あなたはWebページの弱点を診断し、その弱点を直接解消する改善指示を生成する専門家AIです。

【最重要ルール — 違反すると出力全体が無効】
improvements の各項目は、必ず同じカテゴリの penalties（減点理由）のうち少なくとも1つを解消する変更でなければならない。
penalties と無関係な改善を書くことは禁止。

【カテゴリ別・許される改善の種類】
improvements はカテゴリの本質的な問題に応じた変更であること：

- 独自性: 他ツールとの違いを明示するコピー・比較・強調の追加。「他にもあるよね」と思われている弱点を潰す。
- 市場性: 誰のためのツールかを明確にするターゲット文言の追加・修正。「自分向けか分からない」を解消する。
- 収益性: 価格・有料プラン・CTAの追加や強化。無料→有料への導線。「お金を払う理由」の明示。
- 信頼性: 実績・根拠・評価ロジックの透明化。「本当に正確なの?」という疑念を潰すセクション・バッジの追加。
- UX: 特定のフロー上の摩擦を取り除く変更。ラベル・エラー表示・ステップ数の改善。「どうすればいいか分からない」を解消する。
- 訴求力: ファーストビューで「これは自分向けだ」と伝わるヘッドライン・ベネフィット・キャッチの改善。
- 実行可能性: 制限・動作条件・現状の正直な説明の追加。「期待を裏切らないための」透明性確保。

【ブランド保護ルール】
ページのトーン・コンセプト・個性を薄める変更は禁止。
例：「激辛」「辛口」「容赦なく」というコンセプトを、「優しく」「丁寧に」方向へ変えるリライトは即禁止。
強みはそのまま残し、弱点だけを補強する。

【形式ルール】
各 improvement は次のどれかの形で書く：
A. 「[ページの実際のテキスト引用]を、[具体的な改善理由を踏まえて]〜〜の形に書き直してください」
B. 「[ページの特定のセクション/要素名]の直下に、[具体的な内容]を追加してください。[形式・条件]」
C. 「[ページの特定の要素]を削除し、代わりに[具体的な代替]を置いてください。理由：[penalties の文言]」

【禁止リスト】
- ペルソナ設定・競合分析・キャンペーン提案
- 「ユーザビリティを向上させてください」などの抽象的品質向上
- ページの引用なしで場所が特定できない指示
- 「フィードバックを集める」「ユーザー調査をする」などの運用提案
- penalties に書かれていない新しい問題への指摘`;

  const user = `あなたは「${mode.label}」の立場でレビューします。評価基準: ${mode.focus}

以下のウェブページの内容を読んで徹底的に辛口評価してください。

---
${pageText}
---

以下のJSON形式"のみ"で返してください（コードブロック・説明文は不要）：
{
  "productName": "プロダクト名（ページから読み取る）",
  "productType": "LP または アプリ または ゲーム または 教材 または note または Brain または SaaS または その他",
  "price": "価格（不明なら空文字）",
  "target": "ターゲットユーザー（ページから推測、30文字以内）",
  "description": "プロダクト概要（ページの内容を2〜3文で要約）",
  "overall": 3.2,
  "canCompete": true,
  "canCompeteReason": "理由を一文で",
  "harshVerdict": "激辛総評を2〜3文で",
  "top3Fixes": ["今すぐ直すべき点1", "点2", "点3"],
  "targetHits": ["刺さる読者1", "刺さる読者2"],
  "targetMisses": ["刺さらない読者1", "刺さらない読者2"],
  "saleReadiness": "軽微修正で販売可 または 抜本的な見直しが必要",
  "idealState": "改善後の理想状態を一文で",
  "categories": [
    {
      "key": "uniqueness",
      "label": "独自性",
      "score": 3.1,
      "verdict": "要改善",
      "comment": "一言辛口コメント（40文字以内）",
      "details": "詳細評価（80〜120文字）",
      "penalties": [
        "同種ツールとの違いがページのどこにも書かれていない",
        "『AIが評価』という説明だけでは他社との差別化にならない"
      ],
      "improvements": [
        "penalties[0]を解消: ページの見出し『〇〇』の直下に、このツール固有の特徴（例：『5つの審査員視点で同時採点』『容赦なし・お世辞なしのAI評価』）を箇条書き3点で追加してください",
        "penalties[1]を解消: 『AIが評価』という文言を、具体的な仕組みが伝わる『OpenAI GPT-4o-miniが5つの審査員ペルソナで並列分析』のような表現に書き直してください",
        "独自性を強化: ファーストビューの〇〇セクションに、競合にはない『激辛度』を数値で示すバッジ（例：『辛口指数 MAX 🌶×5』）を追加してください"
      ]
    },
    {
      "key": "marketability",
      "label": "市場性",
      "score": 0, "verdict": "要改善", "comment": "", "details": "",
      "penalties": ["ターゲットが誰か1行も書かれていない"],
      "improvements": [
        "penalties[0]を解消: ページ冒頭の説明文『〇〇』を、ターゲット（LP制作者・個人開発者・コンテンツ販売者など具体的な職種）を明示した文に書き直してください",
        "ターゲット明示: 入力フォームの上に『LP・Brain・noteを販売する個人クリエイター向け』のような1行タグラインを追加してください",
        "市場ニーズ接続: 現在の説明にある『〇〇』という表現を、『売れないコンテンツを作り続けるリスク』に言及した文言に変更してください"
      ]
    },
    { "key": "profitability", "label": "収益性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "trustworthiness", "label": "信頼性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "ux", "label": "UX / 分かりやすさ", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "appeal", "label": "訴求力", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "feasibility", "label": "実行可能性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] }
  ]
}

【出力前チェック】improvements の各項目を出力する前に、「この改善は同じカテゴリの penalties のどれを解消するか」を確認すること。対応するペナルティがない場合は書かない。

verdict の値は必ず「優秀」「合格」「要改善」「危険」「論外」のいずれか。score は 1.0〜5.0 の小数点1桁。categories は必ず7項目すべて含める。`;

  return { system, user };
}

export async function POST(req: NextRequest) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL が必要です' }, { status: 400 });
    }
    if (!isSafeUrl(url)) {
      return NextResponse.json({ error: '無効なURLです。公開されているWebページのURLを入力してください。' }, { status: 400 });
    }

    // Fetch page
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReviewBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      html = await res.text();
    } catch {
      return NextResponse.json({ error: `URL を取得できませんでした: ${url}` }, { status: 422 });
    }

    const pageText = extractText(html);

    // Generate all 5 modes in parallel; use allSettled so one failure doesn't discard the rest
    const settled = await Promise.allSettled(
      MODES.map(async (m) => {
        const { system, user } = buildPrompt(pageText, m);
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });
        const content = completion.choices[0]?.message?.content ?? '{}';
        const raw = JSON.parse(content);

        return {
          mode: m.mode,
          modeLabel: m.label,
          overall: raw.overall ?? 3.0,
          overallComment: raw.harshVerdict ?? '',
          canCompete: raw.canCompete ?? false,
          canCompeteReason: raw.canCompeteReason ?? '',
          categories: (raw.categories ?? CATEGORY_KEYS.map((c) => ({
            key: c.key, label: c.label, score: 3.0, verdict: '要改善',
            comment: '', details: '', penalties: [], improvements: [],
          }))),
          harshVerdict: raw.harshVerdict ?? '',
          top3Fixes: raw.top3Fixes ?? [],
          targetHits: raw.targetHits ?? [],
          targetMisses: raw.targetMisses ?? [],
          saleReadiness: raw.saleReadiness ?? '',
          idealState: raw.idealState ?? '',
          // carry over for input reconstruction
          _raw: raw,
        };
      })
    );

    type ModeResult = {
      mode: JudgeMode; modeLabel: string; overall: number; overallComment: string;
      canCompete: boolean; canCompeteReason: string; categories: unknown[];
      harshVerdict: string; top3Fixes: string[]; targetHits: string[];
      targetMisses: string[]; saleReadiness: string; idealState: string;
      _raw: Record<string, unknown>;
    };

    const fulfilledResults: ModeResult[] = settled
      .filter((s): s is PromiseFulfilledResult<ModeResult> => s.status === 'fulfilled')
      .map((s) => s.value);

    if (fulfilledResults.length === 0) {
      return NextResponse.json({ error: 'AI評価に失敗しました。しばらくしてから再試行してください。' }, { status: 502 });
    }

    const first = fulfilledResults[0]._raw;
    const input = {
      name: (first.productName as string) ?? 'URLから取得',
      type: ((first.productType as string) ?? 'その他') as ProjectType,
      price: (first.price as string) ?? '',
      target: (first.target as string) ?? '',
      description: (first.description as string) ?? '',
      url,
      notes: '',
      inputMode: 'url' as const,
    };

    const reports = Object.fromEntries(
      fulfilledResults.map(({ _raw: _, ...r }) => [r.mode, r])
    ) as ReviewResult['reports'];

    const result: ReviewResult = {
      input,
      reports,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '評価中にエラーが発生しました' }, { status: 500 });
  }
}
