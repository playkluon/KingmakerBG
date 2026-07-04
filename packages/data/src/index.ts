// 기반 스킬: skills/card-data/SKILL.md
// 카드 데이터 패키지 공개 API 배럴 — 후보 21 / 공약 30 / 유권자 48 / 이슈 15 / 이벤트 30+30 / 비밀 의제 16장.

/** 데이터 패키지 버전 */
export const DATA_VERSION = '0.1.0';

// ── 카드 데이터 ─────────────────────────────────────────────
export { AGENDAS } from './agendas';
export { CANDIDATES } from './candidates';
export { CANDIDATE_EVENTS } from './candidateEvents';
export { ISSUES } from './issues';
export { PROMISES } from './promises';
export { VOTERS } from './voters';
export { VOTER_EVENTS } from './voterEvents';

// ── 스키마·타입 ─────────────────────────────────────────────
export {
  AgendaConditionSchema,
  AgendaIdSchema,
  CandidateAbilitySchema,
  CandidateCardSchema,
  CandidateIdSchema,
  ElectionEffectSchema,
  EventCardSchema,
  EventIdSchema,
  IssueCardSchema,
  IssueIdSchema,
  PolicyDirectionSchema,
  PolicyReactionTagSchema,
  PolicyTrackIdSchema,
  PromiseCardSchema,
  PromiseEffectSchema,
  PromiseIdSchema,
  SecretAgendaCardSchema,
  VoterCardSchema,
  VoterGroupKeySchema,
  VoterIdSchema,
} from './schemas';
export type {
  AgendaCondition,
  CandidateAbility,
  CandidateCard,
  ElectionEffect,
  EventCard,
  IssueCard,
  PromiseCard,
  PromiseEffect,
  SecretAgendaCard,
  VoterCard,
} from './schemas';

// ── 태그·그룹 어휘 ────────────────────────────────────────────
export {
  opposingTag,
  POLICY_REACTION_TAG_LABELS,
  POLICY_REACTION_TAGS,
  tagFor,
  VOTER_GROUP_LABELS,
  VOTER_GROUPS,
} from './tags';
export type { PolicyReactionTag, VoterGroupKey } from './tags';
