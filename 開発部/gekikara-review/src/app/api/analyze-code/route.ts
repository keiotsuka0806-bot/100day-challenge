import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ReviewResult, JudgeMode, ProjectType } from '@/types/review';

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
  { mode: 'user', label: '実際のユーザー', focus: '信頼性・UX・「本当に使い続けるか」を重視する' },
];

function buildPrompt(
  code: string,
  projectName: string,
  mode: { mode: JudgeMode; label: string; focus: string }
): { system: string; user: string } {
  const system = `あなたはWebアプリのソースコードを読んで、プロダクト品質を評価し、
Claude Codeにそのまま渡して実行できる改善指示を生成するコードレビュアーです。

【improvements の絶対形式】
各改善指示は必ず次のいずれかの形式で書くこと：

A. ファイル名修正型:
「[ファイル名] の [コンポーネント名/関数名] にある '[現在のコードまたはテキスト]' を '[新しいコード/テキスト]' に変更してください。[理由]」

B. 追加型:
「[ファイル名] の [場所の説明] の直下/直上に [具体的な内容] を追加してください。[形式・条件・理由]」

C. リファクタ型:
「[ファイル名] の [関数名/処理名] を [具体的な変更内容] に変更してください。[理由]」

【OK例】
✅ 「src/components/InputForm.tsx の submit ボタンのラベル '激辛審査する' を '今すぐ無料で審査する 🔥' に変更してください。CVRを上げるためCTAに無料であることを明示する」
✅ 「src/app/page.tsx の results ページヘッダーに、現在の審査モード名を示す <span className="text-xs text-zinc-500">{report.modeLabel}モード</span> を追加してください」
✅ 「src/app/api/analyze-url/route.ts の extractText 関数の slice 上限を 14000 から 8000 に下げてください。コンテキスト過多で評価精度が下がるため」

【NG例 — 書いてはいけない】
❌ コードに存在しないファイル名・関数名を参照する
❌ 「ユーザビリティを改善してください」など抽象的な指示
❌ 「ユーザー調査をしてください」など運用提案
❌ 「〇〇機能を新たに開発する」など大規模開発提案（1日で実装できる範囲の改善のみ）

【評価軸のコード的解釈】
- 独自性: このコードが実装している機能・UXが他ツールと差別化できているか
- 市場性: ターゲットユーザーに刺さるコピー・導線がコードに実装されているか
- 収益性: CVポイント・CTA・価値提案のコードが弱くないか（無料ツールの場合はウイルス的成長の仕組みがあるか）
- 信頼性: エラー処理・ローディング状態・限界の説明・セキュリティがコードにあるか
- UX: ユーザーフローの実装に摩擦・混乱がないか（ステップ数・ラベル・フィードバック）
- 訴求力: ファーストビューのコピー・見出し・説明文が価値を伝えているか
- 実行可能性: コードの完成度・型安全性・エッジケース対応・デプロイ品質`;

  const user = `あなたは「${mode.label}」の立場でコードをレビューします。評価基準: ${mode.focus}

プロジェクト名: ${projectName || '（未入力）'}

以下のソースコードを読んで徹底的に辛口評価してください。「良いですね」は禁止。

---
${code}
---

以下のJSON形式"のみ"で返してください（コードブロック・説明文は不要）：
{
  "productName": "プロジェクト名（コードから読み取る）",
  "productType": "LP または アプリ または ゲーム または 教材 または note または Brain または SaaS または その他",
  "price": "価格（コードから読み取れる場合のみ、不明なら空文字）",
  "target": "ターゲットユーザー（コードから推測、30文字以内）",
  "description": "このコードが何をするアプリか（2〜3文で要約）",
  "overall": 3.2,
  "canCompete": true,
  "canCompeteReason": "理由を一文で",
  "harshVerdict": "激辛総評を2〜3文で",
  "top3Fixes": ["今すぐ直すべきコードの問題1", "問題2", "問題3"],
  "targetHits": ["このコードが刺さるユーザー1", "ユーザー2"],
  "targetMisses": ["刺さらないユーザー1", "ユーザー2"],
  "saleReadiness": "軽微修正で公開可 または 抜本的な見直しが必要",
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
        "このコードで実装されている機能が他ツールと区別できない具体的な理由",
        "差別化できていない具体的な箇所"
      ],
      "improvements": [
        "penalties[0]を解消: src/[ファイル名] の [場所] にある '[引用]' を '[具体的な変更]' に変更してください。[理由]",
        "penalties[1]を解消: src/[ファイル名] の [場所] に [内容] を追加してください。[形式・理由]",
        "追加改善: src/[ファイル名] の [場所] の [現在の実装] を [改善案] に変更してください"
      ]
    },
    { "key": "marketability", "label": "市場性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "profitability", "label": "収益性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "trustworthiness", "label": "信頼性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "ux", "label": "UX / 分かりやすさ", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "appeal", "label": "訴求力", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] },
    { "key": "feasibility", "label": "実行可能性", "score": 0, "verdict": "要改善", "comment": "", "details": "", "penalties": [], "improvements": ["penalties[0]を解消: 具体的な改善指示", "penalties[1]を解消: 具体的な改善指示", "追加改善: 具体的な改善指示"] }
  ]
}

【出力前チェック】improvements の各項目を書く前に「このコードのどのファイルのどの箇所を変えるか」を確認すること。ファイル名が特定できない場合は書かない。

verdict は「優秀」「合格」「要改善」「危険」「論外」のいずれか。score は 1.0〜5.0 の小数点1桁。categories は必ず7項目。`;

  return { system, user };
}

export async function POST(req: NextRequest) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { code, projectName } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'コードが必要です' }, { status: 400 });
    }
    if (code.length > 80000) {
      return NextResponse.json({ error: 'コードが長すぎます（上限80,000文字）' }, { status: 400 });
    }

    const codeSnippet = code.slice(0, 24000);

    const settled = await Promise.allSettled(
      MODES.map(async (m) => {
        const { system, user } = buildPrompt(codeSnippet, projectName ?? '', m);
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
          categories: raw.categories ?? CATEGORY_KEYS.map((c) => ({
            key: c.key, label: c.label, score: 3.0, verdict: '要改善',
            comment: '', details: '', penalties: [], improvements: [],
          })),
          harshVerdict: raw.harshVerdict ?? '',
          top3Fixes: raw.top3Fixes ?? [],
          targetHits: raw.targetHits ?? [],
          targetMisses: raw.targetMisses ?? [],
          saleReadiness: raw.saleReadiness ?? '',
          idealState: raw.idealState ?? '',
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
      name: (first.productName as string) ?? projectName ?? 'コードから取得',
      type: ((first.productType as string) ?? 'アプリ') as ProjectType,
      price: (first.price as string) ?? '',
      target: (first.target as string) ?? '',
      description: (first.description as string) ?? '',
      url: '',
      notes: '',
      inputMode: 'code' as const,
    };

    const reports = Object.fromEntries(
      fulfilledResults.map(({ _raw: _, ...r }) => [r.mode, r])
    ) as ReviewResult['reports'];

    const result: ReviewResult = { input, reports, generatedAt: new Date().toISOString() };
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '評価中にエラーが発生しました' }, { status: 500 });
  }
}
