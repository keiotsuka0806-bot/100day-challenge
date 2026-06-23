/* 段取り（Dandori）— 手続きデータ
 * 事実は人手でキュレーション（AIに生成させない＝ハルシネ事故ゼロ）。
 * 自治体・契約で細部が異なるため、各タスクは「公式で最終確認」を前提にした案内に留める。
 * place（引越しで使用）: 'old' 旧住所 / 'new' 新住所 / 'either' ネット・電話など
 */

const PLACE_LABELS = {
  old: '引越し前の場所',
  new: '引越し後の場所',
  either: 'ネット・電話など',
};

/* ============================ 引越し ============================ */
const MOVE_QUESTIONS = [
  {
    id: 'moveType', type: 'choice', label: '引越し先は？', default: 'different',
    options: [
      { value: 'different', label: '今と違う市区町村へ' },
      { value: 'same', label: '同じ市区町村の中で' },
    ],
  },
  { id: 'rentOld', type: 'bool', label: '今の住まいは賃貸ですか？', default: true },
  { id: 'homeOwnerMove', type: 'bool', label: '家の売却・購入をともなう引越しですか？（持ち家）', default: false },
  { id: 'hasKids', type: 'bool', label: '一緒に引越す小・中学生の子どもがいますか？', default: false },
  { id: 'hasPreschool', type: 'bool', label: '保育園・幼稚園に通うお子さんがいますか？', default: false },
  { id: 'childAllowance', type: 'bool', label: '児童手当を受け取っていますか？（中学生以下の子）', default: false },
  { id: 'pregnant', type: 'bool', label: '妊娠中の方がいますか？', default: false },
  { id: 'hasLicense', type: 'bool', label: '運転免許証を持っていますか？', default: true },
  { id: 'hasCar', type: 'bool', label: '自動車（普通車・軽）を持っていますか？', default: false },
  { id: 'hasBike', type: 'bool', label: '原付・バイクを持っていますか？', default: false },
  { id: 'hasPet', type: 'bool', label: '犬を飼っていますか？', default: false },
  {
    id: 'insurance', type: 'choice', label: '健康保険は？', default: 'shaho',
    options: [
      { value: 'kokuho', label: '国民健康保険（自営業・無職など）' },
      { value: 'shaho', label: '勤務先の社会保険' },
      { value: 'unknown', label: 'わからない' },
    ],
  },
  { id: 'kokunenkin', type: 'bool', label: '国民年金（第1号：自営業・学生・無職など）ですか？', default: false },
  { id: 'careInsurance', type: 'bool', label: '介護保険の対象（65歳以上、または要介護認定）の方がいますか？', default: false },
  { id: 'disability', type: 'bool', label: '障害者手帳・福祉手当を受けている方がいますか？', default: false },
  { id: 'inkan', type: 'bool', label: '印鑑登録をしていますか？', default: false },
  { id: 'mynumber', type: 'bool', label: 'マイナンバーカードを持っていますか？', default: true },
];

const MOVE_PHASES = [
  { id: 'before', label: '引越し前（〜2週間以上前）', hint: '早く動くほど楽。まず連絡系から。' },
  { id: 'pre', label: '直前（2週間前〜前日）', hint: '旧住所での手続き・ライフラインの停止/開始。' },
  { id: 'after', label: '当日〜14日以内', hint: '新住所の役所まわり。期限14日のものが多い。' },
  { id: 'settled', label: '落ち着いてから', hint: '各種の住所変更。忘れがちなので最後にまとめて。' },
];

const MOVE_TASKS = [
  { id: 'rent-cancel', phase: 'before', place: 'old', title: '今の賃貸の解約を連絡', when: 'できるだけ早く（多くは退去1ヶ月前まで）', where: '管理会社・大家', bring: [], note: '契約書で「解約予告期間」を確認。遅れると違約金・余分な家賃が発生することがある。', show: (a) => a.rentOld },
  { id: 'mover', phase: 'before', place: 'either', title: '引越し業者の手配・見積もり', when: '1ヶ月前が目安（繁忙期3〜4月はさらに早く）', where: 'ネット・電話', bring: [], note: '複数社で相見積もりを。日時が決まると後続の手続きが一気に進む。', show: () => true },
  { id: 'net', phase: 'before', place: 'either', title: 'インターネット回線の移転・新規', when: '2〜4週間前（工事待ちで遅れがち）', where: '契約中のプロバイダ（ネット・電話）', bring: [], note: '開通に時間がかかることがあるので早めに。引越し先で使えるか（エリア・設備）も確認。', show: () => true },
  { id: 'school-out', phase: 'before', place: 'old', title: '子どもの転校手続き（在学校へ連絡）', when: '転居が決まり次第', where: '今通っている学校', bring: [], note: '「在学証明書」「教科書給与証明書」を受け取る。これが転入先の学校で必要になる。', show: (a) => a.hasKids },
  { id: 'hoiku-out', phase: 'before', place: 'old', title: '今の保育園・幼稚園に退園を連絡', when: '転居が決まり次第（早め）', where: '今の園・自治体', bring: [], note: '退園届を提出。月途中退園の扱いや保育料の精算も確認を。', show: (a) => a.hasPreschool },
  { id: 'sodaigomi', phase: 'before', place: 'old', title: '不用品・粗大ごみの処分予約', when: '2週間前まで', where: '今の自治体の粗大ごみ受付', bring: [], note: '回収日が先になりやすい。早めに予約を。', show: () => true },
  { id: 'fire-new', phase: 'before', place: 'either', title: '新居の火災保険・地震保険の契約', when: '新居の契約時〜入居まで', where: '保険会社・不動産会社（ネット・窓口）', bring: [], note: '賃貸は契約時に加入を求められることが多い。持ち家もローン条件で必須の場合あり。旧居の解約も忘れずに。', show: () => true },
  { id: 'parking', phase: 'before', place: 'either', title: '駐車場の契約（新居）', when: '入居まで', where: '不動産会社・駐車場運営', bring: [], note: '車庫証明（後の手続き）にも必要。空き状況があるので早めに。', show: (a) => a.hasCar },

  { id: 'tenshutsu', phase: 'pre', place: 'old', title: '転出届を出す', when: '引越し14日前〜当日（自治体により前後）', where: '今の市区町村の役所', bring: ['本人確認書類', '印鑑（自治体による）'], note: '「転出証明書」を受け取り、新住所の転入届で使う。マイナンバーカードがあればオンライン転出も可能。', gov: true, show: (a) => a.moveType === 'different' },
  { id: 'denki', phase: 'pre', place: 'either', title: '電気の停止・開始の連絡', when: '1週間前まで', where: '電力会社（ネット・電話）', bring: [], note: '旧居の停止日と新居の開始日を伝える。お客様番号があるとスムーズ。', show: () => true },
  { id: 'gas', phase: 'pre', place: 'either', title: 'ガスの停止・開始の連絡', when: '1週間前まで（開栓は立会い予約が必要）', where: 'ガス会社（ネット・電話）', bring: [], note: '新居の開栓は立会いが必要なことが多い。引越し当日に間に合うよう早めに予約。', show: () => true },
  { id: 'water', phase: 'pre', place: 'either', title: '水道の停止・開始の連絡', when: '数日前まで', where: '水道局（ネット・電話）', bring: [], note: '新居で当日から使えるよう開始日を伝える。', show: () => true },
  { id: 'yubin', phase: 'pre', place: 'either', title: '郵便物の転送届（転居届）', when: '引越し1週間前まで', where: '郵便局 / e転居（ネット）', bring: [], note: '旧住所宛の郵便を1年間、新住所へ無料転送してくれる。住所変更の取りこぼし対策に必須。', link: { label: '日本郵便 転居・転送サービス', url: 'https://www.post.japanpost.jp/service/tenkyo/' }, show: () => true },
  { id: 'child-allowance-out', phase: 'pre', place: 'old', title: '児童手当「受給事由消滅届」', when: '転出のとき', where: '今の市区町村の役所', bring: [], note: '市外へ引越す場合、今の自治体での受給を止め、新自治体で改めて申請（後述）。', gov: true, show: (a) => a.childAllowance && a.moveType === 'different' },
  { id: 'kaigo-out', phase: 'pre', place: 'old', title: '介護保険の受給資格証明書をもらう', when: '転出のとき', where: '今の市区町村の役所（介護保険の窓口）', bring: ['介護保険被保険者証'], note: '要介護認定を受けている人向け。これを新住所で14日以内に出すと認定を引き継げる。市外への引越し時に必要。', gov: true, show: (a) => a.careInsurance && a.moveType === 'different' },

  { id: 'tennyu', phase: 'after', place: 'new', title: '転入届を出す', when: '引越し後14日以内', where: '新住所の市区町村の役所', bring: ['転出証明書', '本人確認書類', 'マイナンバーカード（あれば）'], note: '14日を過ぎると過料の対象になることがある。多くの手続きの起点なので最優先。', gov: true, show: (a) => a.moveType === 'different' },
  { id: 'tenkyo', phase: 'after', place: 'new', title: '転居届を出す', when: '引越し後14日以内', where: '住んでいる市区町村の役所', bring: ['本人確認書類', 'マイナンバーカード（あれば）'], note: '同一市区町村内の引越しは「転居届」。転出入届は不要。', gov: true, show: (a) => a.moveType === 'same' },
  { id: 'juminhyo', phase: 'after', place: 'new', title: '住民票の写しを数通もらっておく', when: '転入・転居届のついでに', where: '新住所の役所', bring: ['本人確認書類'], note: '運転免許・自動車・銀行などの住所変更で何度も使う。まとめて取ると二度手間が減る。', gov: true, show: () => true },
  { id: 'shaho-notify', phase: 'after', place: 'either', title: '勤務先へ住所変更を届け出る', when: '引越し後すみやかに', where: '勤務先（総務・人事）', bring: [], note: '健康保険・住民税・通勤手当などは会社経由で手続き。新住所とマイナンバーを伝える。', show: (a) => a.insurance === 'shaho' },
  { id: 'mynumber-addr', phase: 'after', place: 'new', title: 'マイナンバーカードの住所変更', when: '引越し後14日以内（転入・転居届と同時が楽）', where: '新住所の役所', bring: ['マイナンバーカード', '暗証番号'], note: '住所変更と継続利用の手続き。家族分も忘れずに。', gov: true, show: (a) => a.mynumber },
  { id: 'kokuho', phase: 'after', place: 'new', title: '国民健康保険の住所変更・加入', when: '引越し後14日以内', where: '新住所の役所（国保の窓口）', bring: ['本人確認書類'], note: '市外へ移る場合は旧自治体で資格喪失、新自治体で加入。同一市内は住所変更。社保の人は勤務先で手続き。', gov: true, show: (a) => a.insurance === 'kokuho' },
  { id: 'nenkin', phase: 'after', place: 'new', title: '国民年金（第1号）の住所変更', when: '引越し後すみやかに', where: '新住所の役所（年金の窓口）', bring: ['年金手帳・基礎年金番号がわかるもの'], note: 'マイナンバーで原則自動更新だが、届出が必要な場合もあるので役所で確認を。', gov: true, show: (a) => a.kokunenkin },
  { id: 'inkan-reg', phase: 'after', place: 'new', title: '印鑑登録（再登録）', when: '必要になる前に', where: '新住所の役所', bring: ['登録する印鑑', '本人確認書類'], note: '市外へ移ると旧登録は失効する。新住所で登録し直す。', gov: true, show: (a) => a.inkan },
  { id: 'child-allowance-in', phase: 'after', place: 'new', title: '児童手当の認定請求', when: '引越し後15日以内が目安', where: '新住所の役所', bring: ['請求者の口座がわかるもの', '本人確認書類'], note: '遅れると手当を受け取れない月が出ることがある。早めに。', gov: true, show: (a) => a.childAllowance },
  { id: 'kodomo-iryo', phase: 'after', place: 'new', title: '子ども医療費助成の手続き', when: '転入手続きとあわせて', where: '新住所の役所', bring: ['子の健康保険証', '本人確認書類'], note: '自治体ごとに制度が違う。新しい医療証を発行してもらう。', gov: true, show: (a) => a.hasKids },
  { id: 'school-in', phase: 'after', place: 'new', title: '転校先へ書類を提出', when: '転入届の後すぐ', where: '新住所の役所→転入先の学校', bring: ['在学証明書', '教科書給与証明書'], note: '役所で「転入学通知書」を受け取り、在学校でもらった書類と一緒に新しい学校へ。', gov: true, show: (a) => a.hasKids },
  { id: 'hoiku-in', phase: 'after', place: 'new', title: '新住所で保育園・幼稚園の利用申込', when: 'できるだけ早く（入園枠・申込期限あり）', where: '新住所の自治体（保育課）', bring: ['就労証明書など（保育園の場合）'], note: '認可保育園は申込期限・選考があり待機になることも。転居前から新自治体に相談しておくと安心。', gov: true, show: (a) => a.hasPreschool },
  { id: 'boshi-techo', phase: 'after', place: 'new', title: '母子健康手帳・妊婦健診助成の引き継ぎ', when: '転入手続きとあわせて', where: '新住所の役所・保健センター', bring: ['母子健康手帳', '未使用の妊婦健診の受診票'], note: '健診の助成（受診票）は自治体ごと。旧自治体の未使用分を新自治体のものに交換してもらう。', gov: true, show: (a) => a.pregnant },
  { id: 'kaigo-in', phase: 'after', place: 'new', title: '介護保険の住所変更・認定の引き継ぎ', when: '引越し後14日以内', where: '新住所の役所（介護保険の窓口）', bring: ['受給資格証明書（旧自治体で発行）', '介護保険被保険者証'], note: '14日以内に受給資格証明書を出すと要介護認定を引き継げる。対象年齢なら住所変更のみの場合もある。', gov: true, show: (a) => a.careInsurance },
  { id: 'shogai', phase: 'after', place: 'new', title: '障害者手帳・福祉手当の住所変更', when: '転入手続きとあわせて', where: '新住所の役所（福祉の窓口）', bring: ['障害者手帳', '本人確認書類'], note: '手帳の住所変更、各種手当・医療費助成・福祉サービスの引き継ぎ。自治体で制度が異なるので相談を。', gov: true, show: (a) => a.disability },
  { id: 'dog', phase: 'after', place: 'new', title: '飼い犬の登録住所変更', when: '引越し後30日以内が目安', where: '新住所の役所・保健所', bring: ['鑑札', '狂犬病予防注射済票'], note: '登録は市区町村ごと。引越したら住所変更（または新規登録）が必要。', gov: true, show: (a) => a.hasPet },

  { id: 'menkyo', phase: 'settled', place: 'new', title: '運転免許証の住所変更', when: '早めに（更新ハガキが届かなくなるため）', where: '新住所の警察署・運転免許センター', bring: ['運転免許証', '新住所が確認できる書類（住民票・マイナカード等）'], note: '本人確認の基本書類なので、住所を最新にしておくと他の手続きも楽。', gov: true, show: (a) => a.hasLicense },
  { id: 'shako', phase: 'settled', place: 'new', title: '車庫証明の取得', when: '車検証変更の前に', where: '新住所の警察署', bring: ['保管場所の書類', '印鑑'], note: '自動車の住所変更（車検証）に必要な前提手続き。', gov: true, show: (a) => a.hasCar },
  { id: 'shaken', phase: 'settled', place: 'new', title: '自動車（車検証）の住所変更', when: '引越し後15日以内（法令上の期限）', where: '新住所管轄の運輸支局', bring: ['車検証', '車庫証明', '新住所の住民票'], note: 'ナンバー変更が必要な場合もある。手続きは行政書士に代行依頼も可能。', gov: true, show: (a) => a.hasCar },
  { id: 'bike', phase: 'settled', place: 'new', title: '原付・バイクの住所変更', when: '引越し後すみやかに', where: '125cc以下は新住所の役所／それ以上は運輸支局', bring: ['標識交付証明書 など'], note: '排気量で窓口が違う。125cc以下（原付）は市区町村の役所。', gov: true, show: (a) => a.hasBike },
  { id: 'bank', phase: 'settled', place: 'either', title: '銀行口座の住所変更', when: '落ち着いたら', where: 'アプリ・窓口', bring: [], note: 'カード・通帳の郵送物が新住所に届くように。', show: () => true },
  { id: 'card', phase: 'settled', place: 'either', title: 'クレジットカードの住所変更', when: '落ち着いたら', where: 'アプリ・電話', bring: [], note: '明細・更新カードの届け先。複数枚ある人は全部。', show: () => true },
  { id: 'hoken', phase: 'settled', place: 'either', title: '保険（生命・損害）の住所変更', when: '落ち着いたら', where: '各保険会社（ネット・電話）', bring: [], note: '火災保険は新居の契約も忘れずに。', show: () => true },
  { id: 'keitai', phase: 'settled', place: 'either', title: '携帯電話の住所変更', when: '落ち着いたら', where: 'アプリ・ショップ', bring: [], note: '請求書・本人確認書類の住所と揃えておく。', show: () => true },
  { id: 'subsc', phase: 'settled', place: 'either', title: 'ネットショップ・サブスクの住所変更', when: '落ち着いたら', where: '各サービス（ネット）', bring: [], note: 'Amazon等の配送先、定期便の届け先を更新。', show: () => true },
  { id: 'nhk', phase: 'settled', place: 'either', title: 'NHKの住所変更', when: '落ち着いたら', where: 'NHK（ネット・電話）', bring: [], note: '契約者情報の住所を更新。世帯の合併・分割があれば申し出る。', show: () => true },
  { id: 'haitatsu', phase: 'settled', place: 'either', title: '新聞・定期配達の住所変更・停止', when: '落ち着いたら（停止は引越し前に）', where: '販売店・各サービス', bring: [], note: '新聞・牛乳・ウォーターサーバー・食材宅配など。旧居の停止と新居の開始を。', show: () => true },
  { id: 'kakaritsuke', phase: 'settled', place: 'either', title: 'かかりつけ医・処方薬の引き継ぎ', when: '通院がある人は早めに', where: '今の病院・薬局', bring: ['お薬手帳'], note: '持病・通院中なら、紹介状（診療情報提供書）をもらうと転居先で引き継ぎやすい。', show: () => true },
  { id: 'home-registry', phase: 'settled', place: 'either', title: '不動産の登記（住所変更・所有権移転）', when: '売買・引越し後', where: '法務局（司法書士に依頼が一般的）', bring: [], note: '購入は所有権移転登記、住所が変われば住所変更登記。住宅ローンがあれば抵当権の手続きも。通常は司法書士に任せる。', show: (a) => a.homeOwnerMove },
  { id: 'kotei-shisan', phase: 'settled', place: 'either', title: '固定資産税まわりの確認', when: '売買のあった年〜翌年', where: '市区町村（資産税課）・税務署', bring: [], note: '売却した年の精算（日割り）や、購入後の納税通知の宛先を確認。住宅ローン控除を使うなら初年度は確定申告が必要。', show: (a) => a.homeOwnerMove },
];

/* ============================ 結婚 ============================ */
const MARRIAGE_QUESTIONS = [
  { id: 'nameChange', type: 'bool', label: '結婚で姓（名字）が変わりますか？', default: true },
  { id: 'withMove', type: 'bool', label: '結婚にともなって引越しもしますか？', default: true },
  {
    id: 'work', type: 'choice', label: '結婚にともない、仕事は？', default: 'keep',
    options: [
      { value: 'keep', label: '今の勤務先を続ける' },
      { value: 'quit', label: '退職する（しばらく働かない）' },
      { value: 'change', label: '転職する' },
      { value: 'none', label: 'もともと働いていない' },
    ],
  },
  { id: 'dependent', type: 'bool', label: '配偶者を「あなたの」扶養に入れますか？（配偶者が働かない場合）', default: false },
  { id: 'hasLicense', type: 'bool', label: '運転免許証を持っていますか？', default: true },
  { id: 'inkan', type: 'bool', label: '印鑑登録をしていますか？', default: false },
];

const MARRIAGE_PHASES = [
  { id: 'prep', label: '入籍の準備', hint: '婚姻届と必要書類をそろえる。' },
  { id: 'submit', label: '婚姻届を出す', hint: '希望の入籍日に提出。役所は24時間受付。' },
  { id: 'job', label: '退職・転職にともなう手続き', hint: '健康保険・年金・雇用保険の切替は期限が短い（14〜20日）ので最優先。' },
  { id: 'after', label: '入籍後の名義変更・届け出', hint: '改姓があると名義変更がまとめて発生する。' },
];

const MARRIAGE_TASKS = [
  { id: 'konin-form', phase: 'prep', title: '婚姻届の用紙を入手・記入', when: '提出前', where: '役所・ネットでダウンロード', bring: [], note: '証人2名の署名が必要。記入ミスがあると受理が遅れるので、提出前に役所で事前チェックしてもらうと安心。', show: () => true },
  { id: 'koseki', phase: 'prep', title: '戸籍謄本を用意（必要な場合）', when: '提出前', where: '本籍地の役所・コンビニ交付', bring: [], note: '本籍地以外の役所に出すときに必要なことがある。提出先の役所に要否を事前確認。', show: () => true },
  { id: 'move-link', phase: 'prep', title: '引越しの段取りも進める', when: '入籍と前後して', where: '—', bring: [], note: '改姓＋転居が重なると手続きが増える。このアプリの「引越し」も合わせて使うと漏れにくい。', show: (a) => a.withMove },

  { id: 'submit-konin', phase: 'submit', title: '婚姻届を提出', when: '希望の入籍日', where: '役所（24時間提出可）', bring: ['婚姻届', '本人確認書類', '戸籍謄本（必要なら）'], note: '夜間・休日は守衛室で預かり、後日内容を確認。不備があると希望日に受理されないことも。', gov: true, show: () => true },
  { id: 'koseki-check', phase: 'submit', title: '新しい戸籍・住民票の反映を確認', when: '提出の数日後', where: '役所', bring: [], note: '改姓・世帯の変更が反映されるまで数日かかることがある。名義変更はこれが済んでから。', gov: true, show: (a) => a.nameChange },

  { id: 'mynumber-name', phase: 'after', title: 'マイナンバーカードの氏名変更', when: '入籍後すみやかに', where: '役所', bring: ['マイナンバーカード', '暗証番号'], note: '住民票の改姓が反映されてから。', gov: true, show: (a) => a.nameChange },
  { id: 'menkyo-name', phase: 'after', title: '運転免許証の氏名変更', when: '早めに', where: '警察署・運転免許センター', bring: ['運転免許証', '新姓が確認できる書類（住民票等）'], note: '本人確認の基本書類なので先に変えると他が楽。', show: (a) => a.nameChange && a.hasLicense },
  { id: 'hoken-name', phase: 'after', title: '健康保険証の氏名変更', when: '入籍後すみやかに', where: '勤務先（社保）／役所（国保）', bring: [], note: '会社員は勤務先、自営などは役所で。退職・転職する人は下の「切替」手続きで新姓の保険証になる。', show: (a) => a.nameChange && (a.work === 'keep' || a.work === 'none') },
  { id: 'nenkin-name', phase: 'after', title: '年金の氏名変更', when: '入籍後すみやかに', where: '第1号は役所／扶養(第3号)は配偶者の勤務先', bring: [], note: 'マイナンバー連携で省略できる場合もあるが念のため確認を。', show: (a) => a.nameChange && (a.work === 'keep' || a.work === 'none') },
  { id: 'bank-name', phase: 'after', title: '銀行口座の名義変更', when: '落ち着いたら', where: 'アプリ・窓口', bring: ['新姓のわかるもの・届出印'], note: '給与振込・引き落としに使う口座から優先的に。', show: (a) => a.nameChange },
  { id: 'card-name', phase: 'after', title: 'クレジットカードの名義変更', when: '落ち着いたら', where: 'アプリ・電話', bring: [], note: '口座名義と揃えないと引き落としエラーになることがある。', show: (a) => a.nameChange },
  { id: 'passport-name', phase: 'after', title: 'パスポートの氏名変更（必要なら）', when: '海外の予定があれば早めに', where: 'パスポートセンター', bring: ['戸籍謄本', '現パスポート'], note: '有効なパスポートがある人。航空券は券面名と一致が必要。', show: (a) => a.nameChange },
  { id: 'keitai-name', phase: 'after', title: '携帯・各種契約の名義変更', when: '落ち着いたら', where: '各サービス', bring: [], note: '携帯・サブスク・公共料金など。', show: (a) => a.nameChange },
  { id: 'inkan-konin', phase: 'after', title: '印鑑登録の変更（実印が変わる場合）', when: '改姓したら', where: '役所', bring: ['新しい印鑑', '本人確認書類'], note: '旧姓の実印は使えなくなる。必要な人だけ登録し直す。', gov: true, show: (a) => a.nameChange && a.inkan },
  { id: 'company-konin', phase: 'after', title: '勤務先へ結婚・改姓を届け出', when: '入籍後すみやかに', where: '勤務先（総務・人事）', bring: [], note: '姓・住所・扶養・結婚祝い金・通勤経路などの手続き。', show: (a) => a.work === 'keep' },

  // ---- 退職・転職にともなう手続き ----
  { id: 'taishoku-docs', phase: 'job', title: '退職時に書類を受け取る（離職票・源泉徴収票など）', when: '退職時〜退職後', where: '退職する勤務先', bring: [], note: '「離職票」「雇用保険被保険者証」「源泉徴収票」「年金手帳（預けていれば）」を受け取る。健康保険・年金・失業給付・確定申告で必要。', show: (a) => a.work === 'quit' || a.work === 'change' },
  { id: 'hoken-switch', phase: 'job', title: '健康保険の切替を決める（3択）', when: '退職後すみやかに（期限が短い）', where: '任意継続=旧勤務先／国保=役所／扶養=配偶者の勤務先', bring: ['退職を証明する書類'], note: '①任意継続（退職後20日以内）②国民健康保険（14日以内・役所）③配偶者の扶養に入る（収入要件あり）の3択。空白期間を作らないよう早めに。', gov: true, show: (a) => a.work === 'quit' },
  { id: 'nenkin-switch', phase: 'job', title: '年金の切替', when: '退職後14日以内', where: '配偶者の扶養なら配偶者の勤務先（第3号）／それ以外は役所（第1号）', bring: ['年金手帳・基礎年金番号', '退職を証明する書類'], note: '厚生年金から外れるため切替が必要。配偶者の扶養に入るなら第3号、入らないなら国民年金第1号。', gov: true, show: (a) => a.work === 'quit' },
  { id: 'shitsugyo', phase: 'job', title: '失業給付（基本手当）の手続き', when: '退職後、働く意思があるとき', where: 'ハローワーク', bring: ['離職票', '本人確認書類', '通帳', '写真'], note: 'すぐ働く意思がある人向け。配偶者の扶養に入る場合、給付額によっては扶養に入れないことがあるので順序に注意。', show: (a) => a.work === 'quit' },
  { id: 'juminzei-konin', phase: 'job', title: '住民税の支払い方法を確認', when: '退職のとき', where: '勤務先・役所', bring: [], note: '退職時期により、残額の一括徴収または自分で納める普通徴収に切り替わる。', show: (a) => a.work === 'quit' || a.work === 'change' },
  { id: 'newjob-shaho', phase: 'job', title: '新しい勤務先で社会保険の加入', when: '入社時', where: '新しい勤務先', bring: ['前職の源泉徴収票', '年金手帳・基礎年金番号', '雇用保険被保険者証'], note: '多くは会社が手続き。前職の源泉徴収票は年末調整で必要。', show: (a) => a.work === 'change' },
  { id: 'insurance-name', phase: 'after', title: '生命保険・損害保険の氏名・受取人変更', when: '落ち着いたら', where: '各保険会社', bring: [], note: '受取人を配偶者にする見直しもこの機会に。', show: () => true },
  { id: 'fuyou', phase: 'after', title: '配偶者を扶養に入れる手続き', when: '入籍後すみやかに', where: '会社員は勤務先／自営は役所', bring: [], note: '収入要件あり。健康保険と年金（第3号）で手続きが異なる。配偶者が会社員ならその勤務先経由。', show: (a) => a.dependent },
];

/* ============================ 出産 ============================ */
const BIRTH_QUESTIONS = [
  {
    id: 'insurance', type: 'choice', label: '赤ちゃんを入れる健康保険は？', default: 'shaho',
    options: [
      { value: 'shaho', label: '勤務先の社会保険' },
      { value: 'kokuho', label: '国民健康保険' },
    ],
  },
  { id: 'working', type: 'bool', label: '出産する方は働いていますか？（育休・手当の対象）', default: true },
  { id: 'lowbirth', type: 'bool', label: '低体重・入院などで養育医療が必要ですか？', default: false },
];

const BIRTH_PHASES = [
  { id: 'before', label: '出産前にやること', hint: 'お金と休みの段取りを先に。' },
  { id: 'after', label: '出生後すみやかに（〜14日）', hint: '出生届を起点に、保険・手当をまとめて。' },
  { id: 'settled', label: '落ち着いてから', hint: '健診・予防接種の流れを確認。' },
];

const BIRTH_TASKS = [
  { id: 'ichijikin-check', phase: 'before', title: '出産育児一時金の受け取り方を確認', when: '出産前', where: '産院・健康保険', bring: [], note: '多くは「直接支払制度」で産院が代行し、窓口負担が軽くなる。利用するか産院に確認を。', show: () => true },
  { id: 'kyugyo-plan', phase: 'before', title: '産休・育休の予定を勤務先に相談', when: '妊娠が安定したら早めに', where: '勤務先', bring: [], note: '産前産後休業・育児休業の時期と、手当・給付の段取りを早めに共有。', show: (a) => a.working },

  { id: 'shussei', phase: 'after', title: '出生届を提出', when: '生まれた日を含め14日以内', where: '役所', bring: ['出生証明書（出生届と一体・医師記入）', '母子健康手帳', '本人確認書類'], note: '期限厳守。里帰り出産でも提出できる役所の範囲を事前に確認。', gov: true, show: () => true },
  { id: 'baby-hoken', phase: 'after', title: '赤ちゃんを健康保険に加入', when: '1か月健診までに', where: '社保＝勤務先／国保＝役所', bring: [], note: '保険証ができると医療費助成の申請にも進める。', show: () => true },
  { id: 'jido-teate-birth', phase: 'after', title: '児童手当の認定請求', when: '出生から15日以内が目安', where: '役所', bring: ['請求者の口座', '本人確認書類'], note: '申請しないともらえない。15日特例あり。', gov: true, show: () => true },
  { id: 'kodomo-iryo-birth', phase: 'after', title: '子ども医療費助成の申請', when: '保険証ができたら', where: '役所', bring: ['赤ちゃんの健康保険証', '本人確認書類'], note: '医療証が発行される。自治体ごとに制度が異なる。', gov: true, show: () => true },
  { id: 'ichijikin-claim', phase: 'after', title: '出産育児一時金の申請（直接支払でない場合）', when: '出産後', where: '勤務先の健保／役所（国保）', bring: [], note: '直接支払を使わなかった、または差額があるときに申請する。', show: () => true },
  { id: 'teate-kin', phase: 'after', title: '出産手当金の申請', when: '産休後', where: '勤務先の健康保険', bring: [], note: '産休中の収入を補う給付。勤務先の健保が対象。', show: (a) => a.working },
  { id: 'ikuji-kyufu', phase: 'after', title: '育児休業給付金の申請', when: '育休に入る前後', where: '勤務先経由でハローワーク', bring: [], note: '育休中の給付。条件・必要書類を勤務先と確認。', show: (a) => a.working },
  { id: 'youiku-iryo', phase: 'after', title: '未熟児養育医療給付の申請', when: '入院・治療が必要なとき', where: '役所・保健センター', bring: ['母子健康手帳', '医師の意見書など'], note: '低体重・入院などで指定医療を受けるとき。早めに相談を。', gov: true, show: (a) => a.lowbirth },

  { id: 'kenshin', phase: 'settled', title: '乳幼児健診・予防接種の確認', when: '案内が届いたら', where: '自治体・小児科', bring: ['母子健康手帳'], note: '自治体から予診票・健診の案内が届く。スケジュールを確認。', show: () => true },
  { id: 'mynumber-baby', phase: 'settled', title: '赤ちゃんのマイナンバー確認', when: '落ち着いたら', where: '役所（カードは任意申請）', bring: [], note: '出生届で番号は付く。カードが必要なら役所で申請。', show: () => true },
];

/* ============================ 病気・休職／障害 ============================ */
const BYOKI_QUESTIONS = [
  { id: 'shaho', type: 'bool', label: '会社の健康保険（社保）に入って働いていますか？', default: true },
  { id: 'restLeave', type: 'bool', label: '連続して仕事を休んでいます／休む予定ですか？（休職）', default: true },
  { id: 'card', type: 'bool', label: '障害者手帳（精神・身体など）の取得を考えていますか？', default: false },
  { id: 'selfSupport', type: 'bool', label: '通院の医療費負担を軽くしたいですか？（自立支援医療）', default: false },
  { id: 'pension', type: 'bool', label: '障害年金も検討しますか？', default: false },
  { id: 'willLeave', type: 'bool', label: 'この先、退職する可能性がありますか？', default: false },
];

const BYOKI_PHASES = [
  { id: 'start', label: '休み始める（休職の準備）', hint: 'まず診断書と会社への申し出から。' },
  { id: 'money', label: '生活を支えるお金（傷病手当金）', hint: '社保なら給与の約2/3。毎月の申請が必要。' },
  { id: 'support', label: '医療費・手帳などの支援制度', hint: '通院費・税の軽減や手帳。該当しそうなら早めに。' },
  { id: 'return', label: '復職・退職に向けて', hint: '復職も退職も、傷病手当金の扱いを必ず確認。' },
];

const BYOKI_TASKS = [
  { id: 'shindan-kyushoku', phase: 'start', title: '主治医に休職用の診断書をもらう', when: '休み始めるとき', where: '主治医', bring: [], note: '会社に出す診断書。病名と「療養が必要な期間」が書かれる。', show: (a) => a.restLeave },
  { id: 'company-kyushoku', phase: 'start', title: '会社に休職を申し出る（上司・健康管理室・人事）', when: '休み始めるとき', where: '上司 → 健康管理室（産業医・保健師）→ 人事', bring: ['診断書'], note: '多くは「上司に相談 → 健康管理室で産業医面談 → 人事」の流れで休職に入るか決まる。休職できる期間・給与の有無・社会保険料の支払い方法（休職中も保険料の負担は続くことが多い）も確認。就業規則で会社ごとに違う。', show: (a) => a.restLeave },
  { id: 'shoubyo-check', phase: 'start', title: '傷病手当金について健康保険組合に問い合わせる', when: '休み始めるとき（早めに）', where: '勤務先の健康保険（協会けんぽ・組合健保）', bring: [], note: '連続3日休んだ後の4日目から、給与の約2/3が支給開始日から通算1年6ヶ月まで（社保が対象。国保は原則対象外）。対象になるか・申請書の入手方法・提出先を、健康保険証に書かれた保険者に確認する。初回は書類の入手と3者記入の流れを初めて把握するので一番とまどいやすい。入院などで動けないときは家族や会社に代行を頼めることも。', show: (a) => a.shaho },

  { id: 'shoubyo-form', phase: 'money', title: '傷病手当金の申請書を用意（休職中は計3枚）', when: '休んだ後', where: '健康保険のサイト・勤務先', bring: [], note: '休職中は「本人用・会社用・医師用」の計3枚を1セットに、原則ひと月ごとに健康保険組合へ送る。（退職後の継続給付になると会社用が不要＝2枚になる。後述）', show: (a) => a.shaho },
  { id: 'shoubyo-doctor', phase: 'money', title: '医師に申請書の意見欄を記入してもらう', when: '通院のたび', where: '主治医', bring: ['申請書'], note: '労務不能だった期間を証明してもらう。通院ごとに依頼すると毎月の申請がスムーズ。', show: (a) => a.shaho },
  { id: 'shoubyo-company', phase: 'money', title: '会社に勤務状況・給与の証明を記入してもらう', when: '申請のたび', where: '勤務先', bring: ['申請書'], note: '給与が支払われていないこと等を会社が証明する欄。', show: (a) => a.shaho },
  { id: 'shoubyo-apply', phase: 'money', title: '傷病手当金を申請（原則1ヶ月ごと）', when: '対象期間が過ぎてから', where: '健康保険組合（勤務先経由が多い）', bring: ['本人・会社・医師の3枚'], note: '休んだ期間が過ぎてから提出。継続して受けるには毎月の申請が必要で、ここが地味に手間。時効は2年。医師の記入料が毎回かかることもある。', show: (a) => a.shaho },

  { id: 'jiritsu-shien', phase: 'support', title: '自立支援医療（精神通院）の申請', when: '継続通院するなら早めに', where: '役所（障害福祉の窓口）', bring: ['診断書または意見書', '健康保険証', 'マイナンバー'], note: '精神科の通院医療費の自己負担が原則3割→1割に軽くなる（所得で上限あり）。存在を知らずに申請が遅れると、その分ずっと損し続ける。継続通院するなら最優先で。', gov: true, show: (a) => a.selfSupport },
  { id: 'techo-apply', phase: 'support', title: '精神障害者保健福祉手帳の申請', when: '初診から6ヶ月以降', where: '役所（障害福祉の窓口）', bring: ['診断書（初診から6ヶ月以降のもの）', '写真', 'マイナンバー'], note: '初診日から6ヶ月以上たってから申請できる。双極性障害なども対象。等級により、税の控除・公共交通や携帯の割引・障害者雇用での就労など支援が受けられる。2年ごと更新。', gov: true, show: (a) => a.card },
  { id: 'shogai-nenkin', phase: 'support', title: '障害年金の検討（要件確認）', when: '障害認定日（初診から1年6ヶ月）以降', where: '年金事務所・役所', bring: [], note: '初診日から原則1年6ヶ月後から請求できる。初診日の証明が重要で、社労士に相談する人も多い。傷病手当金と同じ期間は両方を満額もらえない（併給調整）ことがある。', show: (a) => a.pension },
  { id: 'kenpo-fukakyufu', phase: 'support', title: '健保組合・会社独自の補償を確認', when: '休職中', where: '健康保険証で保険者を確認 → その健保／会社の人事・就業規則', bring: [], note: '確認先：①健康保険証に書かれた保険者（協会けんぽ or ○○健康保険組合）のサイト・窓口で「付加給付」 ②会社独自の休業補償は人事・健康管理室・就業規則・福利厚生のページで。傷病手当金に上乗せがある場合があり、知らないと取りこぼす。', show: (a) => a.shaho },

  { id: 'fukushoku', phase: 'return', title: '復職の手続き（復職可の診断書・産業医面談）', when: '回復してきたら', where: '主治医・勤務先', bring: ['復職可の診断書'], note: '主治医の「復職可」診断書、産業医面談、リワーク（復職支援）プログラムの利用も検討。', show: (a) => a.restLeave },
  { id: 'keizoku-check', phase: 'return', title: '【重要】退職後も傷病手当金は続けて受け取れる（継続給付）', when: '退職を決める前に', where: '退職前の健康保険組合', bring: [], note: '知らないと大きく損する制度。条件＝①退職日まで継続1年以上、健康保険の被保険者だった ②退職時に傷病手当金を受給中、または受給できる状態（退職日に出勤していない等）。これを満たせば、退職後も残りの期間（支給開始から通算1年6ヶ月まで）受け取り続けられる。', show: (a) => a.shaho && a.willLeave },
  { id: 'keizoku-tetsuzuki', phase: 'return', title: '継続給付の手続き（退職後は申請書が2枚）', when: '退職後、毎月', where: '退職前の健康保険組合', bring: ['本人・医師の2枚'], note: '退職後は「会社用」の記入が不要になり、本人用・医師用の計2枚を毎月、退職前の健保組合へ送る。健康保険の切替（任意継続／国保／扶養）とは別物で、継続給付は退職前の健保から出る。退職そのものの手続きは「退職・転職」編も参照（準備中）。', show: (a) => a.shaho && a.willLeave },
];

/* ============================ イベント登録 ============================ */
const EVENTS = [
  { id: 'move', emoji: '📦', label: '引越し', sub: '転居の手続き', ready: true, questions: MOVE_QUESTIONS, phases: MOVE_PHASES, tasks: MOVE_TASKS, usePlace: true },
  { id: 'marriage', emoji: '💍', label: '結婚', sub: '入籍・名義変更', ready: true, questions: MARRIAGE_QUESTIONS, phases: MARRIAGE_PHASES, tasks: MARRIAGE_TASKS, usePlace: false },
  { id: 'birth', emoji: '👶', label: '出産', sub: '出生・育児の手続き', ready: true, questions: BIRTH_QUESTIONS, phases: BIRTH_PHASES, tasks: BIRTH_TASKS, usePlace: false },
  { id: 'byoki', emoji: '🩺', label: '病気・休職／障害', sub: '傷病手当金・手帳・復職', ready: true, questions: BYOKI_QUESTIONS, phases: BYOKI_PHASES, tasks: BYOKI_TASKS, usePlace: false },
  { id: 'bereavement', emoji: '🕊️', label: '身内が亡くなったとき', sub: '相続・名義変更（準備中）', ready: false, comingNote: '相続・年金・名義変更など大切な手続きを、丁寧に準備中です。' },
];
