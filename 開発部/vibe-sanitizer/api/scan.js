import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_LANGS = new Set(['PHP','Python','TypeScript','React/JSX','Go','Ruby','SQL','JavaScript']);

const rateMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return false; }
  if (entry.count >= 10) return true;
  entry.count++;
  rateMap.set(ip, entry);
  return false;
}

const SYSTEM_PROMPT = `You are a security scanner specialized in finding vulnerabilities in AI-generated code (vibe coding output from tools like Cursor, Copilot, Lovable, bolt.new, etc.).

Analyze the provided code for these 5 specific security risks:
1. API_KEY_EXPOSURE: Hardcoded API keys, passwords, secrets, tokens in source code
2. AUTH_BYPASS: Missing authentication checks, authorization bypasses, insecure direct object references
3. XSS: Cross-site scripting vulnerabilities, unsanitized user input rendered in DOM
4. SQL_INJECTION: SQL injection vulnerabilities, unsanitized query parameters in database calls
5. DANGEROUS_EVAL: Use of eval(), exec(), Function() constructor, or other dynamic code execution with user input

Return ONLY valid JSON with exactly this structure:
{
  "safety_score": <integer 0-100, where 100 is completely safe, 0 is extremely dangerous>,
  "language": "<detected programming language>",
  "issues": [
    {
      "category": "<one of: API_KEY_EXPOSURE, AUTH_BYPASS, XSS, SQL_INJECTION, DANGEROUS_EVAL>",
      "severity": "<CRITICAL, HIGH, or MEDIUM>",
      "line_numbers": [<array of 1-indexed line numbers where the issue appears>],
      "title": "<short issue title in Japanese, max 30 chars>",
      "description": "<clear explanation in Japanese, 1-2 sentences, what the risk is>",
      "fix": "<specific actionable fix in Japanese, 1-2 sentences>"
    }
  ]
}

Scoring guide:
- Start at 100
- CRITICAL issue: -25 each
- HIGH issue: -15 each
- MEDIUM issue: -8 each
- Minimum 0

Do not include any text outside the JSON object. No markdown, no backticks.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'リクエストが多すぎます（1分10回まで）' });

  const { code, language } = req.body;

  if (!code || typeof code !== 'string' || code.trim().length < 5) {
    return res.status(400).json({ error: 'コードが空です' });
  }
  if (code.length > 50000) {
    return res.status(400).json({ error: 'コードが長すぎます（上限50,000文字）' });
  }

  const safeLang = (typeof language === 'string' && ALLOWED_LANGS.has(language)) ? language : null;
  const userMsg = safeLang ? `Language: ${safeLang}\n\nCode:\n${code}` : `Code:\n${code}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = message.content[0]?.text ?? '';

    // Extract JSON robustly
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSONが見つかりませんでした');

    const result = JSON.parse(jsonMatch[0]);

    // Validate shape
    if (typeof result.safety_score !== 'number' || !Array.isArray(result.issues)) {
      throw new Error('レスポンスの形式が不正です');
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('scan error:', err);
    return res.status(500).json({ error: err.message || 'スキャンに失敗しました' });
  }
}
