'use client';

import { useState } from 'react';
import type { CategoryScore } from '@/types/review';

function ImprovementItem({ index, text }: { index: number; text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="group relative bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 hover:border-zinc-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-xs text-zinc-500 font-bold mt-0.5 shrink-0">{index}</span>
          <span className="text-sm text-zinc-200 leading-relaxed">{text}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`shrink-0 text-xs px-2.5 py-1 rounded border transition-all ${
            copied
              ? 'bg-green-900/50 border-green-700 text-green-400'
              : 'border-zinc-600 text-zinc-500 hover:border-zinc-400 hover:text-zinc-300'
          }`}
        >
          {copied ? '✓' : 'コピー'}
        </button>
      </div>
    </li>
  );
}

function scoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-400';
  if (score >= 3.8) return 'text-green-400';
  if (score >= 3.0) return 'text-yellow-400';
  if (score >= 2.0) return 'text-orange-400';
  return 'text-red-500';
}

function verdictBadge(verdict: string): string {
  switch (verdict) {
    case '優秀': return 'bg-emerald-900/60 text-emerald-400 border border-emerald-800';
    case '合格': return 'bg-green-900/60 text-green-400 border border-green-800';
    case '要改善': return 'bg-yellow-900/60 text-yellow-400 border border-yellow-800';
    case '危険': return 'bg-orange-900/60 text-orange-400 border border-orange-800';
    default: return 'bg-red-900/60 text-red-400 border border-red-800';
  }
}

interface Props {
  categories: CategoryScore[];
  inputMode?: 'manual' | 'url' | 'code';
}

export default function CategoryDetail({ categories, inputMode }: Props) {
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.key} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Category header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div>
              <span className="font-bold text-white">{cat.label}</span>
              <span className={`ml-3 text-xs px-2 py-0.5 rounded ${verdictBadge(cat.verdict)}`}>
                {cat.verdict}
              </span>
            </div>
            <div className={`text-2xl font-black ${scoreColor(cat.score)}`}>
              {cat.score.toFixed(1)}<span className="text-xs text-zinc-500 font-normal ml-1">/ 5.0</span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* One-liner comment */}
            <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-red-600 pl-3">
              {cat.comment}
            </p>

            {/* Details */}
            <p className="text-sm text-zinc-400 leading-relaxed">{cat.details}</p>

            {/* Penalties */}
            {cat.penalties.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">減点理由</div>
                <ul className="space-y-1">
                  {cat.penalties.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-400">
                      <span className="mt-0.5 shrink-0">✗</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements */}
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                {inputMode === 'code' ? (
                  <>改善プロンプト <span className="normal-case font-normal text-red-500">— Claude Code に貼り付けて実行</span></>
                ) : inputMode === 'url' ? (
                  <>改善の方向性メモ <span className="normal-case font-normal text-zinc-600">— 参考程度に</span></>
                ) : (
                  <>改善プロンプト <span className="normal-case font-normal text-zinc-600">— Claude Code / Codex に貼り付けて実行</span></>
                )}
              </div>
              <ul className="space-y-2">
                {cat.improvements.map((imp, i) => (
                  <ImprovementItem key={i} index={i + 1} text={imp} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
