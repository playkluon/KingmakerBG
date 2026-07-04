// 기반 스킬: skills/card-data/SKILL.md
// 태그 어휘 중앙화 — 공약 반응 태그와 유권자 선호 태그가 이 어휘를 공유한다 (SKILL.md 규칙).
import type { PolicyDirection, PolicyTrackId } from '@kingmakers/engine';

/**
 * §6 정책 트랙 5종 × 방향 2종에서 파생되는 공약 반응 태그.
 * 유권자 카드의 선호/비선호/충돌 태그와 공약 카드의 reactionTag가 이 10종을 공유한다.
 */
export type PolicyReactionTag =
  | 'economy-welfare'
  | 'economy-market'
  | 'labor-workerRights'
  | 'labor-corporate'
  | 'society-liberty'
  | 'society-order'
  | 'industry-environment'
  | 'industry-growth'
  | 'foreign-openness'
  | 'foreign-protection';

export const POLICY_REACTION_TAGS: readonly PolicyReactionTag[] = [
  'economy-welfare',
  'economy-market',
  'labor-workerRights',
  'labor-corporate',
  'society-liberty',
  'society-order',
  'industry-environment',
  'industry-growth',
  'foreign-openness',
  'foreign-protection',
];

export const POLICY_REACTION_TAG_LABELS: Readonly<Record<PolicyReactionTag, string>> = {
  'economy-welfare': '복지',
  'economy-market': '시장',
  'labor-workerRights': '노동권',
  'labor-corporate': '기업 자율',
  'society-liberty': '시민 자유',
  'society-order': '질서',
  'industry-environment': '환경',
  'industry-growth': '성장',
  'foreign-openness': '개방',
  'foreign-protection': '보호',
};

const TAG_BY_TRACK_DIRECTION: Record<PolicyTrackId, Record<PolicyDirection, PolicyReactionTag>> = {
  economy: { [-1]: 'economy-welfare', [1]: 'economy-market' },
  labor: { [-1]: 'labor-workerRights', [1]: 'labor-corporate' },
  society: { [-1]: 'society-liberty', [1]: 'society-order' },
  industry: { [-1]: 'industry-environment', [1]: 'industry-growth' },
  foreign: { [-1]: 'foreign-openness', [1]: 'foreign-protection' },
};

/** 정책 트랙+방향으로부터 반응 태그를 계산한다 (§6) */
export function tagFor(track: PolicyTrackId, direction: PolicyDirection): PolicyReactionTag {
  return TAG_BY_TRACK_DIRECTION[track][direction];
}

const OPPOSITE_TAG: Readonly<Record<PolicyReactionTag, PolicyReactionTag>> = {
  'economy-welfare': 'economy-market',
  'economy-market': 'economy-welfare',
  'labor-workerRights': 'labor-corporate',
  'labor-corporate': 'labor-workerRights',
  'society-liberty': 'society-order',
  'society-order': 'society-liberty',
  'industry-environment': 'industry-growth',
  'industry-growth': 'industry-environment',
  'foreign-openness': 'foreign-protection',
  'foreign-protection': 'foreign-openness',
};

/** 같은 트랙의 정반대 방향 태그 — 유권자의 "직접 충돌 태그"(§10) 계산에 사용 */
export function opposingTag(tag: PolicyReactionTag): PolicyReactionTag {
  return OPPOSITE_TAG[tag];
}

/**
 * 유권자 그룹 6종.
 * 브리프(§11)가 명시적으로 언급하는 그룹은 "노동자"뿐이다 — 나머지는 이식 보완 결정이다 (GAME_SPEC.md 부록 A-8).
 */
export type VoterGroupKey = 'laborers' | 'middleClass' | 'smallBusiness' | 'youth' | 'seniors' | 'farmers';

export const VOTER_GROUPS: readonly VoterGroupKey[] = [
  'laborers',
  'middleClass',
  'smallBusiness',
  'youth',
  'seniors',
  'farmers',
];

export const VOTER_GROUP_LABELS: Readonly<Record<VoterGroupKey, string>> = {
  laborers: '노동자',
  middleClass: '중산층',
  smallBusiness: '자영업자',
  youth: '청년층',
  seniors: '노년층',
  farmers: '농어촌',
};
