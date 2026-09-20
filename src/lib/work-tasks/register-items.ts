export const REGISTER_ITEMS = [
  { key: 'members', label: '成员登记册', en: 'register of members', field: 'cb_1_P.1' },
  { key: 'controllers', label: '重要控制人登记册', en: 'register of significant controllers', field: 'cb_2_P.1' },
  { key: 'directors', label: '董事登记册', en: 'register of directors', field: 'cb_3_P.1' },
  { key: 'secretaries', label: '公司秘书登记册', en: 'register of company secretaries', field: 'cb_4_P.1' },
  { key: 'charges', label: '押记登记册', en: 'register of charges', field: 'cb_5_P.1' },
  { key: 'chargeInstruments', label: '设立押记的文书的副本', en: 'copies of instruments creating charges', field: 'cb_6_P.1' },
  { key: 'debentures', label: '债权证持有人登记册', en: 'register of debenture holders', field: 'cb_7_P.1' },
  { key: 'section384', label: '第384条详情报表登记册', en: 'register of particulars required by section 384', field: 'cb_8_P.1' },
  { key: 'minutes', label: '决议、会议纪录及书面决定', en: 'copies of resolutions, minutes and written resolutions', field: 'cb_9_P.1' },
  { key: 'indemnity', label: '获准许的弥偿条文', en: 'copies of permitted indemnity provisions', field: 'cb_10_P.1' },
  { key: 'management', label: '管理合约', en: 'copies of management contracts', field: 'cb_11_P.1' },
] as const

export type RegisterItemKey = (typeof REGISTER_ITEMS)[number]['key']
