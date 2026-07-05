// 기반 스킬: skills/engine-core/SKILL.md
// 엔진 공개 API 배럴 — apps/server는 이 파일 전체를, apps/client는 타입·selectors만 import한다 (CLAUDE.md).

/** 엔진 코드 버전 (패키지 버전과 동기) */
export const ENGINE_VERSION = '0.1.0';

/** GameState 스키마 버전 — GAME_SPEC.md 기준 0.2 고정 */
export const SCHEMA_VERSION = '0.2';

// ── 규칙 진입점 ──────────────────────────────────────────────
export { reduce } from './reducer';
export type { ReduceResult } from './reducer';
export { buildPlaceholderIds, setupGame } from './setup';
export type { SetupOptions, SetupPlayerInput } from './setup';

// ── phase 상태 머신 ──────────────────────────────────────────
export { AUTO_PHASE_ACTION, getNextPhase, PHASE_ORDER, PHASES, PLAYER_ACTION_PHASE, SYSTEM_ACTION_PHASE } from './phases';
export type { AutoActionType, PhaseDefinition, PhaseId } from './phases';

// ── 상수 ────────────────────────────────────────────────────
export {
  CAMPAIGN_ACTION_COSTS,
  CAMPAIGN_ACTION_CONSUMES_TURN,
  CAMPAIGN_ACTIONS_PER_PLAYER,
  getPlayerCountConfig,
  INCOME_MONEY,
  INCOME_ORGANIZATION,
  PLAYER_COUNT_CONFIGS,
  POLICY_TRACK_MAX,
  POLICY_TRACK_MIN,
  POLICY_TRACK_START,
  POLICY_TRACKS,
  POLL_ENABLED,
  SCORE_CO_BACKER_WIN,
  SCORE_CONDITIONAL_SUPPORT_SUCCESS,
  SCORE_KINGMAKER_BONUS,
  SCORE_MAJOR_BACKER_WIN,
  SCORE_ORGANIZER_WIN,
  SCORE_POLICY_PRESSURE_SUCCESS,
  SCORE_PROMISE_BONUS_MAJOR_BACKER,
  SCORE_RUNNER_UP_MAJOR_BACKER,
  SCORE_VOTER_SUPPORT_WINNER,
  STARTING_MONEY,
  STARTING_ORGANIZATION,
  STARTING_REPUTATION,
  STARTING_VICTORY_POINTS,
} from './constants';
export type { CampaignActionCost, CampaignActionType, PlayerCountConfig } from './constants';

// ── RNG ─────────────────────────────────────────────────────
export { createRng, nextInt, nextRandom, shuffle } from './rng';
export type { RngState } from './rng';

// ── 타입 ────────────────────────────────────────────────────
export type {
  AgendaId,
  CampRole,
  CandidateId,
  EventId,
  IssueId,
  PlayerId,
  PolicyDirection,
  PolicyTrackId,
  PromiseId,
  VoterGroupId,
  VoterId,
} from './types/ids';
export type { AuctionMode, GameAction, PlayerAction, SystemAction } from './types/actions';
export { isPlayerAction } from './types/actions';
export type {
  ActionLogEntry,
  AuctionBidState,
  CampState,
  DrawPiles,
  EffectDescriptor,
  ElectionEffectResolution,
  FinalResultSummary,
  FinalScoreEntry,
  GameState,
  PlayerState,
  PolicyPressure,
  RoundHistoryEntry,
  RoundResultSummary,
  RoundState,
  UnificationProposal,
} from './types/state';
export type {
  AgendaCondition,
  CandidateAbility,
  CandidateCard,
  CardCatalog,
  ElectionEffect,
  EventCard,
  IssueCard,
  PolicyMove,
  PromiseCard,
  PromiseEffect,
  SecretAgendaCard,
  VoterCard,
} from './types/cards';

// ── 규칙 함수 (서버·시뮬레이션·후속 스킬 재사용용) ─────────────
export { computeVoterSupport, computeVoterVotes, getVoterController } from './rules/voters';
export type { VoterSupport } from './rules/voters';
export { computeTransferRatio } from './rules/unification';
export { computeVoteBreakdown } from './rules/voting';
export type { VoteBreakdown } from './rules/voting';
export { evaluateAgendaCondition } from './rules/agendas';
export { computeFinalResult } from './rules/finalScoring';

// ── selectors (클라이언트 import 허용 대상) ───────────────────
export { getPhaseDescription, isGameOver, isWaitingForPlayerDecision } from './selectors';
