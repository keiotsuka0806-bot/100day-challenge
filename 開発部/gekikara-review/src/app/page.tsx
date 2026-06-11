'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ProjectInput, JudgeMode, ReviewResult } from '@/types/review';
import { generateAllReports } from '@/lib/mockJudge';
import { saveHistory, loadHistory, type HistoryEntry } from '@/lib/history';
import InputForm from '@/components/InputForm';
import { OverallScoreCard, ScoreGrid } from '@/components/ScoreCard';
import JudgeTabs from '@/components/JudgeTabs';
import CategoryDetail from '@/components/CategoryDetail';
import FinalVerdict from '@/components/FinalVerdict';

type Phase = 'input' | 'reviewing' | 'results';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [activeMode, setActiveMode] = useState<JudgeMode>('comprehensive');
  const [copyDone, setCopyDone] = useState(false);
  const [copyAllDone, setCopyAllDone] = useState(false);
  const [reviewingMsg, setReviewingMsg] = useState('容赦なく評価しています');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Manual form submit (mock judge)
  const handleSubmit = useCallback(async (input: ProjectInput) => {
    setPhase('reviewing');
    setReviewingMsg('容赦なく評価しています');
    await new Promise((r) => setTimeout(r, 1800));
    const reviewResult = await generateAllReports(input);
    saveHistory(reviewResult);
    setHistory(loadHistory());
    setResult(reviewResult);
    setActiveMode('comprehensive');
    setPhase('results');
  }, []);

  // Code analyze (OpenAI API)
  const handleCodeAnalyze = useCallback(async (code: string, projectName: string) => {
    setPhase('reviewing');
    setReviewingMsg('コードを読んでAIが分析中...');
    try {
      const res = await fetch('/api/analyze-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, projectName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'エラーが発生しました');
      }
      const reviewResult: ReviewResult = await res.json();
      saveHistory(reviewResult);
      setHistory(loadHistory());
      setResult(reviewResult);
      setActiveMode('comprehensive');
      setPhase('results');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
      setPhase('input');
    }
  }, []);

  // URL auto-analyze (OpenAI API)
  const handleUrlAnalyze = useCallback(async (url: string) => {
    setPhase('reviewing');
    setReviewingMsg('ページを読み込んでAIが分析中...');
    try {
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'エラーが発生しました');
      }
      const reviewResult: ReviewResult = await res.json();
      saveHistory(reviewResult);
      setHistory(loadHistory());
      setResult(reviewResult);
      setActiveMode('comprehensive');
      setPhase('results');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'エラーが発生しました');
      setPhase('input');
    }
  }, []);

  function handleRestart() {
    setPhase('input');
    setResult(null);
  }

  async function handleCopyAllPrompts() {
    if (!result) return;
    const report = result.reports[activeMode];
    const lines: string[] = [
      `# 激辛AI審査 — 全改善プロンプト一覧`,
      `対象: ${result.input.name} (${report.modeLabel}モード)`,
      '',
    ];
    report.categories.forEach((cat) => {
      lines.push(`## ${cat.label} (${cat.score.toFixed(1)} / ${cat.verdict})`);
      cat.improvements.forEach((imp, i) => {
        lines.push(`${i + 1}. ${imp}`);
      });
      lines.push('');
    });
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopyAllDone(true);
    setTimeout(() => setCopyAllDone(false), 2000);
  }

  async function handleCopy() {
    if (!result) return;
    const report = result.reports[activeMode];
    const text = [
      `# 激辛AI審査レポート: ${result.input.name}`,
      `審査員: ${report.modeLabel}モード`,
      `総合評価: ${report.overall.toFixed(1)} / 5.0`,
      '',
      '## スコア一覧',
      ...report.categories.map((c) => `- ${c.label}: ${c.score.toFixed(1)} (${c.verdict})`),
      '',
      '## 激辛総評',
      report.harshVerdict,
      '',
      '## 今すぐ直すべき3点',
      ...report.top3Fixes.map((f, i) => `${i + 1}. ${f}`),
      '',
      '## 販売前判断',
      report.saleReadiness,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  if (phase === 'reviewing') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-6">
        <div className="text-5xl animate-pulse">🔥</div>
        <div className="text-xl font-bold">審査中...</div>
        <p className="text-zinc-500 text-sm">{reviewingMsg}</p>
      </div>
    );
  }

  if (phase === 'input' || !result) {
    return (
      <>
        <InputForm onSubmit={handleSubmit} onUrlAnalyze={handleUrlAnalyze} onCodeAnalyze={handleCodeAnalyze} isLoading={false} />
        {history.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 pb-12">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">最近の審査履歴</div>
            <div className="space-y-2">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => { setResult(entry.result); setActiveMode('comprehensive'); setPhase('results'); }}
                  className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-left hover:border-zinc-600 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 font-medium truncate">{entry.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{entry.type} · {new Date(entry.savedAt).toLocaleDateString('ja-JP')}</div>
                  </div>
                  <div className={`text-lg font-black ml-4 shrink-0 ${entry.overall >= 4.5 ? 'text-emerald-400' : entry.overall >= 3.8 ? 'text-green-400' : entry.overall >= 3.0 ? 'text-yellow-400' : entry.overall >= 2.0 ? 'text-orange-400' : 'text-red-500'}`}>
                    {entry.overall.toFixed(1)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  const report = result.reports[activeMode];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleRestart}
            className="text-xs text-zinc-500 hover:text-white border border-zinc-800 rounded px-3 py-1.5 transition-colors shrink-0"
          >
            ← 再審査
          </button>
          <div className="text-sm font-bold text-zinc-300 truncate">{result.input.name}</div>
          <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded shrink-0">
            {result.input.type}
          </span>
          {result.input.price && (
            <span className="text-xs text-zinc-600 hidden sm:block shrink-0">{result.input.price}</span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1.5 rounded border transition-all shrink-0 ml-2 ${
            copyDone
              ? 'bg-green-900/50 border-green-800 text-green-400'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
          }`}
        >
          {copyDone ? '✓ コピー済み' : 'レポートをコピー'}
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold">激辛コンテンツ評価レポート</h1>
          <p className="text-zinc-500 text-xs mt-1">
            対象: {result.input.name} · {result.input.price || '価格未入力'} · {new Date(result.generatedAt).toLocaleDateString('ja-JP')}
          </p>
        </div>

        <JudgeTabs active={activeMode} onChange={setActiveMode} />

        <OverallScoreCard score={report.overall} label={report.modeLabel} canCompete={report.canCompete} />

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">評価スコア一覧</div>
          <ScoreGrid categories={report.categories} />
        </div>

        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">詳細評価レポート</div>
          <CategoryDetail categories={report.categories} inputMode={result.input.inputMode} />
        </div>

        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">最終判定</div>
          <FinalVerdict report={report} />
        </div>

        {/* Bulk copy all improvement prompts */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-white">全改善プロンプトを一括コピー</div>
              <p className="text-xs text-zinc-500 mt-0.5">
                全カテゴリ {report.categories.length} 項目 × 3プロンプト をまとめてコピー。Claude Code に貼り付けて実行できます。
              </p>
            </div>
            <button
              onClick={handleCopyAllPrompts}
              className={`shrink-0 ml-4 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                copyAllDone
                  ? 'bg-green-900/50 border-green-700 text-green-400'
                  : 'bg-red-600 hover:bg-red-500 border-red-600 hover:border-red-500 text-white'
              }`}
            >
              {copyAllDone ? '✓ コピー済み' : '🔥 全プロンプトをコピー'}
            </button>
          </div>
        </div>

        <div className="text-center text-zinc-700 text-xs py-4">
          {result.input.url ? 'OpenAI GPT-4o-mini によるリアルタイム評価' : 'モック評価（URLモードで入力するとAIリアルタイム評価になります）'}
        </div>
      </div>
    </div>
  );
}
