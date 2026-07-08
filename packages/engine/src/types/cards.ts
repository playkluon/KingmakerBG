// 기반 스킬: skills/auction-promise/SKILL.md
// 카드 "내용"의 엔진 관점 형태. 실제 190장 데이터는 packages/data가 갖고 있고,
// 엔진은 여전히 packages/data에 의존하지 않는다 — 호출자가 CardCatalog로 주입한다(setup.ts의 decks와 같은 패턴).
// 태그·그룹 같은 열거값은 packages/data가 더 좁은 리터럴 유니온으로 검증하지만,
// 엔진은 문자열 비교만 하면 되므로 string으로 받는다 (구조적 타이핑으로 data의 값도 그대로 대입 가능).
import type {
  AgendaId,
  CandidateId,
  EventId,
  IssueId,
  PartyId,
  PolicyDirection,
  PolicyTrackId,
  PromiseId,
  VoterGroupId,
  VoterId,
} from './ids';

export interface PolicyMove {
  track: PolicyTrackId;
  direction: PolicyDirection;
  amount: number;
}

/** §14 당선 효과 4유형 */
export type ElectionEffect =
  | { kind: 'fixedPolicyMove'; track: PolicyTrackId; direction: PolicyDirection; amount: number }
  | { kind: 'choosePolicyMove'; options: PolicyMove[] }
  | { kind: 'flexPolicyMove'; amount: number }
  | { kind: 'winningPromisePolicyMove'; repeat: number };

/** §11 후보 능력/약점 — MVP 활성 5종 + 서술형(비활성) */
export type CandidateAbility =
  | { kind: 'fundraiseBonus'; amount: number; active: true }
  | { kind: 'voterContactDiscount'; group: VoterGroupId; amount: number; active: true }
  | { kind: 'policyPressureDiscount'; amount: number; active: true }
  | { kind: 'promiseRestriction'; excludedTag: string; active: true }
  | { kind: 'reputationLossOnPromise'; amount: number; active: true }
  | { kind: 'flavorOnly'; description: string; active: false };

export interface CandidateCard {
  id: CandidateId;
  name: string;
  description: string;
  /** 소속 정당 (개편안 A) — 플레이어 손패 구성의 기준. 실카드는 항상 갖고, 엔진 자체 테스트의 placeholder만 생략한다 */
  party?: PartyId;
  baseVotes: number;
  leaningTags: string[];
  supportedVoterGroups: VoterGroupId[];
  electionEffect: ElectionEffect;
  abilities: CandidateAbility[];
}

/** §9 공약 즉시 효과 5유형 */
export type PromiseEffect =
  | { kind: 'extraVotes'; amount: number }
  | { kind: 'extraVotesIfGroupRevealed'; group: VoterGroupId; amount: number }
  | { kind: 'backerReward'; resource: 'money' | 'victoryPoints'; amount: number }
  | { kind: 'backerInfluence'; group: VoterGroupId; amount: number }
  | { kind: 'backerPressureToken'; track: PolicyTrackId; direction: PolicyDirection; amount: number };

export interface PromiseCard {
  id: PromiseId;
  name: string;
  description: string;
  policyMove: PolicyMove;
  reactionTag: string;
  effect: PromiseEffect;
}

export interface VoterCard {
  id: VoterId;
  name: string;
  description: string;
  group: VoterGroupId;
  voteWeight: number;
  preferredTag: string;
  conflictTag: string;
  dislikedTag?: string;
}

export interface IssueCard {
  id: IssueId;
  name: string;
  description: string;
  /**
   * 개편안 B: 이 이슈가 부각시키는 정책 계열(targetTag)과 매칭되는 후보에게 주는 표 보너스.
   * VP 보너스는 두지 않는다 — 이슈는 표심(투표 집계)에만 영향을 주고, 점수는 당선 결과로만 발생한다.
   */
  advantage?: { targetTag: string; voteBonus: number };
}

/**
 * §5, §11 이벤트 카드 효과 3유형 (부록 A-17) — PromiseEffect/CandidateAbility와 같은 성격으로,
 * 60장 각각이 별도 효과를 갖는 대신 소수의 재사용 가능한 유형에 수치만 다르게 배정한다.
 */
export type EventEffect =
  | { kind: 'resourceDelta'; resource: 'money' | 'organization' | 'reputation'; amount: number }
  | { kind: 'candidateVotesDelta'; amount: number }
  | { kind: 'groupInfluence'; group: VoterGroupId; amount: number };

export interface EventCard {
  id: EventId;
  name: string;
  category: 'candidate' | 'voter';
  description: string;
  effect: EventEffect;
}

/** §17 비밀 의제 조건 11유형 */
export type AgendaCondition =
  | { kind: 'policyAtLeast'; track: PolicyTrackId; direction: PolicyDirection; minMagnitude: number }
  | { kind: 'policyBetween'; track: PolicyTrackId; min: number; max: number }
  | { kind: 'noExtremePolicies' }
  | { kind: 'influenceLeader'; group: VoterGroupId }
  | { kind: 'influenceLeaderAny'; groups: VoterGroupId[] }
  | { kind: 'notInfluenceLeader'; group: VoterGroupId }
  | { kind: 'candidateWon'; candidateId: CandidateId }
  | { kind: 'candidateWonAtMost'; candidateId: CandidateId; maxTimes: number }
  | { kind: 'reputationAtLeast'; minAmount: number }
  | { kind: 'reputationRankAtMost'; maxRank: number }
  | { kind: 'remainingMoneyAtLeast'; minAmount: number };

export interface SecretAgendaCard {
  id: AgendaId;
  name: string;
  description: string;
  condition: AgendaCondition;
  points: number;
}

/**
 * 정당 패시브 효과 (개편안 A) — 자유 텍스트가 아니라 판별 가능한 유니온으로 정의한다 (CLAUDE.md 코딩 규칙).
 * 엔진은 이 구조화된 값만 읽는다 — 정당 id를 엔진 코드에 하드코딩하지 않는다.
 */
export type PartyPassive =
  /** 특정 캠페인 액션의 자원 비용 증감 (양수 = 비용 증가, 음수 = 할인) */
  | { kind: 'actionCostDelta'; action: 'contactVoter' | 'runAd' | 'pressurePolicy' | 'reportScandal'; resource: 'money' | 'organization'; delta: number }
  /** 모금(fundraise)으로 얻는 자금 증감 */
  | { kind: 'fundraiseYieldDelta'; delta: number }
  /** 광고(runAd) 집행 시 평판 획득 */
  | { kind: 'adReputationGain'; amount: number }
  /** 조건부 지지 성공 시(§15) 추가 자금 지급 — VP가 아니라 자금 보상이다 */
  | { kind: 'conditionalSupportBonusMoney'; amount: number }
  /** 지정 계열(targetTag) 이슈가 공개될 때마다 조직력 획득 */
  | { kind: 'issueTagOrganizationGain'; targetTag: string; amount: number }
  /** 지정 계열 공약을 (majorBacker로서) 선택하면 자금 차감 */
  | { kind: 'promiseTagMoneyCost'; tags: string[]; amount: number }
  /** 지정 계열 공약을 (majorBacker로서) 선택하면 평판 차감 */
  | { kind: 'promiseTagReputationLoss'; tags: string[]; amount: number }
  /** 지정 계열 공약은 (majorBacker로서) 선택 불가 */
  | { kind: 'promiseTagRestriction'; tags: string[] };

/** 정당 카드 (개편안 A) — 고유 색상·패시브. passives가 규칙, advantage/disadvantage 텍스트는 UI 표시용이다 */
export interface PartyCard {
  id: PartyId;
  name: string;
  description: string;
  /** CSS에서 그대로 쓸 수 있는 색상 값 (hex) */
  color: string;
  passiveAdvantage: string;
  passiveDisadvantage: string;
  passives: PartyPassive[];
}

/** 카드 콘텐츠 조회 테이블. 호출자(테스트/서버)가 packages/data로 채워 reduce()에 주입한다 */
export interface CardCatalog {
  candidates: Record<CandidateId, CandidateCard>;
  promises: Record<PromiseId, PromiseCard>;
  voters: Record<VoterId, VoterCard>;
  issues: Record<IssueId, IssueCard>;
  candidateEvents: Record<EventId, EventCard>;
  voterEvents: Record<EventId, EventCard>;
  agendas: Record<AgendaId, SecretAgendaCard>;
  /** 정당 7종 — 엔진 자체 테스트는 생략할 수 있어 optional로 둔다 */
  parties?: Record<PartyId, PartyCard>;
}
