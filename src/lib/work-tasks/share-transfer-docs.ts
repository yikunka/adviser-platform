export const SHARE_TRANSFER_DOCUMENTS = [
  {
    key: 'instrument',
    fileName: 'Instrument of Transfer.docx',
    label: '转让文书',
    hint: 'Instrument of Transfer',
    defaultOn: true,
  },
  {
    key: 'bought-sold',
    fileName: 'Bought and Sold Note.docx',
    label: '买卖票据',
    hint: 'Bought and Sold Note',
    defaultOn: true,
  },
  {
    key: 'resolution',
    fileName: 'Director Resolution - Share Transfer.docx',
    label: '董事决议',
    hint: '批准转让、注销旧股票、发出新股票',
    defaultOn: true,
  },
  {
    key: 'certificate',
    fileName: 'Share Certificate.docx',
    label: '新股票',
    hint: 'Share Certificate',
    defaultOn: true,
  },
  {
    key: 'ird-written',
    fileName: 'Written Confirmation to IRD.docx',
    label: '致税务局确认书',
    hint: '无买卖协议、无香港物业、尚未开业',
    defaultOn: true,
  },
] as const

export type ShareTransferDocumentKey = (typeof SHARE_TRANSFER_DOCUMENTS)[number]['key']

export const SHARE_TRANSFER_DOCUMENT_KEYS = SHARE_TRANSFER_DOCUMENTS.map(doc => doc.key) as [
  ShareTransferDocumentKey,
  ...ShareTransferDocumentKey[],
]

export function shareTransferDocument(key: string) {
  return SHARE_TRANSFER_DOCUMENTS.find(doc => doc.key === key) ?? null
}
