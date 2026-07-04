// 기반 스킬: skills/engine-core/SKILL.md
// §18 핵심 데이터 모델 — GameState, RoundState, PlayerState, DrawPiles,
// ActionLogEntry, RoundHistoryEntry, RoundResultSummary
import type { AuctionMode, GameAction } from './actions';
import type {
  AgendaId,
  CandidateId,
  EventId,
  IssueId,
  PlayerId,
  PolicyTrackId,
  PromiseId,
  VoterGroupId,
  VoterId,
} from './ids';
import type { PhaseId } from '../phases';
import type { RngState } from '../rng';

/** 한 플레이어(브로커)의 공개+비공개 상태 (§5) */
export interface PlayerState {
  id: PlayerId;
  /** 0-based 좌석 번호 */
  seat: number;
  name: string;
  money: number;
  organization: number;
  reputation: number;
  victoryPoints: number;
  /** 비밀 정보 — projectView(부록 A-3)가 본인 시점 외에는 제거해야 한다 */
  secretAgendaId: AgendaId | null;
  /** §10, §15 — 라운드마다 누적되는 그룹별 영향력 마커. 최종 비밀 의제 평가(§17)에 사용 */
  influenceMarkers: Partial<Record<VoterGroupId, number>>;
  /** §5 라운드 수입으로 받는 손패. 사용(useEvent)은 7단계까지 거부된다 (부록 A-4) */
  candidateEventHand: EventId[];
}

/**
 * 라운드 단위로 리셋되는 상태.
 * 경매·공약·캠페인·단일화·투표 관련 필드는 Skill 4~7(auction-promise 등)이 추가한다.
 */
export interface RoundState {
  /** 1-based 라운드 번호 */
  round: number;
  issueId: IssueId | null;
  candidatesRevealed: CandidateId[];
  /** 경매 정산 후 확정되는 출마 후보 3명 (§8) */
  candidatesRunning: CandidateId[];
  votersRevealed: VoterId[];
}

/** 셔플된 카드 풀의 남은 뭉치. Phase 1은 실제 카드 데이터 없이 placeholder ID로 채운다 */
export interface DrawPiles {
  candidateDeck: CandidateId[];
  promiseDeck: PromiseId[];
  voterDeck: VoterId[];
  issueDeck: IssueId[];
  candidateEventDeck: EventId[];
  voterEventDeck: EventId[];
  agendaDeck: AgendaId[];
}

/**
 * "누구에게 무엇이 얼마나 변했는지"의 최소 구조 (부록 A-6).
 * Skill 11의 EffectToast가 그대로 렌더할 수 있도록 field는 selectors가 해석 가능한 문자열로 둔다.
 */
export interface EffectDescriptor {
  target: PlayerId | CandidateId | VoterId | PolicyTrackId | 'game';
  field: string;
  delta?: number;
  after?: number | string | null;
}

/** 액션 로그 1건 — 부록 A-6 */
export interface ActionLogEntry {
  seq: number;
  round: number;
  phase: PhaseId;
  /** 시스템 액션은 actor가 없다 */
  actor: PlayerId | null;
  action: GameAction['type'];
  /** 한국어 자연어 문장 */
  summary: string;
  effects: EffectDescriptor[];
}

/**
 * 한 라운드가 끝난 뒤 영구 보관되는 압축 기록.
 * §17 비밀 의제는 GameState의 현재 스냅샷이 아니라 이 히스토리 배열 전체를 참조해 평가해야 한다.
 * 상세 항목(vpBreakdown 등)은 Skill 7(scoring)이 채운다.
 */
export interface RoundHistoryEntry {
  round: number;
  winnerCandidateId: CandidateId | null;
  policyTracksAfter: Record<PolicyTrackId, number>;
  vpAwarded: Partial<Record<PlayerId, number>>;
  influenceMarkersAwarded: Partial<Record<PlayerId, Partial<Record<VoterGroupId, number>>>>;
}

/**
 * roundScoring 직후 UI(Skill 11 RoundSummary)에 보여줄 상세 결과.
 * RoundHistoryEntry와 달리 사유(reasons)까지 포함하는 휘발성 요약이다. Skill 7이 채운다.
 */
export interface RoundResultSummary {
  round: number;
  candidateVotes: Partial<Record<CandidateId, number>>;
  winnerCandidateId: CandidateId | null;
  vpBreakdown: Partial<Record<PlayerId, { total: number; reasons: EffectDescriptor[] }>>;
}

/** 게임 전체 상태 — schemaVersion 0.2 (GAME_SPEC.md 상단 고정값) */
export interface GameState {
  schemaVersion: '0.2';
  /** 최초 세팅에 사용된 seed (디버그/기록용) */
  seed: number;
  /** 부록 A-5: RNG 상태는 GameState에 보관해 결정적으로 주입한다 */
  rngState: RngState;
  phase: PhaseId;
  /** 풀게임 5, 튜토리얼/디버그 1 (§3) */
  maxRounds: number;
  round: RoundState;
  /** 좌석 순서(seat 오름차순)로 정렬되어 있다 */
  players: PlayerState[];
  drawPiles: DrawPiles;
  auctionMode: AuctionMode;
  /** §6 정책 트랙 5종, 각 -2..2 */
  policyTracks: Record<PolicyTrackId, number>;
  actionLog: ActionLogEntry[];
  roundHistory: RoundHistoryEntry[];
  lastRoundResult: RoundResultSummary | null;
  /** 다음에 발급할 ActionLogEntry.seq */
  nextLogSeq: number;
}
