export type RiskTemplateItem = {
  category: string
  question: string
}

export const DEFAULT_RISK_ITEMS: RiskTemplateItem[] = [
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被認定為缺乏足夠反洗錢(AML)或反恐融資(CTF)監管框架的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been designated as having inadequate anti-money laundering (AML) or counter-terrorism financing (CTF) regulatory frameworks?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被正式認定為存在較高貪腐水平或重大犯罪活動的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been officially recognized as experiencing elevated levels of corruption or substantial criminal activities?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與受到國際監管機構(包括但不限於聯合國(UN))制裁的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that is subject to sanctions imposed by international regulatory authorities, including but not limited to the United Nations (UN)?',
  },
  {
    category: '國家/地區風險因素  COUNTRY/ TERRITORY RISK FACTORS',
    question: '客戶是否與被認定為向恐怖活動提供財政支持或在其主權邊界內庇護指定恐怖組織的司法管轄區保持聯繫或進行交易？\nDoes the Client maintain connections or engage in transactions with a jurisdiction that has been identified as providing financial support to terrorist activities or harboring designated terrorist organizations within its sovereign borders?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否使用代名董事或股東？\nDoes the Client employ nominee director(s) or shareholder(s) in its corporate governance structure?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否發行不記名股票？\nDoes the Client issue bearer shares as part of its corporate securities framework?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的所有權結構是否看似異常或過於複雜，與其業務性質不符？\nDoes the ownership structure of the Client exhibit unusual characteristics or excessive complexity disproportionate to the nature of its business operations?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '擬議的實益擁有人/董事/合夥人/股東是否有涉及欺詐或不誠實的前科？\nDo the proposed beneficial owners/directors/partners/shareholders possess prior criminal convictions related to fraudulent activities or acts of dishonesty?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '任何實益擁有人/董事/合夥人/股東是否為外國政治公眾人物(PEPs)？\nAre any of the beneficial owners/directors/partners/shareholders classified as foreign Politically Exposed Persons (PEPs)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '任何實益擁有人/董事/合夥人/股東是否為外國政治公眾人物的親屬或密切關係人？\nAre any of the beneficial owners/directors/partners/shareholders identified as relatives or close associates of foreign Politically Exposed Persons (PEPs)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的股東和/或董事是否經常變更，且這些變更無法獲得合理解釋？\nDoes the Client demonstrate a pattern of frequent and unexplained changes to its shareholders and/or directors without adequate documentation or justification?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否涉及可能被犯罪分子或恐怖組織濫用於洗錢/恐怖融資的業務（高風險業務）？\nIs the Client engaged in business activities that present elevated risks for exploitation by criminal elements or terrorist organizations for money laundering or terrorist financing purposes?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否涉及現金密集型業務？\nIs the Client operating within sectors characterized by high volumes of cash transactions?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '從客戶處獲取客戶本身及實益擁有人的身份證明是否存在困難；且所提供的文件是否不令人滿意？\nHave there been difficulties in obtaining satisfactory identification documentation from the Client pertaining to both the Client entity and its beneficial owner(s)?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否過於神秘或迴避問題（例如關於實益擁有人或資金來源的問題）？\nDoes the Client exhibit undue secrecy or evasiveness regarding disclosure of beneficial ownership information or sources of funding?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否在沒有充分理由的情況下積極避免個人接觸？\nDoes the Client demonstrate a pattern of avoiding direct personal interaction without providing reasonable justification?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶是否頻繁且無合理解釋地更換專業顧問或管理層成員？\nDoes the Client experience recurring and unexplained modifications to its professional advisory relationships or management personnel?',
  },
  {
    category: '客戶風險因素  CUSTOMER RISK FACTORS',
    question: '客戶的員工數量或結構是否與業務規模或性質不符（例如，考慮到所使用的員工數量和資產，業務營業額不合理地高）？\nDoes the Client maintain employee staffing levels or organizational structures that appear inconsistent with the scale or nature of its business activities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否曾指示執行交易（可能包括現金交易）且要求匿名進行？\nHas the Client issued instructions to execute a transaction (potentially including cash transactions) with requirements for anonymity?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '這是否為一個要求走捷徑並對交易完成速度要求不合理的客戶？\nDoes the Client demonstrate a pattern of requesting expedited processing or procedural shortcuts without providing adequate justification for the urgency in transaction completion?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否頻繁地向相同收款人進行未說明的現金交易？\nDoes the Client exhibit a pattern of conducting recurring unrecorded cash transactions with consistent recipient entities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在異常的交易模式，這些交易沒有明顯的經濟目的，或有大額現金支付，而這些支付通常應通過其他支付方式進行（如支票、銀行匯票等）？\nAre there transaction patterns evident that lack clear economic rationale, or instances of substantial cash disbursements where alternative payment methodologies would typically be utilized?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在來自未知或無關聯第三方對客戶提供的服務和/或交易的未說明付款？\nDoes the Client receive unsubstantiated payments from unidentified or unaffiliated third parties in connection with services rendered or transactions facilitated?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否指示成立空殼公司，並設置代名股東和/或董事？\nHas the Client requested assistance in establishing shell corporate entities utilizing nominee shareholders and/or directors?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否購買沒有明顯商業目的的公司或商業實體？\nDoes the Client engage in the acquisition of corporate entities or business operations that demonstrate no evident commercial or operational purpose?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在未經任何面對面會議就建立的業務關係或執行的交易？\nHave business relationships been established or transactions been executed without any in-person verification or physical meetings?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在與客戶的業務關係過程中，所預期的服務和/或交易的類型、數量或頻率是否存在差異？\nIs there a notable discrepancy between the anticipated and actual patterns of service utilization or transaction characteristics within the established business relationship?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否進行實際現金（以紙幣和硬幣形式）支付？\nHas the Client conducted financial transactions using physical currency (notes and coins)?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶在購買房地產時是否提供與其社會經濟狀況不符的不成比例的私人資金？\nHas the Client deployed private funding for real estate acquisitions in amounts disproportionate to their documented socio-economic profile?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否為購買土地權益進行大額現金支付，而該土地的價值遠低於支付金額，或資金來源方式不尋常？\nHas the Client utilized substantial cash payments for land interest acquisitions where the property valuation appears significantly lower than the investment, or where funding mechanisms demonstrate irregularities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '相對於具有類似背景的客戶所能合理預期的情況，客戶是否擁有異常高水平的資產或異常大額的交易？\nDoes the Client maintain asset holdings or execute transactions of a magnitude that significantly exceeds reasonable expectations for clients with comparable financial profiles?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否在異常短的時間內進行房地產在各方之間的轉讓？\nHas the Client participated in real estate transfers between parties within an atypically abbreviated timeframe?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否有要求支付給第三方但沒有實質理由或相應交易的請求？\nHas the Client submitted requests for third-party payments without providing substantiating documentation or corresponding transaction justification?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否在沒有合法或經濟理由的情況下指示建立複雜的所有權結構？\nHas the Client requested the implementation of elaborate ownership structures without demonstrable legitimate business purposes or economic rationale?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否有被放棄的交易，且客戶對費用水平沒有關注？\nAre there instances of transaction abandonment without apparent concern regarding associated fee obligations?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否存在任何可避免的虧損交易？\nDoes the Client engage in transactions that result in financial losses that could reasonably have been avoided?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否缺乏能支持客戶故事、過往交易或公司活動的文件？\nIs there a deficiency in documentary evidence supporting the Client\'s representations, historical transactions, or corporate activities?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '是否有任何無法解釋的明示信託使用？\nDoes the Client utilize express trust arrangements without adequate explanation?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '客戶是否通過使用授權委託書、混合董事會和代表處的方式，給予未經解釋的授權委託？\nHas the Client implemented authority delegation mechanisms through powers of attorney, diversified board compositions, or representative offices without sufficient justification?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在明示信託的情況下，委託人與具有既得權利的受益人、其他受益人以及作為權力對象的人之間是否存在任何無法解釋的關係？\nRegarding express trust arrangements, are there unexplained relationships between settlors and beneficiaries with vested rights, other beneficiaries, or individuals designated as objects of a power?',
  },
  {
    category: '服務/交易風險因素  SERVICES/ TRANSACTIONS RISK FACTORS',
    question: '在明示信託的情況下，受益人類別以及願望表達中的類別性質是否存在任何無法解釋的情況（在需要解釋的情況下）？\nIn the context of express trusts, are there classifications of beneficiaries or subcategories within wish expressions that lack necessary explanations where such clarification would be warranted?',
  },
]
