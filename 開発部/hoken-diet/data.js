const DATA_AS_OF = '2026年度（2026年7月時点）';

const SOURCES = [
  { name: '協会けんぽ「高額療養費」', url: 'https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/002/index.html' },
  { name: '日本年金機構「令和8年4月分からの年金額等について」', url: 'https://www.nenkin.go.jp/oshirase/taisetu/kojin/2026/202604/0401.html' },
  { name: '厚生労働省「高額療養費制度を利用される皆さまへ」', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/juuyou/kougakuiryou/index.html' },
  { name: '全国健康保険協会「傷病手当金」', url: 'https://www.kyoukaikenpo.or.jp/g6/cat620/r306/' },
];

const INCOME_BANDS = [
  { id: 'under370', label: '〜370万円くらい', midIncome: 3000000, kubun: 'エ', capText: '月57,600円', capBase: 57600, capRate: 0, capThreshold: 0, tajusu: 44400 },
  { id: 'b370to770', label: '370〜770万円くらい', midIncome: 5500000, kubun: 'ウ', capText: '月80,100円＋α', capBase: 80100, capRate: 0.01, capThreshold: 267000, tajusu: 44400 },
  { id: 'b770to1160', label: '770〜1,160万円くらい', midIncome: 9500000, kubun: 'イ', capText: '月167,400円＋α', capBase: 167400, capRate: 0.01, capThreshold: 558000, tajusu: 93000 },
  { id: 'over1160', label: '1,160万円〜', midIncome: 13000000, kubun: 'ア', capText: '月252,600円＋α', capBase: 252600, capRate: 0.01, capThreshold: 842000, tajusu: 140100 },
];

const KOGAKU_NOTE = '住民税非課税世帯はさらに低い上限（月35,400円）。2026年8月から上限は段階的に引き上げ予定（例: 区分ウ 80,100円→約85,800円の見込み）。多数回該当（直近12ヶ月に3回以上）は4回目から上限がさらに下がる。';

const PENSION_2026 = {
  kisoFull: 847300,
  childAdd12: 243800,
  childAdd3: 81300,
  shogai1: 1059125,
  shogai2: 847300,
  kokuminMonthly: 17920,
  birthLumpSum: 500000,
};

const RATES = {
  kenpo: 0.05,
  kosei: 0.0915,
  koseiCapMonthly: 650000,
  izokuKoseiUnit: 5.481 / 1000,
  izokuKoseiMinMonths: 300,
};

function kogakuCapFor(band, medicalCost) {
  if (!band.capRate) return band.capBase;
  return Math.round(band.capBase + Math.max(0, medicalCost - band.capThreshold) * band.capRate);
}

function estimateMonthlyPay(band) { return Math.round(band.midIncome / 12); }

function estimateShobyoMonthly(band) { return Math.round(estimateMonthlyPay(band) * 2 / 3); }

function estimateIzokuKiso(children) {
  if (children <= 0) return 0;
  const add = Math.min(children, 2) * PENSION_2026.childAdd12 + Math.max(0, children - 2) * PENSION_2026.childAdd3;
  return PENSION_2026.kisoFull + add;
}

function estimateIzokuKosei(band) {
  const avg = Math.min(estimateMonthlyPay(band), RATES.koseiCapMonthly);
  return Math.round(avg * RATES.izokuKoseiUnit * RATES.izokuKoseiMinMonths * 0.75);
}

function estimatePublicPremium(band, worker) {
  if (worker === 'self') return null;
  const pay = estimateMonthlyPay(band);
  return Math.round(pay * RATES.kenpo + Math.min(pay, RATES.koseiCapMonthly) * RATES.kosei);
}

const INSURANCE_TYPES = [
  { id: 'medical', label: '医療保険（入院日額型など）' },
  { id: 'cancer', label: 'がん保険' },
  { id: 'death-term', label: '死亡保険（定期・収入保障）' },
  { id: 'death-whole', label: '死亡保険（終身）' },
  { id: 'disability', label: '就業不能・所得補償保険' },
  { id: 'education', label: '学資保険' },
  { id: 'annuity', label: '個人年金保険' },
  { id: 'other', label: 'その他' },
];

const CANCEL_CHECKLIST = [
  '持病・通院歴ができていないか（一度やめると同条件で入り直せないことがある）',
  '貯蓄は生活費の6ヶ月分以上あるか（当座の医療費・生活費を自分で払えるか）',
  '解約でなく「特約を外す」「入院日額を下げる」「減額」で保険料を下げる選択肢を確認したか',
  '終身型は解約返戻金のタイミングで損得が変わる。返戻金の推移表を取り寄せたか',
  '家族（受取人）に相談したか。保障は自分だけの問題ではない',
];

const FIXED_QUESTIONS = [
  'この保険をやめた場合と続けた場合で、御社（担当者）に入る手数料はどう変わりますか？',
  'いま提案されている乗り換えは、解約でなく既存契約の減額では実現できませんか？',
];
