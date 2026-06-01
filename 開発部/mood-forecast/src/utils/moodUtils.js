const MOOD_MAP = {
  '-5': { emoji: '😭', label: 'とても辛い',  color: '#ef4444' },
  '-4': { emoji: '😢', label: '辛い',       color: '#f97316' },
  '-3': { emoji: '😟', label: '少し辛い',   color: '#fb923c' },
  '-2': { emoji: '😕', label: 'やや悪い',   color: '#fbbf24' },
  '-1': { emoji: '😐', label: '少し悪い',   color: '#d4d4aa' },
   '0': { emoji: '😶', label: '普通',       color: '#94a3b8' },
   '1': { emoji: '🙂', label: '少し良い',   color: '#a3e635' },
   '2': { emoji: '😊', label: 'やや良い',   color: '#86efac' },
   '3': { emoji: '😄', label: '良い',       color: '#4ade80' },
   '4': { emoji: '😁', label: 'とても良い', color: '#22c55e' },
   '5': { emoji: '🤩', label: '最高！',     color: '#16a34a' },
}

export function getMoodInfo(value) {
  return MOOD_MAP[String(value)] ?? MOOD_MAP['0']
}
