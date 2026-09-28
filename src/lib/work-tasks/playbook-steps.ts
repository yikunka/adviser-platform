export const WORK_TASK_KINDS = [
  'SHARE_TRANSFER',
  'SHARE_ALLOTMENT',
  'COMPANY_NAME_CHANGE',
  'REGISTERED_OFFICE_ADDRESS',
  'REGISTER_LOCATION',
  'ACCOUNTING_REFERENCE_DATE',
  'OFFICER_RESIGNATION',
  'OFFICER_APPOINTMENT',
  'OFFICER_PARTICULARS',
  'AUDITOR_CHANGE',
] as const

export type WorkTaskKind = (typeof WORK_TASK_KINDS)[number]

export type WorkTaskPlaybook = {
  card: string
  deadline: string
  steps: readonly string[]
}

/** Handling order from Company Action Playbook Part B. NAC4 has no card there. */
export const WORK_TASK_PLAYBOOK: Record<WorkTaskKind, WorkTaskPlaybook> = {
  SHARE_TRANSFER: {
    card: 'B6',
    deadline: '把转让文书交税务局盖印，更新成员登记册，并在下次周年申报表披露。内部目标约 30 日内备妥盖印文件。',
    steps: [
      '查章程（先买权和董事会批准），并收齐九项文件：买卖票据、转让文书、买卖协议或没有买卖协议的确认、没有物业的确认、董事决议、董事核证的近三个月管理账、最近期审计报告、公司章程，以及最近的周年申报表、法团成立表格或股份配发／资本变动表格（如有）。',
      '董事会批准转让。',
      '把转让文书交税务局盖印。',
      '注销旧股票，发出新股票。',
      '更新成员登记册和股份转让登记册。',
      '记下下次周年申报表附表 1。',
    ],
  },
  SHARE_ALLOTMENT: {
    card: 'B7',
    deadline: '首次配发日起 1 个月内向公司注册处递交表格 NSC1（及附表二获配发股份者详情）。',
    steps: [
      '查章程有关新股发行、先买权和董事会权力。',
      '收妥股份申请书（或认购文件）及代价。',
      '董事会决议批准配发、更新成员登记册并发出股票。',
      '首次配发日起 1 个月内递交表格 NSC1；金钱代价配发填第 4A 项及附表二。',
      '更新成员登记册和股票纪录。',
      '记下下次周年申报表附表 1。',
    ],
  },
  COMPANY_NAME_CHANGE: {
    card: 'B2',
    deadline: '特别决议后 15 日内递交表格 NNC2。',
    steps: [
      '确认新的英文和中文名称。',
      '通过成员特别决议。',
      '递交表格 NNC2。',
      '领取更改公司名称证明书。',
      '更新银行、信纸、合约和印章。',
    ],
  },
  REGISTERED_OFFICE_ADDRESS: {
    card: 'B4',
    deadline: '15 日内递交表格 NR1。新地址须在香港，不可用邮政信箱或转交地址。',
    steps: [
      '董事会决议批准新的注册办事处地址。',
      '递交表格 NR1，并向税务局递交 IRC311a（营业地址通知）。',
      '更新信纸、银行和商业登记的通讯地址。',
      '如果登记册改在别处存放，另交表格 NR2。',
    ],
  },
  REGISTER_LOCATION: {
    card: 'B5',
    deadline: '搬到或开始存放于该地点后 15 日内递交表格 NR2。',
    steps: [
      '通过董事会决议，记明成员登记册、董事登记册、公司秘书登记册和会计纪录的新存放地点。',
      '实际搬迁，或确认由谁保管。',
      '递交表格 NR2。',
      '在公司档案保留存放地点索引。',
    ],
  },
  ACCOUNTING_REFERENCE_DATE: {
    card: '',
    deadline: 'Playbook 没有这张卡片。成员决议后 15 日内递交表格 NAC4。',
    steps: [
      '成员决议缩短或延长会计参照期。',
      '决议后 15 日内向公司注册处递交表格 NAC4。',
      '如属延长，须符合近五年的限制：近五年未曾指定新日期、与控股公司的会计参照日相同，或经成员决议批准。',
      '把确认书存入公司档案，并记下新的会计参照日。',
    ],
  },
  OFFICER_RESIGNATION: {
    card: 'B8',
    deadline: '辞任人可递交表格 ND4。公司须在停任后 15 日内递交表格 ND2A。',
    steps: [
      '收妥辞任信，确认生效日期。',
      '更新董事或公司秘书登记册。',
      '辞任人签署表格 ND4（如由其本人申报）。',
      '公司在 15 日内递交表格 ND2A 申报停任。',
      '如只余一名董事，须先委任另一名董事。私人公司的唯一董事不可同时任公司秘书。',
    ],
  },
  OFFICER_APPOINTMENT: {
    card: 'B8',
    deadline: '委任后 15 日内递交表格 ND2A。',
    steps: [
      '收妥出任同意书及身分证明。',
      '董事会决议批准委任。',
      '15 日内递交表格 ND2A。自然人董事的通常住址和完整身分号码填在 PI-ND2A（不供公众查阅），本任务未生成该页。',
      '更新董事或公司秘书登记册。',
    ],
  },
  OFFICER_PARTICULARS: {
    card: 'B9',
    deadline: '更改后 15 日内递交表格 ND2B。',
    steps: [
      '核对现时在公司注册处登记的姓名和身分。',
      '记下更改日期和新的姓名、地址或联络资料。',
      '15 日内递交表格 ND2B。',
      '更新内部登记册。',
    ],
  },
  AUDITOR_CHANGE: {
    card: 'B10',
    deadline: '免任核数师须在决议后向公司注册处递交表格 NA1。核数师辞任递交表格 NA2。委任核数师一般无须即时向注册处交表。',
    steps: [
      '委任：通过董事或成员决议委任核数师。',
      '免任：向核数师和成员发出拟免任通知，通过普通决议，递交表格 NA1。',
      '辞任：核数师辞任后递交表格 NA2。',
      '更新公司档案，并记下下次财务报表的核数师。',
    ],
  },
}
