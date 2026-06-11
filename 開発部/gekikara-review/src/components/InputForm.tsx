'use client';

import { useState } from 'react';
import type { ProjectInput, ProjectType } from '@/types/review';

const PROJECT_TYPES: ProjectType[] = [
  'LP', 'アプリ', 'ゲーム', '教材', 'note', 'Brain', 'SaaS', 'その他',
];

const DEMO_INPUT: ProjectInput = {
  name: '副業で月10万円を稼ぐ実践プログラム',
  type: '教材',
  price: '29800円',
  target: '副業未経験の会社員・30〜40代男性',
  description: '本業をやめずに副業で月10万円を稼ぐための完全ロードマップ。SNS運用・ライティング・コンサルの3つから自分に合った副業を選んで、初月から収益化できる実践的な内容。受講生500名以上、3ヶ月で月10万達成率68%。サポートはSlackで90日間無制限。競合と比べて価格が安く、実績データが豊富な点が強み。',
  url: '',
  notes: '',
};

interface Props {
  onSubmit: (input: ProjectInput) => void;
  onUrlAnalyze: (url: string) => void;
  onCodeAnalyze: (code: string, projectName: string) => void;
  isLoading: boolean;
}

export default function InputForm({ onSubmit, onUrlAnalyze, onCodeAnalyze, isLoading }: Props) {
  const [mode, setMode] = useState<'url' | 'manual' | 'code'>('url');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [codeProjectName, setCodeProjectName] = useState('');
  const [form, setForm] = useState<ProjectInput>({
    name: '', type: 'LP', price: '', target: '', description: '', url: '', notes: '',
  });

  const set = (key: keyof ProjectInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onUrlAnalyze(url.trim());
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return;
    onSubmit(form);
  }

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    onCodeAnalyze(code.trim(), codeProjectName.trim());
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-start py-16 px-4">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🔥</div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">激辛AI審査会</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            「良いですね」は言いません。売れるかどうかだけを見ます。
          </p>
          <button
            onClick={() => { onSubmit(DEMO_INPUT); }}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded px-3 py-1.5 transition-colors"
          >
            サンプルで試す →
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('url')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
              mode === 'url' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            🔗 URLを審査
          </button>
          <button
            onClick={() => setMode('code')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
              mode === 'code' ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            💻 コードを審査
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
              mode === 'manual' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            ✏️ 手動入力
          </button>
        </div>

        {/* URL mode */}
        {mode === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                LP・Brain・note・アプリのURLを貼るだけで、AIがページを読んで自動で激辛評価を出します。
              </p>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://brain.base.ec/items/... など"
                required
                className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors mb-4"
              />
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    AIが分析中...
                  </>
                ) : (
                  '🔥 このURLを激辛審査する'
                )}
              </button>
            </div>
            <p className="text-center text-zinc-700 text-xs">
              URLのページ内容をAIが自動で読み取ります。ログイン必須のページは取得できません。
            </p>
          </form>
        )}

        {/* Code mode */}
        {mode === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">
                ソースコードを貼り付けると、ファイルパス指定の <span className="text-red-400 font-semibold">Claude Code 実行プロンプト</span> を生成します。
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">プロジェクト名（任意）</label>
                <input
                  type="text"
                  value={codeProjectName}
                  onChange={(e) => setCodeProjectName(e.target.value)}
                  placeholder="例: 激辛AI審査会、WhiskyNote"
                  className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  ソースコード *
                  <span className="normal-case font-normal text-zinc-600 ml-1">— 複数ファイルは <code className="text-zinc-500">===  ファイル名  ===</code> で区切る</span>
                </label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  rows={12}
                  placeholder={`=== src/components/InputForm.tsx ===
export default function InputForm(...) {
  // コードをここに貼り付け
}

=== src/app/page.tsx ===
// 複数ファイルまとめて貼り付け可`}
                  className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors resize-y font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !code.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    AIがコードを分析中...
                  </>
                ) : '🔥 コードを激辛審査する'}
              </button>
            </div>
            <p className="text-center text-zinc-700 text-xs">
              貼り付けたコードはOpenAI APIに送信されます。秘密情報は含めないでください。
            </p>
          </form>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">プロジェクト名 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="例: 発信力3.0、WhiskyNote"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">種類</label>
                <select
                  value={form.type}
                  onChange={set('type')}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                >
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">価格</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={set('price')}
                  placeholder="例: 14800円、無料"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">ターゲット</label>
                <input
                  type="text"
                  value={form.target}
                  onChange={set('target')}
                  placeholder="例: 副業で月10万を目指す30代"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                概要 * <span className="text-zinc-600 normal-case font-normal">（詳しく書くほど精度↑）</span>
              </label>
              <textarea
                value={form.description}
                onChange={set('description')}
                required
                rows={5}
                placeholder="何ができるか、どんな価値があるか、競合との違いなど"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !form.name.trim() || !form.description.trim()}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-bold text-base transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  審査中...
                </>
              ) : '🔥 激辛審査する'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
