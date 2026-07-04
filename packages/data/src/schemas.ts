// 기반 스킬: skills/card-data/SKILL.md
// zod 스키마: CandidateCard, PromiseCard, VoterCard, IssueCard, EventCard, SecretAgendaCard.
// 효과/조건은 자유 텍스트가 아니라 판별 가능한 유니온으로 정의한다 (SKILL.md 규칙).
import { z } from 'zod';
import type { AgendaId, CandidateId, EventId, IssueId, PromiseId, VoterId } from '@kingmakers/engine';
import { POLICY_REACTION_TAGS, VOTER_GROUPS, type PolicyReactionTag, type VoterGroupKey } from './tags';

// ── 기본 도메인 스키마 ────────────────────────────────────────
export const PolicyTrackIdSchema = z.enum(['economy', 'labor', 'society', 'industry', 'foreign']);
export const PolicyDirectionSchema = z.union([z.literal(-1), z.literal(1)]);
// 리터럴 유니온을 그대로 보존한다 — string으로 넓히면 opposingTag() 등 좁은 타입을 요구하는 호출부가 깨진다.
// (엔진의 CardCatalog 필드는 반대로 string으로 넓게 받으므로, 이 좁은 타입을 그대로 대입해도 호환된다.)
export const VoterGroupKeySchema = z.enum(VOTER_GROUPS as [VoterGroupKey, ...VoterGroupKey[]]);
export const PolicyReactionTagSchema = z.enum(POLICY_REACTION_TAGS as [PolicyReactionTag, ...PolicyReactionTag[]]);

function idSchema<T extends string>(prefix: string) {
  return z.custom<T>((val) => typeof val === 'string' && val.startsWith(`${prefix}-`), {
    message: `유효한 ID 형식이 아닙니다 (${prefix}-*)`,
  });
}

export const CandidateIdSchema = idSchema<CandidateId>('candidate');
export const PromiseIdSchema = idSchema<PromiseId>('promise');
export const VoterIdSchema = idSchema<VoterId>('voter');
export const IssueIdSchema = idSchema<IssueId>('issue');
export const EventIdSchema = idSchema<EventId>('event');
export const AgendaIdSchema = idSchema<AgendaId>('agenda');

const PolicyMoveSchema = z.object({
  track: PolicyTrackIdSchema,
  direction: PolicyDirectionSchema,
  amount: z.number().int().positive(),
});

// ── CandidateCard (§8, §13, §14, §11) ────────────────────────
export const ElectionEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixedPolicyMove'), track: PolicyTrackIdSchema, direction: PolicyDirectionSchema, amount: z.number().int().positive() }),
  z.object({
    kind: z.literal('choosePolicyMove'),
    options: z.array(z.object({ track: PolicyTrackIdSchema, direction: PolicyDirectionSchema, amount: z.number().int().positive() })).min(2),
  }),
  z.object({ kind: z.literal('flexPolicyMove'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('winningPromisePolicyMove'), repeat: z.number().int().positive() }),
]);
export type ElectionEffect = z.infer<typeof ElectionEffectSchema>;

// §11: MVP 활성 능력 3종 + 공약 제한 1종 + 평판 손실 약점은 active:true, 그 외 서술형은 active:false
export const CandidateAbilitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fundraiseBonus'), amount: z.number().int().positive(), active: z.literal(true) }),
  z.object({ kind: z.literal('voterContactDiscount'), group: VoterGroupKeySchema, amount: z.number().int().positive(), active: z.literal(true) }),
  z.object({ kind: z.literal('policyPressureDiscount'), amount: z.number().int().positive(), active: z.literal(true) }),
  z.object({ kind: z.literal('promiseRestriction'), excludedTag: PolicyReactionTagSchema, active: z.literal(true) }),
  z.object({ kind: z.literal('reputationLossOnPromise'), amount: z.number().int().positive(), active: z.literal(true) }),
  z.object({ kind: z.literal('flavorOnly'), description: z.string().min(1), active: z.literal(false) }),
]);
export type CandidateAbility = z.infer<typeof CandidateAbilitySchema>;

export const CandidateCardSchema = z.object({
  id: CandidateIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  /** §8, §13: 후보 기본 표 */
  baseVotes: z.number().int().positive(),
  /** §12 단일화 "후보 성향이 충돌하지 않음" 판정에 쓰이는 이념 태그 */
  leaningTags: z.array(z.string().min(1)).min(1),
  /** §12 단일화 "지지 유권자 그룹이 일부 겹침" 판정에 쓰이는 기본 지지 계층 */
  supportedVoterGroups: z.array(VoterGroupKeySchema).min(1),
  electionEffect: ElectionEffectSchema,
  abilities: z.array(CandidateAbilitySchema),
});
export type CandidateCard = z.infer<typeof CandidateCardSchema>;

// ── PromiseCard (§9) ──────────────────────────────────────────
export const PromiseEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('extraVotes'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('extraVotesIfGroupRevealed'), group: VoterGroupKeySchema, amount: z.number().int().positive() }),
  z.object({ kind: z.literal('backerReward'), resource: z.enum(['money', 'victoryPoints']), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('backerInfluence'), group: VoterGroupKeySchema, amount: z.number().int().positive() }),
  z.object({ kind: z.literal('backerPressureToken'), track: PolicyTrackIdSchema, direction: PolicyDirectionSchema, amount: z.number().int().positive() }),
]);
export type PromiseEffect = z.infer<typeof PromiseEffectSchema>;

export const PromiseCardSchema = z.object({
  id: PromiseIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  policyMove: PolicyMoveSchema,
  /** policyMove.track/direction에서 파생되는 태그 (부록 A-9) — integrity 테스트가 일치 여부를 검증한다 */
  reactionTag: PolicyReactionTagSchema,
  effect: PromiseEffectSchema,
});
export type PromiseCard = z.infer<typeof PromiseCardSchema>;

// ── VoterCard (§10) ───────────────────────────────────────────
export const VoterCardSchema = z.object({
  id: VoterIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  group: VoterGroupKeySchema,
  /** §13 "유권자 배정 표" — 이 카드가 후보에게 제공하는 표 수 */
  voteWeight: z.number().int().positive(),
  preferredTag: PolicyReactionTagSchema,
  /** preferredTag의 정반대 태그 (부록 A-9) — §10 "직접 충돌 태그" */
  conflictTag: PolicyReactionTagSchema,
  /** 선택적 2차 비선호 태그 — §10 "싫어하는 태그" */
  dislikedTag: PolicyReactionTagSchema.optional(),
});
export type VoterCard = z.infer<typeof VoterCardSchema>;

// ── IssueCard (§4: 공개 정보 중심, 효과 확장은 후순위) ──────────
export const IssueCardSchema = z.object({
  id: IssueIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
});
export type IssueCard = z.infer<typeof IssueCardSchema>;

// ── EventCard (§4, §29, 부록 A-4: 데이터만, 효과는 전부 TODO) ───
export const EventCardSchema = z.object({
  id: EventIdSchema,
  name: z.string().min(1),
  category: z.enum(['candidate', 'voter']),
  description: z.string().min(1),
  effect: z.object({ todo: z.literal(true) }),
});
export type EventCard = z.infer<typeof EventCardSchema>;

// ── SecretAgendaCard (§17) ─────────────────────────────────────
export const AgendaConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('policyAtLeast'), track: PolicyTrackIdSchema, direction: PolicyDirectionSchema, minMagnitude: z.number().int().min(1).max(2) }),
  z.object({ kind: z.literal('policyBetween'), track: PolicyTrackIdSchema, min: z.number().int().min(-2).max(2), max: z.number().int().min(-2).max(2) }),
  z.object({ kind: z.literal('noExtremePolicies') }),
  z.object({ kind: z.literal('influenceLeader'), group: VoterGroupKeySchema }),
  z.object({ kind: z.literal('influenceLeaderAny'), groups: z.array(VoterGroupKeySchema).min(2) }),
  z.object({ kind: z.literal('notInfluenceLeader'), group: VoterGroupKeySchema }),
  z.object({ kind: z.literal('candidateWon'), candidateId: CandidateIdSchema }),
  z.object({ kind: z.literal('candidateWonAtMost'), candidateId: CandidateIdSchema, maxTimes: z.number().int().min(0) }),
  z.object({ kind: z.literal('reputationAtLeast'), minAmount: z.number().int().positive() }),
  z.object({ kind: z.literal('reputationRankAtMost'), maxRank: z.number().int().positive() }),
  z.object({ kind: z.literal('remainingMoneyAtLeast'), minAmount: z.number().int().positive() }),
]);
export type AgendaCondition = z.infer<typeof AgendaConditionSchema>;

export const SecretAgendaCardSchema = z.object({
  id: AgendaIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  condition: AgendaConditionSchema,
  /** §17: 이론상 최대 점수는 대략 8-13 VP 범위 */
  points: z.number().int().min(8).max(13),
});
export type SecretAgendaCard = z.infer<typeof SecretAgendaCardSchema>;
