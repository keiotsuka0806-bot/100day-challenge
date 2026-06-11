import type { CategoryScore } from '@/types/review';

interface OverallProps {
  score: number;
  label: string;
  canCompete: boolean;
}

function scoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-400';
  if (score >= 3.8) return 'text-green-400';
  if (score >= 3.0) return 'text-yellow-400';
  if (score >= 2.0) return 'text-orange-400';
  return 'text-red-500';
}

function scoreBarColor(score: number): string {
  if (score >= 4.5) return 'bg-emerald-400';
  if (score >= 3.8) return 'bg-green-400';
  if (score >= 3.0) return 'bg-yellow-400';
  if (score >= 2.0) return 'bg-orange-400';
  return 'bg-red-500';
}

export function OverallScoreCard({ score, label, canCompete }: OverallProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center gap-6">
      <div className="text-center min-w-[80px]">
        <div className={`text-5xl font-black ${scoreColor(score)}`}>
          {score.toFixed(1)}
        </div>
        <div className="text-zinc-500 text-xs mt-1">/ 5.0</div>
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
          {label}モード · 総合評価
        </div>
        <div className={`font-bold text-lg ${scoreColor(score)}`}>
          {score >= 4.5 ? '優秀' : score >= 3.8 ? '合格' : score >= 3.0 ? '要改善' : score >= 2.0 ? '危険' : '論外'}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${canCompete ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
            {canCompete ? '販売可（要改善）' : '販売前に見直し必須'}
          </span>
        </div>
      </div>
    </div>
  );
}

interface GridProps {
  categories: CategoryScore[];
}

export function ScoreGrid({ categories }: GridProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {categories.map((cat) => (
        <div key={cat.key} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
          <div className="w-28 text-sm text-zinc-400 shrink-0">{cat.label}</div>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(cat.score)}`}
              style={{ width: `${(cat.score / 5) * 100}%` }}
            />
          </div>
          <div className={`text-sm font-bold w-8 text-right ${scoreColor(cat.score)}`}>
            {cat.score.toFixed(1)}
          </div>
          <div className={`text-xs px-2 py-0.5 rounded w-14 text-center ${
            cat.verdict === '優秀' ? 'bg-emerald-900/50 text-emerald-400' :
            cat.verdict === '合格' ? 'bg-green-900/50 text-green-400' :
            cat.verdict === '要改善' ? 'bg-yellow-900/50 text-yellow-400' :
            cat.verdict === '危険' ? 'bg-orange-900/50 text-orange-400' :
            'bg-red-900/50 text-red-400'
          }`}>
            {cat.verdict}
          </div>
        </div>
      ))}
    </div>
  );
}
