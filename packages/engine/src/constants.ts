// 기반 스킬: skills/engine-core/SKILL.md
// 게임 수치·인원별 설정표·비용표 중앙화 (CLAUDE.md 코딩 규칙)
import type { CampRole, PolicyTrackId } from './types/ids';

// ── §3 인원별 설정 ────────────────────────────────────────────
export interface PlayerCountConfig {
  playerCount: number;
  /** 공개 후보 수 */
  revealedCandidates: number;
  /** 출마 후보 수 (모든 인원 공통 3명) */
  runningCandidates: number;
  /** 공개 유권자 수 */
  revealedVoters: number;
  /** 캠프 슬롯 구성 */
  campSlots: readonly CampRole[];
  /** 플레이어당 캠페인 액션 수 (모든 인원 공통 2) */
  campaignActionsPerPlayer: number;
  /** 6-7인 킹메이커 점수 활성 여부 */
  kingmakerBonusEnabled: boolean;
}

export const PLAYER_COUNT_CONFIGS: Readonly<Record<number, PlayerCountConfig>> = {
  4: {
    playerCount: 4,
    revealedCandidates: 5,
    runningCandidates: 3,
    revealedVoters: 5,
    campSlots: ['majorBacker', 'coBacker'],
    campaignActionsPerPlayer: 2,
    kingmakerBonusEnabled: false,
  },
  5: {
    playerCount: 5,
    revealedCandidates: 6,
    runningCandidates: 3,
    revealedVoters: 6,
    campSlots: ['majorBacker', 'coBacker'],
    campaignActionsPerPlayer: 2,
    kingmakerBonusEnabled: false,
  },
  6: {
    playerCount: 6,
    revealedCandidates: 7,
    runningCandidates: 3,
    revealedVoters: 7,
    campSlots: ['majorBacker', 'coBacker', 'organizer'],
    campaignActionsPerPlayer: 2,
    kingmakerBonusEnabled: true,
  },
  7: {
    playerCount: 7,
    revealedCandidates: 8,
    runningCandidates: 3,
    revealedVoters: 8,
    campSlots: ['majorBacker', 'coBacker', 'organizer'],
    campaignActionsPerPlayer: 2,
    kingmakerBonusEnabled: true,
  },
};

/**
 * 인원수에 맞는 설정표를 반환한다.
 * 4~7인 밖의 인원수는 룰 자체가 정의되지 않으므로 호출자(서버 방 생성 검증 등) 오류로 보고 throw한다
 * — 액션 검증 실패( {ok:false} )와는 다른, 게임 구성 단계의 프로그래머 오류다.
 */
export function getPlayerCountConfig(playerCount: number): PlayerCountConfig {
  const config = PLAYER_COUNT_CONFIGS[playerCount];
  if (!config) {
    throw new Error(`지원하지 않는 인원수입니다: ${playerCount} (4~7인만 지원)`);
  }
  return config;
}

// ── §5 시작 자원·라운드 수입 ──────────────────────────────────
export const STARTING_MONEY = 10;
export const STARTING_ORGANIZATION = 4;
export const STARTING_REPUTATION = 2;
export const STARTING_VICTORY_POINTS = 0;

export const INCOME_MONEY = 5;
export const INCOME_ORGANIZATION = 2;

// ── §6 정책 트랙 ──────────────────────────────────────────────
export const POLICY_TRACKS: readonly PolicyTrackId[] = ['economy', 'labor', 'society', 'industry', 'foreign'];
export const POLICY_TRACK_MIN = -2;
export const POLICY_TRACK_MAX = 2;
export const POLICY_TRACK_START = 0;

// ── §11 캠페인 액션 비용표 ────────────────────────────────────
export type CampaignActionType =
  | 'contactVoter'
  | 'runAd'
  | 'pressurePolicy'
  | 'fundraise'
  | 'reportScandal'
  | 'conditionalSupport'
  | 'assignVoterChoice';

export interface CampaignActionCost {
  money?: number;
  organization?: number;
  reputation?: number;
}

export const CAMPAIGN_ACTION_COSTS: Readonly<Record<CampaignActionType, CampaignActionCost>> = {
  contactVoter: { organization: 1 },
  runAd: { money: 2 },
  pressurePolicy: { organization: 2 },
  fundraise: { reputation: 1 },
  reportScandal: { money: 2, reputation: 1 },
  conditionalSupport: {},
  assignVoterChoice: {},
};

/** 액션 소모 여부 — assignVoterChoice(배치)만 무료 보조 권한이라 액션을 소모하지 않는다 */
export const CAMPAIGN_ACTION_CONSUMES_TURN: Readonly<Record<CampaignActionType, boolean>> = {
  contactVoter: true,
  runAd: true,
  pressurePolicy: true,
  fundraise: true,
  reportScandal: true,
  conditionalSupport: true,
  assignVoterChoice: false,
};

export const CAMPAIGN_ACTIONS_PER_PLAYER = 2;
