// 기반 스킬: skills/engine-core/SKILL.md
// §18 phase 16종 정의 + 각 phase의 (허용 액션, 자동 진행 가능 여부)
import type { PlayerAction, SystemAction } from './types/actions';

export type PhaseId =
  | 'setup'
  | 'income'
  | 'issueReveal'
  | 'candidateReveal'
  | 'auctionBidding'
  | 'auctionResolved'
  | 'promiseSelection'
  | 'voterReveal'
  | 'campaignActions'
  | 'unification'
  | 'voting'
  | 'electionEffectSelection'
  | 'policyResolution'
  | 'roundScoring'
  | 'cleanup'
  | 'gameEnd';

export const PHASE_ORDER: readonly PhaseId[] = [
  'setup',
  'income',
  'issueReveal',
  'candidateReveal',
  'auctionBidding',
  'auctionResolved',
  'promiseSelection',
  'voterReveal',
  'campaignActions',
  'unification',
  'voting',
  'electionEffectSelection',
  'policyResolution',
  'roundScoring',
  'cleanup',
  'gameEnd',
];

export interface PhaseDefinition {
  id: PhaseId;
  /** §7 — 이 phase에서 플레이어 결정을 기다려야 하는지 (runUntilPlayerAction의 정지 기준) */
  requiresPlayerDecision: boolean;
  /** 한국어 설명 — 로그·디버그·UI에 사용 */
  description: string;
}

// §7: 플레이어 결정 단계(입찰/공약/캠페인/단일화/선택형 당선효과) vs 시스템 자동 진행 단계
export const PHASES: Readonly<Record<PhaseId, PhaseDefinition>> = {
  setup: { id: 'setup', requiresPlayerDecision: false, description: '게임 초기화' },
  income: { id: 'income', requiresPlayerDecision: false, description: '수입 지급' },
  issueReveal: { id: 'issueReveal', requiresPlayerDecision: false, description: '사회 이슈 공개' },
  candidateReveal: { id: 'candidateReveal', requiresPlayerDecision: false, description: '후보 마켓 공개' },
  auctionBidding: { id: 'auctionBidding', requiresPlayerDecision: true, description: '후보 경매' },
  auctionResolved: { id: 'auctionResolved', requiresPlayerDecision: false, description: '경매 정산' },
  promiseSelection: { id: 'promiseSelection', requiresPlayerDecision: true, description: '공약 선택' },
  voterReveal: { id: 'voterReveal', requiresPlayerDecision: false, description: '유권자 공개' },
  campaignActions: { id: 'campaignActions', requiresPlayerDecision: true, description: '캠페인 액션' },
  unification: { id: 'unification', requiresPlayerDecision: true, description: '단일화' },
  voting: { id: 'voting', requiresPlayerDecision: false, description: '투표' },
  electionEffectSelection: {
    id: 'electionEffectSelection',
    requiresPlayerDecision: true,
    description: '당선 효과 선택',
  },
  policyResolution: { id: 'policyResolution', requiresPlayerDecision: false, description: '정책 변화' },
  roundScoring: { id: 'roundScoring', requiresPlayerDecision: false, description: '라운드 점수' },
  cleanup: { id: 'cleanup', requiresPlayerDecision: false, description: '정리' },
  gameEnd: { id: 'gameEnd', requiresPlayerDecision: false, description: '게임 종료' },
};

/**
 * 다음 phase를 계산한다.
 * cleanup 이후는 라운드 수에 따라 income(다음 라운드) 또는 gameEnd로 분기한다 (§7, §16).
 * gameEnd는 종료 후 정지 상태를 유지한다.
 */
export function getNextPhase(current: PhaseId, round: number, maxRounds: number): PhaseId {
  if (current === 'gameEnd') {
    return 'gameEnd';
  }
  if (current === 'cleanup') {
    return round >= maxRounds ? 'gameEnd' : 'income';
  }
  const idx = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[idx + 1] ?? 'gameEnd';
}

/** §20 플레이어 액션이 유효한 phase — 이 표를 벗어난 호출은 reducer가 ok:false로 거부한다 */
export const PLAYER_ACTION_PHASE: Readonly<Record<PlayerAction['type'], PhaseId>> = {
  placeBid: 'auctionBidding',
  confirmAuctionBids: 'auctionBidding',
  selectPromise: 'promiseSelection',
  contactVoter: 'campaignActions',
  runAd: 'campaignActions',
  pressurePolicy: 'campaignActions',
  fundraise: 'campaignActions',
  reportScandal: 'campaignActions',
  conditionalSupport: 'campaignActions',
  assignVoterChoice: 'campaignActions',
  proposeUnification: 'unification',
  acceptUnification: 'unification',
  declineUnification: 'unification',
  skipUnification: 'unification',
  selectElectionPolicyMove: 'electionEffectSelection',
  useEvent: 'campaignActions',
  poll: 'campaignActions',
};

/** §19 시스템 액션이 유효한 phase (지정 없으면 여러 phase에서 허용) */
export const SYSTEM_ACTION_PHASE: Readonly<Partial<Record<SystemAction['type'], PhaseId>>> = {
  startGame: 'setup',
  revealIssue: 'issueReveal',
  revealCandidates: 'candidateReveal',
  generateRandomBids: 'auctionBidding',
  resolveAuction: 'auctionBidding',
  autoSelectPromises: 'promiseSelection',
  revealVoters: 'voterReveal',
  runUnificationTest: 'unification',
  resolveVoting: 'voting',
  resolvePolicy: 'policyResolution',
  scoreRound: 'roundScoring',
  nextRound: 'cleanup',
};

/**
 * 자동 진행(requiresPlayerDecision: false) phase에서 runSystemStep이 호출할 액션.
 * income/auctionResolved처럼 전용 액션이 없는 phase는 'advancePhase'가 처리한다.
 */
export type AutoActionType =
  | 'advancePhase'
  | 'revealIssue'
  | 'revealCandidates'
  | 'revealVoters'
  | 'resolveVoting'
  | 'resolvePolicy'
  | 'scoreRound'
  | 'nextRound';

export const AUTO_PHASE_ACTION: Readonly<Partial<Record<PhaseId, AutoActionType>>> = {
  income: 'advancePhase',
  issueReveal: 'revealIssue',
  candidateReveal: 'revealCandidates',
  auctionResolved: 'advancePhase',
  voterReveal: 'revealVoters',
  voting: 'resolveVoting',
  policyResolution: 'resolvePolicy',
  roundScoring: 'scoreRound',
  cleanup: 'nextRound',
};
