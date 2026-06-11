import type { JudgeReport } from '@/types/review';

interface Props {
  report: JudgeReport;
}

export default function FinalVerdict({ report }: Props) {
  return (
    <div className="space-y-4">
      {/* Harsh verdict */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          激辛総評
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed">{report.harshVerdict}</p>
      </div>

      {/* Can compete */}
      <div className={`rounded-xl p-5 border ${report.canCompete ? 'bg-green-950/40 border-green-900' : 'bg-red-950/40 border-red-900'}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-lg">{report.canCompete ? '⚡' : '⚠️'}</span>
          <div className="text-sm font-bold text-white">
            このまま出して戦えるか: {report.canCompete ? '戦えます' : '戦えません'}
          </div>
        </div>
        <p className={`text-sm ${report.canCompete ? 'text-green-400' : 'text-red-400'}`}>
          {report.canCompeteReason}
        </p>
      </div>

      {/* Top 3 fixes */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          今すぐ直すべき3点
        </div>
        <ol className="space-y-2">
          {report.top3Fixes.map((fix, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-zinc-300">{fix}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Target audience */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            刺さる読者
          </div>
          <ul className="space-y-1.5">
            {report.targetHits.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-green-500 mt-0.5 shrink-0">●</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            刺さらない読者
          </div>
          <ul className="space-y-1.5">
            {report.targetMisses.length > 0 ? report.targetMisses.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <span className="text-zinc-600 mt-0.5 shrink-0">●</span>
                {m}
              </li>
            )) : (
              <li className="text-sm text-zinc-500">特定の除外層なし（広く届く可能性あり）</li>
            )}
          </ul>
        </div>
      </div>

      {/* Sale readiness + Ideal state */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            販売前判断
          </div>
          <div className={`text-sm font-bold ${report.canCompete ? 'text-yellow-400' : 'text-red-400'}`}>
            {report.saleReadiness}
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            改善後の理想状態
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">{report.idealState}</p>
        </div>
      </div>
    </div>
  );
}
