import type { JudgeMode } from '@/types/review';

interface Tab {
  mode: JudgeMode;
  label: string;
  icon: string;
  focus: string;
}

const TABS: Tab[] = [
  { mode: 'comprehensive', label: '総合', icon: '⚡', focus: '全評価軸' },
  { mode: 'investor', label: '投資家', icon: '💼', focus: '市場性・収益性' },
  { mode: 'marketer', label: 'マーケター', icon: '📢', focus: '訴求・導線' },
  { mode: 'ux', label: 'UX専門家', icon: '🖥', focus: '体験・分かりやすさ' },
  { mode: 'user', label: 'ユーザー', icon: '👤', focus: '買うか・使うか' },
];

interface Props {
  active: JudgeMode;
  onChange: (mode: JudgeMode) => void;
}

export default function JudgeTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => (
        <button
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            active === tab.mode
              ? 'bg-red-600 text-white'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
          }`}
        >
          <span className="mr-1.5">{tab.icon}</span>
          {tab.label}
          {active !== tab.mode && (
            <span className="hidden sm:inline text-xs text-zinc-600 font-normal ml-2">
              {tab.focus}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
