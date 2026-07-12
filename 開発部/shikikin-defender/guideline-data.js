// 国土交通省「原状回復をめぐるトラブルとガイドライン（再改訂版）」の人手キュレーション
// burden: 'lender'=貸主負担 / 'tenant'=借主負担 / 'depends'=条件次第
// dep: 経過年数（耐用年数）考慮 { years, note } / null=考慮なし
// range: 借主負担になる場合の「負担範囲」の原則
const GUIDELINE_VERSION = '国交省・原状回復をめぐるトラブルとガイドライン（再改訂版）準拠 / 2026-07-12編集';

const DEP_MASTER = {
  cloth: { years: 6, label: '壁クロス' },
  carpet: { years: 6, label: 'カーペット' },
  cf: { years: 6, label: 'クッションフロア' },
  aircon: { years: 6, label: 'エアコン' },
  sink: { years: 5, label: '流し台' },
  tatamiDoko: { years: 6, label: '畳床' },
  appliance: { years: 8, label: '冷蔵庫・ガスレンジ等' },
  plumbing: { years: 15, label: '便器・洗面台等の給排水設備' },
};

const CATEGORIES = [
  { id: 'wall', name: '壁・天井（クロス）', emoji: '🧱' },
  { id: 'floor', name: '床（フローリング・カーペット）', emoji: '🪵' },
  { id: 'tatami', name: '畳・襖・障子・柱', emoji: '🎋' },
  { id: 'water', name: '水回り（キッチン・風呂・トイレ）', emoji: '🚿' },
  { id: 'equip', name: '設備・建具（鍵・ガラス・エアコン）', emoji: '🔑' },
  { id: 'exit', name: '退去時に請求されがちな費用', emoji: '🧾' },
];

const ITEMS = [
  // ================= 壁・天井（クロス） =================
  {
    id: 'wall-sunburn', cat: 'wall', title: '日照による壁・天井の変色（日焼け）', burden: 'lender',
    basis: '日照など自然現象によるクロスの変色は「建物の自然な劣化」。ガイドラインは賃貸人（大家さん）負担と整理している。',
    tip: '「自然損耗は家賃に含まれている」がガイドラインの基本的な考え方。請求されたらこの項目を見せる。',
    dep: null, range: null,
  },
  {
    id: 'wall-tvyake', cat: 'wall', title: 'テレビ・冷蔵庫の裏の黒ずみ（電気ヤケ）', burden: 'lender',
    basis: 'テレビ・冷蔵庫等の後部壁面の黒ずみ（いわゆる電気ヤケ）は「通常の生活で避けられないもの」として賃貸人負担。',
    tip: '家電を置くのは普通の暮らし方。設置場所が常識的なら堂々と主張してよい。',
    dep: null, range: null,
  },
  {
    id: 'wall-poster', cat: 'wall', title: 'ポスター・カレンダーの画鋲の穴（下地の補修不要）', burden: 'lender',
    basis: '画鋲・ピン等の穴で下地ボードの張替えが不要な程度のものは、通常の損耗として賃貸人負担。',
    tip: '「穴の深さ」が分かれ目。画鋲程度は通常使用の範囲、が原則。',
    dep: null, range: null,
  },
  {
    id: 'wall-screw', cat: 'wall', title: 'くぎ穴・ネジ穴（下地ボードの補修が必要な程度）', burden: 'tenant',
    basis: '重量物の掲示等でくぎ・ネジを使い、下地ボードの張替えが必要な程度の穴は、通常の使用を超えるとして賃借人（借主）負担。',
    tip: '負担するとしても、クロスは経過年数で価値が減る（6年で残存価値1円）。全額請求はまず過大。',
    dep: DEP_MASTER.cloth, range: '穴の箇所を含む㎡単位（または最低限の面）が原則。部屋全面の張替費用は原則過大。',
  },
  {
    id: 'wall-tabako', cat: 'wall', title: 'タバコのヤニ・臭い（クロス変色）', burden: 'tenant',
    basis: '喫煙によりクロスがヤニで変色・臭いが付着した場合は、通常の使用を超えるとして賃借人負担と整理されている。',
    tip: '負担は認めつつ「クロス6年償却」の計算は必ず入れる。長く住んだなら負担割合は小さい。',
    dep: DEP_MASTER.cloth, range: '汚損が部屋全体に及ぶ場合は当該居室全体が範囲になりうる。',
  },
  {
    id: 'wall-oil', cat: 'wall', title: '台所の壁の油汚れ（手入れを怠ったもの）', burden: 'tenant',
    basis: '使用後の手入れが悪くススや油が付着した場合は、通常の使用を超えるとして賃借人負担。',
    tip: '通常のクリーニングで落ちる程度なら「張替」でなく「清掃費用」が筋。',
    dep: DEP_MASTER.cloth, range: '汚れた箇所の㎡単位が原則。',
  },
  {
    id: 'wall-ketsuro', cat: 'wall', title: '結露を放置して拡大したカビ・シミ', burden: 'tenant',
    basis: '結露が発生しているのに大家さんに知らせず、拭き取り等もせず放置して拡大させたカビ・シミは、管理義務（善管注意義務）違反として賃借人負担。',
    tip: '逆に「結露は建物側の問題（断熱不足）」で、通知していた記録があれば貸主負担を主張できる。連絡履歴を探そう。',
    dep: DEP_MASTER.cloth, range: '拡大させた部分。',
  },
  {
    id: 'wall-rakugaki', cat: 'wall', title: '子どもの落書き', burden: 'tenant',
    basis: '故意・過失による汚損として賃借人負担。',
    tip: 'ここも経過年数考慮（クロス6年）は適用される。',
    dep: DEP_MASTER.cloth, range: '落書き箇所を含む㎡単位が原則。',
  },
  {
    id: 'wall-airconbisu', cat: 'wall', title: '借主が設置したエアコンのビス穴・跡', burden: 'lender',
    basis: 'エアコン設置は一般的な生活の範囲であり、そのビス穴・跡は通常の損耗として賃貸人負担と整理されている。',
    tip: '「自分で付けたから自分持ち」と言われがちだが、ガイドラインは貸主負担側。',
    dep: null, range: null,
  },
  // ================= 床 =================
  {
    id: 'floor-hekomi', cat: 'floor', title: '家具の設置による床のへこみ・設置跡', burden: 'lender',
    basis: '家具の設置は通常の使用方法であり、そのへこみ・設置跡は賃貸人負担。',
    tip: '「ベッドの脚の跡」「本棚の跡」などはすべてこれ。最頻出の請求なので真っ先に確認。',
    dep: null, range: null,
  },
  {
    id: 'floor-wax', cat: 'floor', title: 'フローリングのワックスがけ', burden: 'lender',
    basis: 'ワックスがけは通常の生活で必ず必要なものではなく、物件の価値を維持する管理の一環なので賃貸人負担。',
    tip: '「ワックス費用」の名目請求はガイドライン上は貸主負担側。',
    dep: null, range: null,
  },
  {
    id: 'floor-hikkoshi', cat: 'floor', title: '引越し作業・模様替えでついた引っかきキズ', burden: 'tenant',
    basis: '引越作業等で生じた引っかきキズは、故意・過失によるものとして賃借人負担。',
    tip: 'フローリングの部分補修は経過年数を考慮しない代わりに、負担範囲は原則㎡単位。「全面張替」は過大。',
    dep: null, range: 'キズ部分の㎡単位が原則（全面張替は原則過大。全面の場合も建物耐用年数で残存価値考慮）。',
  },
  {
    id: 'floor-caster', cat: 'floor', title: 'キャスター付き椅子等によるキズ・へこみ', burden: 'tenant',
    basis: 'キャスターの転がしによるフローリングのキズ・へこみは、通常の使用を超えるものとして賃借人負担とされやすい。',
    tip: '保護マットを敷いていた・軽微な範囲なら通常損耗側を主張する余地はある。写真で程度を残す。',
    dep: null, range: 'キズ部分の㎡単位が原則。',
  },
  {
    id: 'floor-carpet-stain', cat: 'floor', title: 'カーペットの飲みこぼしのシミ・カビ（放置）', burden: 'tenant',
    basis: '飲み物等をこぼした後の手入れ不足によるシミ・カビは賃借人負担。',
    tip: 'カーペットは6年で残存価値1円。長期入居なら負担はごく小さい。',
    dep: DEP_MASTER.carpet, range: '洗浄等で済むなら洗浄費用まで。取替は原則、毀損部分（1枚単位）。',
  },
  {
    id: 'floor-reizouko-sabi', cat: 'floor', title: '冷蔵庫下のサビ跡（放置して汚損）', burden: 'tenant',
    basis: 'サビを放置し、床に汚損等の損害を与えた場合は賃借人負担。',
    tip: 'サビ跡が「拭けば落ちる」程度なら清掃費用の範囲が筋。',
    dep: DEP_MASTER.cf, range: '汚損箇所の㎡単位が原則。',
  },
  {
    id: 'floor-ame', cat: 'floor', title: '雨の吹き込み放置による床の色落ち・腐食', burden: 'tenant',
    basis: '窓の閉め忘れ等、通常の注意を欠いた雨の吹き込みの放置による色落ちは賃借人負担。',
    tip: '台風・建物側の欠陥（サッシの不具合）由来なら貸主負担側。原因を切り分ける。',
    dep: null, range: '色落ち部分の㎡単位が原則。',
  },
  {
    id: 'floor-sunburn', cat: 'floor', title: '日照による床・カーペットの色落ち', burden: 'lender',
    basis: '日照は通常の生活で避けられない自然現象であり、賃貸人負担。',
    tip: null, dep: null, range: null,
  },
  // ================= 畳・襖・障子・柱 =================
  {
    id: 'tatami-sunburn', cat: 'tatami', title: '畳の日焼け・自然な変色', burden: 'lender',
    basis: '日照等による畳の変色は自然損耗として賃貸人負担。',
    tip: null, dep: null, range: null,
  },
  {
    id: 'tatami-uragaeshi', cat: 'tatami', title: '畳の裏返し・表替え（破損させていない）', burden: 'lender',
    basis: '特に破損等がないのに次の入居者確保のために行う畳の裏返し・表替えは、賃貸人負担。',
    tip: '「退去時は畳表替え」の請求は、破損がなければガイドライン上は貸主負担側。特約がある場合は特約の有効性を確認（🧾カテゴリ参照）。',
    dep: null, range: null,
  },
  {
    id: 'tatami-stain', cat: 'tatami', title: '畳の飲みこぼしのシミ（手入れ不足）', burden: 'tenant',
    basis: 'こぼした後の手入れ不足によるシミ・カビは賃借人負担。',
    tip: '負担範囲は原則「その1枚」。部屋全部の表替え請求は過大。',
    dep: null, range: '毀損した畳1枚単位（畳表は消耗品扱いで経過年数は考慮されない）。',
  },
  {
    id: 'tatami-pet', cat: 'tatami', title: 'ペットによる柱・クロス等のキズ・臭い', burden: 'tenant',
    basis: 'ペットによるキズ・臭いは通常の使用を超えるとして賃借人負担（特に共同住宅での飼育）。',
    tip: '臭い消毒・クリーニングの範囲が争点になりやすい。実際にキズ・臭いがある箇所の記録を先に残す。',
    dep: DEP_MASTER.cloth, range: 'キズ・臭いの及ぶ箇所（クロスは㎡単位）。',
  },
  {
    id: 'tatami-fusuma-sunburn', cat: 'tatami', title: '襖・障子の日焼け（自然な変色）', burden: 'lender',
    basis: '日照等の自然現象による襖紙・障子紙の変色は賃貸人負担。',
    tip: '襖紙・障子紙は消耗品扱い。破いた場合（借主負担）でも経過年数は考慮されず、1枚単位の張替が原則。',
    dep: null, range: null,
  },
  // ================= 水回り =================
  {
    id: 'water-kabi', cat: 'water', title: '風呂・トイレの水垢・カビ（手入れを怠った）', burden: 'tenant',
    basis: '使用期間中の手入れを怠り、水垢・カビ等を付着させた場合は賃借人負担。',
    tip: '「通常のクリーニングで落ちる」なら清掃費用まで。設備交換の請求は過大なことが多い。',
    dep: null, range: '汚損箇所の清掃・補修まで（設備全体の交換は原則過大）。',
  },
  {
    id: 'water-abura', cat: 'water', title: '換気扇・ガスコンロ周りの油汚れ（手入れ不足）', burden: 'tenant',
    basis: '使用後の手入れが悪く、スス・油が付着している場合は賃借人負担。',
    tip: '日常的に掃除していたなら通常損耗側。退去前に一度しっかり掃除して写真を残すと強い。',
    dep: null, range: '汚損箇所の清掃費用まで。',
  },
  {
    id: 'water-yokusou', cat: 'water', title: '浴槽・風呂釜の経年劣化による取替', burden: 'lender',
    basis: '破損等がなく、経年劣化や次の入居者確保のために行う浴槽・風呂釜の取替は賃貸人負担。',
    tip: null, dep: null, range: null,
  },
  {
    id: 'water-morehouchi', cat: 'water', title: '水漏れを放置したことによる腐食・カビ拡大', burden: 'tenant',
    basis: '水漏れに気づきながら大家さんに知らせず放置し、被害を拡大させた場合は通知義務・善管注意義務違反として賃借人負担。',
    tip: '管理会社への連絡記録（電話・メール・アプリ）があれば流れが変わる。履歴を探して交渉メモに書く。',
    dep: null, range: '拡大させた損害部分。',
  },
  {
    id: 'water-normal', cat: 'water', title: '日常的に掃除していた範囲の通常の汚れ', burden: 'lender',
    basis: '賃借人が通常の清掃を行っていた場合の自然な汚れ・劣化は通常損耗として賃貸人負担。',
    tip: '退去前掃除の後に各所を撮影しておくと「通常の清掃をしていた」証拠になる。',
    dep: null, range: null,
  },
  // ================= 設備・建具 =================
  {
    id: 'equip-key-lost', cat: 'equip', title: '鍵の紛失・破損による交換', burden: 'tenant',
    basis: '鍵を紛失・破損した場合の交換費用は賃借人負担。経過年数は考慮されず、シリンダー交換の実費が原則。',
    tip: '「グレードアップした高級シリンダー」への交換費用の上乗せは過大。同等品の実費まで。',
    dep: null, range: 'シリンダー交換の実費（同等品）。',
  },
  {
    id: 'equip-key-normal', cat: 'equip', title: '鍵の交換（紛失なし・次の入居者の防犯目的）', burden: 'lender',
    basis: '破損・紛失がないのに行う防犯目的の鍵交換は、物件管理上の問題として賃貸人負担。',
    tip: '退去時の「鍵交換費用」請求の定番。紛失していないなら支払い根拠を確認する。',
    dep: null, range: null,
  },
  {
    id: 'equip-glass-jishin', cat: 'equip', title: '地震・自然災害で破損したガラス', burden: 'lender',
    basis: '地震等の不可抗力による破損は賃借人に責任がなく、賃貸人負担。',
    tip: null, dep: null, range: null,
  },
  {
    id: 'equip-glass-netsu', cat: 'equip', title: '網入りガラスの亀裂（熱割れなど構造的なもの）', burden: 'lender',
    basis: 'ガラスの加工処理の問題で自然に発生した亀裂（熱割れ等）は賃貸人負担。',
    tip: 'ぶつけた記憶がないガラスのヒビは熱割れの可能性を確認。',
    dep: null, range: null,
  },
  {
    id: 'equip-amido', cat: 'equip', title: '網戸の張替（破損していない）', burden: 'lender',
    basis: '破損等がないのに次の入居者確保のために行う網戸の張替は賃貸人負担。',
    tip: null, dep: null, range: null,
  },
  {
    id: 'equip-shomei', cat: 'equip', title: '天井に直接つけた照明器具の跡', burden: 'tenant',
    basis: '照明器具設置用の器具（引掛シーリング等）を使わず天井に直接設置した場合の跡は賃借人負担。',
    tip: '既設の引掛シーリングを使った照明なら跡は通常損耗側。',
    dep: DEP_MASTER.cloth, range: '跡の箇所（天井クロスは㎡単位）。',
  },
  {
    id: 'equip-aircon-naibu', cat: 'equip', title: 'エアコンの内部洗浄（タバコ等の臭いなし）', burden: 'lender',
    basis: '通常の使用による内部の汚れの洗浄は、物件の維持管理として賃貸人負担。',
    tip: '喫煙による臭い付着があると借主負担側に傾く。',
    dep: null, range: null,
  },
  {
    id: 'equip-taiyou', cat: 'equip', title: '設備が耐用年数を超えて故障（通常使用）', burden: 'lender',
    basis: '経年劣化による設備の故障・取替は賃貸人負担。耐用年数を超えた設備は残存価値1円であり、借主が壊しても賠償額は限定される（ただし使用可能だった場合の修繕費用等は別途争点）。',
    tip: '「入居時から古かった設備」の交換請求には設置年を確認する。',
    dep: null, range: null,
  },
  // ================= 退去時に請求されがちな費用 =================
  {
    id: 'exit-cleaning', cat: 'exit', title: 'ハウスクリーニング費用（通常の清掃はしていた）', burden: 'depends',
    basis: '原則は賃貸人負担（次の入居者確保のためのもの）。ただし「借主がクリーニング費用を負担する」特約は、①負担内容が明確 ②金額がおおむね相場 ③借主が内容を認識して合意、の要件を満たせば有効とされることが多い。',
    tip: '契約書の特約条項と金額を確認。相場から大きく外れた金額・「一式」など不明確な記載なら交渉の余地がある。',
    dep: null, range: '有効な特約がある場合、特約の金額まで。',
  },
  {
    id: 'exit-tokuyaku', cat: 'exit', title: '「通常損耗も借主負担」とする特約', burden: 'depends',
    basis: '通常損耗・経年変化まで借主負担とする特約は、借主が負担範囲を具体的に認識し、暴利的でないなど厳しい要件を満たさなければ効力が争われる（最高裁平成17年判決の考え方）。',
    tip: '契約時に具体的な説明を受けた記憶がなければ、その旨を交渉メモに書く。消費生活センター（188）に相談できる論点。',
    dep: null, range: null,
  },
  {
    id: 'exit-zenmen', cat: 'exit', title: '一部のキズ・汚れなのに「全面張替」を請求された', burden: 'depends',
    basis: '借主負担となる場合でも、負担範囲は「毀損部分の最低限の施工単位（クロスは㎡、畳は1枚、フローリングは部分補修）」が原則。全面張替が必要な合理的理由がなければ過大請求。',
    tip: '見積書の「数量」欄を確認。部屋全体の㎡数になっていたら根拠を質問する。',
    dep: null, range: '毀損部分の最低限の施工単位。',
  },
  {
    id: 'exit-keika', cat: 'exit', title: '経過年数（住んだ年数）が考慮されていない請求', burden: 'depends',
    basis: '借主負担となる場合でも、クロス・カーペット等は耐用年数（多くは6年）で残存価値が直線的に減り、最終的に1円になる。新品価格での全額請求はガイドラインの考え方に反する。',
    tip: 'このアプリの「住んだ年数」を入力すると各項目で負担割合の目安が出る。見積が新品全額なら再計算を求める。',
    dep: null, range: null,
  },
  {
    id: 'exit-shikibiki', cat: 'exit', title: '敷金がなかなか返ってこない・敷引き', burden: 'depends',
    basis: '敷金は退去・明渡し後、未払賃料や借主負担分を差し引いて遅滞なく返還されるべきもの（民法622条の2）。返還額の内訳明細を求めることができる。',
    tip: '「精算書（内訳）を書面でください」が第一歩。納得できない場合は消費生活センター（188）や少額訴訟という手段もある。',
    dep: null, range: null,
  },
];
