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
}

export interface EventCard {
  id: EventId;
  name: string;
  category: 'candidate' | 'voter';
  description: string;
  effect: { todo: true };
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

/** 카드 콘텐츠 조회 테이블. 호출자(테스트/서버)가 packages/data로 채워 reduce()에 주입한다 */
export interface CardCatalog {
  candidates: Record<CandidateId, CandidateCard>;
  promises: Record<PromiseId, PromiseCard>;
  voters: Record<VoterId, VoterCard>;
  issues: Record<IssueId, IssueCard>;
  candidateEvents: Record<EventId, EventCard>;
  voterEvents: Record<EventId, EventCard>;
  agendas: Record<AgendaId, SecretAgendaCard>;
}
