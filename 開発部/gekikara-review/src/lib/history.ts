import type { ReviewResult, JudgeMode } from '@/types/review';

const KEY = 'gekikara_history_v1';
const MAX = 5;

export interface HistoryEntry {
  id: string;
  name: string;
  type: string;
  overall: number;
  savedAt: string;
  result: ReviewResult;
}

export function saveHistory(result: ReviewResult): void {
  if (typeof window === 'undefined') return;
  const entries = loadHistory();
  const entry: HistoryEntry = {
    id: Date.now().toString(),
    name: result.input.name,
    type: result.input.type,
    overall: result.reports.comprehensive?.overall ?? result.reports[Object.keys(result.reports)[0] as JudgeMode]?.overall ?? 0,
    savedAt: new Date().toISOString(),
    result,
  };
  const updated = [entry, ...entries].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch { /* storage full */ }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}
