const STORE_KEY = 'hoken_diet_v1';

let state = { profile: null, policies: [] };

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      state.profile = parsed.profile || null;
      state.policies = Array.isArray(parsed.policies) ? parsed.policies : [];
    }
  } catch (e) {
    localStorage.setItem(`${STORE_KEY}_broken`, localStorage.getItem(STORE_KEY) || '');
    localStorage.removeItem(STORE_KEY);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}

function yen(value) { return `${Math.round(value).toLocaleString('ja-JP')}円`; }
function man(value) { return `${Math.round(value / 10000).toLocaleString('ja-JP')}万円`; }

function bandOf(profile) { return INCOME_BANDS.find((b) => b.id === profile.band) || INCOME_BANDS[0]; }
function isEmployee(profile) { return profile.worker === 'employee' || profile.worker === 'public'; }

function show(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (viewId === 'home') renderResume();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.go;
    if ((target === 'private' || target === 'result') && !state.profile) { show('wizard'); return; }
    show(target);
  });
});

const incomeChoices = document.getElementById('income-choices');
INCOME_BANDS.forEach((band) => {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'band';
  input.value = band.id;
  input.required = true;
  const span = document.createElement('span');
  span.textContent = band.label;
  label.append(input, span);
  incomeChoices.appendChild(label);
});

const typeSelect = document.getElementById('policy-type');
INSURANCE_TYPES.forEach((t) => {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.label;
  typeSelect.appendChild(opt);
});

document.getElementById('wizard-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  state.profile = {
    worker: form.worker.value,
    band: form.band.value,
    spouse: form.spouse.value === 'yes',
    children: Number(document.getElementById('children').value),
  };
  saveState();
  renderPublic();
  show('public');
});

function publicItems(profile) {
  const band = bandOf(profile);
  const items = [];
  const cap100 = kogakuCapFor(band, 1000000);
  items.push({
    tag: '医療', title: '高額療養費制度',
    amount: `自己負担は${band.capText}で頭打ち`,
    detail: `医療費が月100万円かかっても、あなたの窓口負担は約${yen(cap100)}まで（区分${band.kubun}）。直近12ヶ月に3回以上使うと4回目からは月${yen(band.tajusu)}に下がる（多数回該当）。${KOGAKU_NOTE}`,
  });
  if (isEmployee(profile)) {
    items.push({
      tag: '働けない時', title: '傷病手当金',
      amount: `月あたり約${man(estimateShobyoMonthly(band))}`,
      detail: `病気やケガで働けない間、給与の約3分の2が通算1年6ヶ月支給される（健康保険）。あなたの年収レンジからの概算。`,
    });
  } else {
    items.push({
      tag: '働けない時', title: '傷病手当金', none: true,
      amount: 'なし',
      detail: '国民健康保険に傷病手当金はありません。働けなくなった時の収入は、公的には障害年金（認定まで時間がかかる）まで空白です。ここがあなたの本当の穴の候補。',
    });
  }
  const izokuKiso = estimateIzokuKiso(profile.children);
  const izokuKosei = isEmployee(profile) ? estimateIzokuKosei(band) : 0;
  const izokuTotal = izokuKiso + izokuKosei;
  if (profile.spouse || profile.children > 0) {
    items.push({
      tag: '万一の時', title: '遺族年金',
      amount: izokuTotal > 0 ? `月あたり約${yen(Math.round(izokuTotal / 12))}` : '子が18歳を超えると遺族基礎年金は対象外',
      detail: [
        profile.children > 0 ? `遺族基礎年金 年${man(izokuKiso)}（18歳年度末までの子がいる間）` : '18歳以下の子がいないため遺族基礎年金は原則対象外',
        isEmployee(profile) ? `遺族厚生年金 年約${man(izokuKosei)}（加入25年みなしの概算）` : '自営業のため遺族厚生年金はありません',
      ].join('。') + '。',
    });
  }
  items.push({
    tag: '障害', title: '障害年金',
    amount: `2級で年${man(PENSION_2026.shogai2)}〜`,
    detail: `障害基礎年金は2級 年${yen(PENSION_2026.shogai2)}・1級 年${yen(PENSION_2026.shogai1)}＋子の加算${isEmployee(profile) ? '。会社員・公務員はさらに報酬比例の障害厚生年金が上乗せ' : ''}。`,
  });
  if (profile.spouse || profile.children > 0) {
    items.push({
      tag: '出産', title: '出産育児一時金',
      amount: `1児につき${man(PENSION_2026.birthLumpSum)}`,
      detail: '出産費用に対して健康保険（国保含む)から支給。',
    });
  }
  return items;
}

function renderPublic() {
  const profile = state.profile;
  const band = bandOf(profile);
  const premiumLine = document.getElementById('premium-line');
  premiumLine.textContent = '';
  const premium = estimatePublicPremium(band, profile.worker);
  const strong = document.createElement('strong');
  if (premium) {
    premiumLine.append('あなたはすでに、毎月 ');
    strong.textContent = `約${yen(premium)}`;
    premiumLine.append(strong, ' の保険料を払っています（健康保険＋厚生年金の本人負担の概算）。その中身がこれです。');
  } else {
    premiumLine.append('あなたはすでに、国民年金 ');
    strong.textContent = `月${yen(PENSION_2026.kokuminMonthly)}`;
    premiumLine.append(strong, ' ＋国民健康保険料（所得と市区町村による）を払っています。その中身がこれです。');
  }
  const wrap = document.getElementById('public-cards');
  wrap.textContent = '';
  publicItems(profile).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'public-card';
    const h2 = document.createElement('h2');
    const tag = document.createElement('span');
    tag.className = item.none ? 'tag none' : 'tag';
    tag.textContent = item.none ? `${item.tag}: なし` : item.tag;
    h2.append(tag, document.createTextNode(item.title));
    const amount = document.createElement('div');
    amount.className = 'amount';
    amount.textContent = item.amount;
    const p = document.createElement('p');
    p.textContent = item.detail;
    card.append(h2, amount, p);
    wrap.appendChild(card);
  });
}

document.getElementById('policy-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const error = document.getElementById('policy-error');
  const premiumRaw = document.getElementById('policy-premium').value;
  if (premiumRaw === '') {
    error.textContent = '月々の保険料を入れてください（わからなければ0円でも判定できます）。';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  state.policies.push({
    id: Date.now(),
    type: document.getElementById('policy-type').value,
    premium: Math.min(500000, Math.max(0, Number(premiumRaw) || 0)),
    memo: document.getElementById('policy-memo').value.trim(),
  });
  if (!saveState()) { error.textContent = '端末の保存容量が一杯です。'; error.hidden = false; state.policies.pop(); return; }
  document.getElementById('policy-premium').value = '';
  document.getElementById('policy-memo').value = '';
  renderPolicyList();
});

function typeLabel(id) { return (INSURANCE_TYPES.find((t) => t.id === id) || { label: 'その他' }).label; }

function renderPolicyList() {
  const list = document.getElementById('policy-list');
  list.textContent = '';
  state.policies.forEach((p) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'p-label';
    label.textContent = typeLabel(p.type);
    if (p.memo) {
      const small = document.createElement('small');
      small.textContent = p.memo;
      label.appendChild(small);
    }
    const premium = document.createElement('span');
    premium.className = 'p-premium';
    premium.textContent = `月${yen(p.premium)}`;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      state.policies = state.policies.filter((x) => x.id !== p.id);
      saveState();
      renderPolicyList();
    });
    li.append(label, premium, del);
    list.appendChild(li);
  });
  document.getElementById('to-result').disabled = state.policies.length === 0;
}

document.getElementById('to-result').addEventListener('click', () => {
  renderResult();
  show('result');
});

function judgePolicy(policy, profile) {
  const band = bandOf(profile);
  const cap100 = kogakuCapFor(band, 1000000);
  const self = !isEmployee(profile);
  switch (policy.type) {
    case 'medical':
      return {
        color: 'green', verdict: '公的とかぶっている可能性',
        reason: `医療費の自己負担は${band.capText}（月100万円の医療費でも約${yen(cap100)}）で頭打ち。入院日額型の保障の大部分はこの範囲と重なります。上限額×数ヶ月分の貯蓄があれば、公的だけで受け止められる計算です。`,
        keep: '残す理由になるのは: 差額ベッド代（個室希望）・先進医療特約・長期入院への備え。',
        questions: ['この医療保険は、高額療養費適用後の自己負担（私の場合' + band.capText + '）のどの部分を埋める保障ですか？'],
      };
    case 'cancer':
      return {
        color: 'yellow', verdict: '上乗せの価値はある',
        reason: 'がんの治療費そのものは高額療養費の対象です。一方、通院治療の長期化・自由診療・収入減は公的の外側にあり、一時金型は使い道が自由という強みがあります。',
        keep: '確認どころ: 一時金の支払い条件（上皮内がんは対象か・複数回支払われるか）。',
        questions: ['このがん保険の給付のうち、高額療養費でカバーされない部分（自由診療・収入減）に効くのはどれですか？'],
      };
    case 'death-term': {
      const izoku = estimateIzokuKiso(profile.children) + (isEmployee(profile) ? estimateIzokuKosei(band) : 0);
      if (!profile.spouse && profile.children === 0) {
        return {
          color: 'green', verdict: '公的とかぶっている可能性',
          reason: '守る相手（配偶者・子）がいない場合、死亡保障は目的から確認が必要です。葬儀費用程度なら貯蓄で受け止められることが多く、整理候補の筆頭です。',
          keep: '残す理由になるのは: 親への仕送りなど、あなたの収入に頼る人が実際にいる場合。',
          questions: ['この死亡保険の受取人は誰で、その人は私の収入にどれくらい頼っていますか？'],
        };
      }
      if (izoku === 0) {
        return {
          color: 'red', verdict: 'あなたの本当の穴を埋めている可能性',
          reason: '18歳以下の子がいない自営業世帯では、遺族基礎年金は原則出ず、遺族厚生年金もありません。万一の時の公的な保障はほぼゼロ＝この死亡保険は公的の空白を埋めている可能性が高く、安易に削る対象ではありません。金額の根拠だけ確認を。',
          keep: '確認どころ: 保険金額が「配偶者の生活費 − 配偶者自身の収入」に見合っているか。',
          questions: ['遺族年金がほぼ出ない私の場合、この保険金額はどんな計算で決まっていますか？'],
        };
      }
      return {
        color: 'yellow', verdict: '上乗せの価値はある',
        reason: `万一の時、遺族年金が月あたり約${yen(Math.round(izoku / 12))}${self ? '（自営業は遺族厚生年金がない分、少なめ）' : ''}出ます。必要なのは「生活費 − 遺族年金 − 配偶者の収入」の差額だけ。保険金額がこの差額より大きすぎないか確認を。`,
        keep: '収入保障型（月額で受け取る形）は遺族年金と同じ形なので過不足を比べやすい。',
        questions: [`遺族年金（私の場合 月あたり約${yen(Math.round(izoku / 12))}の概算）を差し引いた上で、この保険金額の根拠を教えてください。`],
      };
    }
    case 'death-whole':
      return {
        color: 'yellow', verdict: '保障ではなく貯蓄として判定',
        reason: '終身保険は保障と貯蓄の混合商品です。保障目的なら定期型より割高、貯蓄目的なら利回り（返戻率）と中途解約の元本割れを確認する必要があります。',
        keep: '確認どころ: いま解約した場合の返戻金と、払込総額の差。',
        questions: ['この終身保険をいま解約した場合の返戻金と、これまでの払込総額を教えてください。', '同じ保障額を定期保険で買った場合の保険料はいくらですか？'],
      };
    case 'disability':
      if (self) {
        return {
          color: 'red', verdict: 'あなたの本当の穴を埋めている',
          reason: '自営業・フリーランスに傷病手当金はありません。働けなくなった時、障害年金の認定まで公的な収入保障は空白です。この保険はその空白を埋めている可能性が高く、安易に削る対象ではありません。',
          keep: '確認どころ: 免責期間（何日目から出るか）と、精神疾患が対象か。',
          questions: ['この就業不能保険の免責期間と、支払い対象外となる働けない理由を教えてください。'],
        };
      }
      return {
        color: 'yellow', verdict: '重なりと空白の境目を確認',
        reason: `会社員のあなたは傷病手当金（月あたり約${man(estimateShobyoMonthly(band))}×通算1年6ヶ月）があります。最初の1年6ヶ月をこの保険が二重にカバーしていないか、逆にその後の長期離脱に効く設計かで価値が変わります。`,
        keep: '価値があるのは: 支払いが1年6ヶ月より後まで続く長期型。',
        questions: ['この保険の給付は、傷病手当金が出ている最初の1年6ヶ月と重複しますか？その後は何歳まで出ますか？'],
      };
    case 'education':
      return {
        color: 'yellow', verdict: '保障ではなく貯蓄として判定',
        reason: '学資保険の実態は貯蓄です。返戻率が110%を下回るなら、つみたて等と比べて有利かの確認を。親の万一への備え（払込免除）は遺族年金と重ねて考えます。',
        keep: '確認どころ: 返戻率・中途解約の元本割れ・受け取り時期が入学金に間に合うか。',
        questions: ['この学資保険の返戻率と、いま中途解約した場合の返戻金を教えてください。'],
      };
    case 'annuity':
      return {
        color: 'yellow', verdict: '保障ではなく貯蓄として判定',
        reason: '個人年金は貯蓄商品です。税制優遇（個人年金保険料控除）はあるものの、iDeCo・NISAの枠を使い切っているかが先の論点になることが多いです。',
        keep: '確認どころ: 予定利率と、インフレで実質価値が目減りするリスク。',
        questions: ['この個人年金の実質利回りは、iDeCo・NISAと比べてどうですか？'],
      };
    default:
      return {
        color: 'yellow', verdict: '内容の確認から',
        reason: 'この種類は自動判定の対象外です。保障内容が公的保障（高額療養費・傷病手当金・遺族年金・障害年金）とどこで重なるかを、下の質問リストで確認してください。',
        keep: '',
        questions: ['この保険の保障は、公的保障とどこが重なり、どこが公的の外側ですか？'],
      };
  }
}

function renderResult() {
  const profile = state.profile;
  const judged = state.policies.map((p) => ({ policy: p, j: judgePolicy(p, profile) }));
  const greenMonthly = judged.filter((x) => x.j.color === 'green').reduce((sum, x) => sum + x.policy.premium, 0);
  const totalMonthly = state.policies.reduce((sum, p) => sum + p.premium, 0);

  const summary = document.getElementById('result-summary');
  summary.textContent = '';
  const big = document.createElement('div');
  big.className = 'big';
  big.textContent = greenMonthly > 0 ? `重複の可能性: 月${yen(greenMonthly)}` : '大きな重複は見つかりませんでした';
  summary.appendChild(big);
  const p1 = document.createElement('p');
  p1.textContent = greenMonthly > 0
    ? `年${yen(greenMonthly * 12)}、10年で${man(greenMonthly * 12 * 10)}。あなたの保険料合計 月${yen(totalMonthly)}のうち、公的保障と重なっている可能性のある部分です。`
    : `あなたの保険料合計は月${yen(totalMonthly)}。黄色の項目の確認どころを窓口で聞いてみてください。`;
  summary.appendChild(p1);
  const p2 = document.createElement('p');
  p2.className = 'note';
  p2.textContent = 'これは解約の推奨ではありません。「確認する価値がある場所」の地図です。';
  summary.appendChild(p2);

  const cards = document.getElementById('result-cards');
  cards.textContent = '';
  judged.forEach(({ policy, j }) => {
    const card = document.createElement('div');
    card.className = `result-card ${j.color}`;
    const h3 = document.createElement('h3');
    const verdict = document.createElement('span');
    verdict.className = 'verdict';
    verdict.textContent = j.verdict;
    h3.append(document.createTextNode(`${typeLabel(policy.type)} 月${yen(policy.premium)}`), verdict);
    const reason = document.createElement('p');
    reason.textContent = j.reason;
    card.append(h3, reason);
    if (policy.memo) {
      const memo = document.createElement('p');
      memo.className = 'keep';
      memo.textContent = `メモ: ${policy.memo}`;
      card.appendChild(memo);
    }
    if (j.keep) {
      const keep = document.createElement('p');
      keep.className = 'keep';
      keep.textContent = j.keep;
      card.appendChild(keep);
    }
    cards.appendChild(card);
  });

  const holes = [];
  if (!isEmployee(profile)) {
    holes.push('傷病手当金がない: 働けなくなってから障害年金までの収入は公的には空白。就業不能への備え（保険か、生活費1年分の貯蓄）はここに使う価値がある。');
    if (profile.spouse || profile.children > 0) holes.push('遺族厚生年金がない: 万一の保障は会社員より薄い。死亡保障は「削る」より「形を最適化する」対象。');
  } else {
    holes.push('傷病手当金が切れる1年6ヶ月後から障害年金までの「谷間」: 長期離脱への備えだけは公的が薄い。');
  }
  if (!state.policies.some((p) => p.type === 'disability') && !isEmployee(profile)) {
    holes.push('いまの保険リストに就業不能への備えがない: あなたの働き方では、医療保険より優先度が高い可能性がある。');
  }
  const holesBlock = document.getElementById('holes-block');
  holesBlock.textContent = '';
  if (holes.length) {
    const card = document.createElement('div');
    card.className = 'holes-card';
    const h2 = document.createElement('h2');
    h2.textContent = '🔴 本当の穴（公的にも民間にもない場所）';
    const ul = document.createElement('ul');
    holes.forEach((h) => {
      const li = document.createElement('li');
      li.textContent = h;
      ul.appendChild(li);
    });
    card.append(h2, ul);
    holesBlock.appendChild(card);
  }

  const questions = [...new Set(judged.flatMap((x) => x.j.questions).concat(FIXED_QUESTIONS))];
  const qList = document.getElementById('question-list');
  qList.textContent = '';
  questions.forEach((q) => {
    const li = document.createElement('li');
    li.textContent = q;
    qList.appendChild(li);
  });

  const cList = document.getElementById('cancel-checklist');
  cList.textContent = '';
  CANCEL_CHECKLIST.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c;
    cList.appendChild(li);
  });
}

document.getElementById('copy-questions').addEventListener('click', async (e) => {
  const items = [...document.querySelectorAll('#question-list li')].map((li, i) => `${i + 1}. ${li.textContent}`);
  const text = `【保険の窓口で聞くことリスト】\n${items.join('\n')}\n（保険ダイエットで作成・${DATA_AS_OF}の概算に基づく）`;
  try {
    await navigator.clipboard.writeText(text);
    e.target.textContent = 'コピーしました ✓';
  } catch (err) {
    e.target.textContent = 'コピーできませんでした';
  }
  setTimeout(() => { e.target.textContent = '質問リストをコピー'; }, 2000);
});

function drawCard(lines, filename) {
  const canvas = document.createElement('canvas');
  const w = 1080;
  const h = 260 + lines.length * 64;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d4d6e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8a33d';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('保険ダイエット', 60, 90);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.font = line.big ? 'bold 52px sans-serif' : '34px sans-serif';
    ctx.fillText(line.text, 60, 180 + i * 64);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '24px sans-serif';
  ctx.fillText(`${DATA_AS_OF}の概算・出典つき / 商品提案ゼロのアプリ`, 60, h - 40);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

document.getElementById('share-public').addEventListener('click', () => {
  const profile = state.profile;
  if (!profile) return;
  const band = bandOf(profile);
  const premium = estimatePublicPremium(band, profile.worker);
  const lines = [
    { text: '私、無保険じゃなかった。', big: true },
    premium ? { text: `毎月 約${yen(premium)} の公的保険に加入中` } : { text: `国民年金 月${yen(PENSION_2026.kokuminMonthly)}＋国保に加入中` },
    { text: `医療費の自己負担上限: ${band.capText}` },
  ];
  if (isEmployee(profile)) lines.push({ text: `働けない時: 月あたり約${man(estimateShobyoMonthly(band))}×1年6ヶ月` });
  drawCard(lines, 'hoken-diet-public.png');
});

document.getElementById('share-result').addEventListener('click', () => {
  const judged = state.policies.map((p) => ({ policy: p, j: judgePolicy(p, state.profile) }));
  const greenMonthly = judged.filter((x) => x.j.color === 'green').reduce((sum, x) => sum + x.policy.premium, 0);
  const lines = greenMonthly > 0
    ? [
        { text: `重複の可能性: 月${yen(greenMonthly)}`, big: true },
        { text: `年${yen(greenMonthly * 12)} / 10年で${man(greenMonthly * 12 * 10)}` },
        { text: '公的保障と重なっているかもしれない保険料' },
      ]
    : [
        { text: '大きな重複なし', big: true },
        { text: '確認どころリストを持って、窓口へ' },
      ];
  drawCard(lines, 'hoken-diet-result.png');
});

function renderStatic() {
  document.querySelectorAll('.asof').forEach((el) => { el.textContent = `数字はすべて${DATA_AS_OF}の概算です。実際の金額は加入している健康保険・年金記録で変わります。`; });
  const inline = document.querySelector('.asof-inline');
  if (inline) inline.textContent = DATA_AS_OF;
  const sourceList = document.getElementById('source-list');
  SOURCES.forEach((s) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = s.name;
    li.appendChild(a);
    sourceList.appendChild(li);
  });
}

document.getElementById('restart-btn').addEventListener('click', () => {
  if (!confirm('入力した保険と診断結果をすべて消して、最初からやり直しますか？')) return;
  state = { profile: null, policies: [] };
  localStorage.removeItem(STORE_KEY);
  renderPolicyList();
  document.getElementById('wizard-form').reset();
  show('wizard');
});

function renderResume() {
  const btn = document.getElementById('resume-btn');
  if (!state.profile) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.textContent = state.policies.length ? '前回の3色マップを見る' : '前回の公的保障カードを見る';
  btn.onclick = () => {
    if (state.policies.length) { renderResult(); show('result'); }
    else { renderPublic(); show('public'); }
  };
}

loadState();
renderStatic();
renderPolicyList();
if (state.profile) renderPublic();
renderResume();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
