export type ProjectType =
  | 'LP'
  | 'アプリ'
  | 'ゲーム'
  | '教材'
  | 'note'
  | 'Brain'
  | 'SaaS'
  | 'その他';

export type JudgeMode =
  | 'comprehensive'
  | 'investor'
  | 'marketer'
  | 'ux'
  | 'user';

export interface ProjectInput {
  name: string;
  type: ProjectType;
  price: string;
  target: string;
  description: string;
  url: string;
  notes: string;
  inputMode?: 'manual' | 'url' | 'code';
}

export interface CategoryScore {
  key: string;
  label: string;
  score: number;
  verdict: string;
  comment: string;
  details: string;
  penalties: string[];
  improvements: string[];
}

export interface JudgeReport {
  mode: JudgeMode;
  modeLabel: string;
  overall: number;
  overallComment: string;
  canCompete: boolean;
  canCompeteReason: string;
  categories: CategoryScore[];
  harshVerdict: string;
  top3Fixes: string[];
  targetHits: string[];
  targetMisses: string[];
  saleReadiness: string;
  idealState: string;
}

export interface ReviewResult {
  input: ProjectInput;
  reports: Record<JudgeMode, JudgeReport>;
  generatedAt: string;
}
