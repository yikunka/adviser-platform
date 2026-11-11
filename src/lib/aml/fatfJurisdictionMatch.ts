/**
 * FATF jurisdiction string matching (nationality / place of issue / birth).
 * Avoids false positives from naive substring / fuzzy matches
 * (e.g. Republic of Korea ⊆ Democratic People's Republic of Korea, KOR ⊆ DPRK).
 */

import { compareTwoStrings } from 'string-similarity'

export function normalizeJurisdiction(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Mutually exclusive country label groups. If the subject belongs to one group
 * and a list target belongs to another, that pair never scores as a hit.
 */
const EXCLUSIVE_JURISDICTION_GROUPS: string[][] = [
  // South Korea (ROK) — not on FATF lists.
  // Bare "Korea" / 한국 is treated as ROK (commercial KYC default) so it does not
  // hit DPRK via phrase containment inside "North Korea" / "… Republic of Korea".
  [
    'korea',
    'south korea',
    'korea south',
    'korea (south)',
    'republic of korea',
    'korea republic of',
    'korea, republic of',
    'rok',
    '한국',
    '대한민국',
    '大韓民國',
    '韩国',
    '韓國',
    '南韓',
    '南韩',
    '南朝鲜',
    '南朝鮮',
  ],
  // North Korea (DPRK) — FATF Call for Action
  [
    'north korea',
    'korea north',
    'korea (north)',
    'dprk',
    'democratic peoples republic of korea',
    'democratic people s republic of korea',
    'korea democratic peoples republic of',
    'korea, democratic peoples republic of',
    'korea democratic people s republic of',
    '朝鮮民主主義人民共和國',
    '朝鲜民主主义人民共和国',
    '北韓',
    '北韩',
    '朝鲜',
    '朝鮮',
  ],
]

const exclusiveGroupByLabel = (() => {
  const map = new Map<string, number>()
  EXCLUSIVE_JURISDICTION_GROUPS.forEach((labels, groupId) => {
    for (const label of labels) {
      map.set(normalizeJurisdiction(label), groupId)
    }
  })
  return map
})()

function exclusiveGroupId(norm: string): number | undefined {
  return exclusiveGroupByLabel.get(norm)
}

function cjkCharCount(s: string): number {
  return s.match(/\p{Script=Han}/gu)?.length ?? 0
}

/** True when needle appears as a whole-word (Latin) or contiguous (CJK) phrase. */
function containsWholePhrase(haystack: string, needle: string): boolean {
  if (!needle) return false
  const needleCompact = needle.replace(/\s+/g, '')
  const hayHasCjk = cjkCharCount(haystack) > 0
  const needleHasCjk = cjkCharCount(needle) > 0
  if (hayHasCjk || needleHasCjk) {
    // e.g. "伊朗德黑兰" contains "伊朗" — no spaces in CJK addresses
    if (needleCompact.length < 2) return false
    return haystack.replace(/\s+/g, '').includes(needleCompact)
  }
  // Latin/acronym: require whole words and min length (blocks KOR ⊆ DPRK)
  if (needle.length < 4) return false
  return (` ${haystack} `).includes(` ${needle} `)
}

/**
 * Score subject (KYC nationality / issue / birth place) against FATF entry name+aliases.
 * Exact → 1; whole-phrase containment (min 4 chars) → 0.95; else fuzzy.
 */
export function scoreJurisdiction(subject: string, targets: string[]): number {
  const normSubject = normalizeJurisdiction(subject)
  if (!normSubject) return 0

  const subjectGroup = exclusiveGroupId(normSubject)
  let best = 0

  for (const t of targets) {
    const normT = normalizeJurisdiction(t)
    if (!normT) continue

    const targetGroup = exclusiveGroupId(normT)
    if (
      subjectGroup !== undefined
      && targetGroup !== undefined
      && subjectGroup !== targetGroup
    ) {
      continue
    }

    if (normSubject === normT) return 1

    // Whole-phrase containment only (never raw character substring — blocks KOR⊂DPRK).
    if (containsWholePhrase(normSubject, normT) || containsWholePhrase(normT, normSubject)) {
      best = Math.max(best, 0.95)
      continue
    }

    best = Math.max(best, compareTwoStrings(normSubject, normT))
  }

  return best
}
