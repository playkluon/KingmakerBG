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
  PolicyDirection,
  PolicyTrackId,
  PromiseId,
  VoterGroupId,
  VoterId,
  PartyId,
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
  /** §16-5 "공개 계약 이행 수" 누계 — 게임 전체에 걸쳐 누적되며 라운드로 리셋되지 않는다 */
  contractsFulfilled: number;
  /** §12 비밀 pact 배신 피해자가 받는 손패 (부록 A-16) — candidateEventHand와 별도로 관리 */
  voterEventHand: EventId[];
  /** §12 "betrayed-secret-pact" 플래그 — 게임 중 한 번이라도 비밀 pact를 배신하면 true로 고정된다 */
  betrayedSecretPact: boolean;
  /** 소속 정당 */
  party: PartyId | null;
  /** 손패에 들고 있는 후보 카드들 */
  hand: CandidateId[];
}

/** 플레이어 1명의 경매 입찰 상태 (§8) */
export interface AuctionBidState {
  /** 후보별 배분액. 확정 전까지 재제출 시 통째로 교체된다 */
  allocations: Partial<Record<CandidateId, number>>;
  confirmed: boolean;
}

/** 출마 후보 1명의 캠프 구성 (§3, §8, §9) */
export interface CampState {
  majorBacker: PlayerId | null;
  coBacker: PlayerId | null;
  /** 6-7인 전용. 4-5인 게임에서는 항상 null (§3) */
  organizer: PlayerId | null;
  /** 제시된 공약 후보 3장 */
  promiseOptions: PromiseId[];
  /** majorBacker(또는 autoSelectPromises)가 확정한 공약 */
  promiseId: PromiseId | null;
  /** 경매에서 이 후보에게 걸린 총 금액 (§13 투표 동점 처리 ②에 쓰인다) */
  totalBacking: number;
}

/** §12 후속 규칙 "공개 조건 계약" — 대표 후보가 당선되면 제안자가 자동으로 이행하는 조건 (부록 A-15) */
export type UnificationTerm =
  | { kind: 'moneyTransfer'; amount: number }
  | { kind: 'victoryPointGrant'; amount: number }
  | { kind: 'policyConcession'; track: PolicyTrackId; direction: PolicyDirection; amount: number };

/** 단일화 제안 1건 (§12) — 시스템 전체에 최대 1건만 대기할 수 있다 */
export interface UnificationProposal {
  proposer: PlayerId;
  leadCandidateId: CandidateId;
  withdrawCandidateId: CandidateId;
  /** A-12 기준 계산된 이전 비율 (0.7 / 0.5 / 0.3) */
  ratio: number;
  /** 제안 시점 사퇴 후보의 표 × ratio, 내림 */
  transferVotes: number;
  /** 공개 조건 계약 조건 — 비어 있으면 순수 단일화(§12 기본 범위)와 동일하다 */
  terms: UnificationTerm[];
}

/** 수락된 단일화의 공개 조건 계약 (§12 후속 규칙, §16-5) — policyResolution에서 이행 여부가 확정된다 */
export interface UnificationContract {
  proposer: PlayerId;
  /** 사퇴 후보의 majorBacker — 계약 수혜자 */
  beneficiary: PlayerId;
  leadCandidateId: CandidateId;
  terms: UnificationTerm[];
  /** leadCandidateId가 실제로 당선되어 조건이 이행됐는지 — 최종 점수 §16-5 "이행 수" 집계 기준 */
  fulfilled: boolean;
}

/**
 * §12 "비밀 pact" (부록 A-16) — 당사자 둘만 아는 약속. 브리프가 약속의 구체적 내용을 정의하지 않아,
 * 라운드 종료 시점에 실제로 확인 가능한 유일한 형태인 "이 후보를 지지하겠다"로 좁혔다.
 */
export type SecretPactPromise = { kind: 'supportCandidate'; candidateId: CandidateId };

/**
 * 대기 중인 비밀 pact 제안 — projectView가 당사자 외 전원에게서 제거한다.
 * (proposer, counterparty) 쌍이 accept/decline 액션의 식별 키다 — 별도 id 생성기가 필요 없다(결정성 유지, 부록 A-5).
 */
export interface SecretPactProposal {
  proposer: PlayerId;
  counterparty: PlayerId;
  /** 제안자가 지키겠다고 약속하는 내용 */
  promise: SecretPactPromise;
}

/** 수락된 비밀 pact — roundScoring이 이행 여부를 판정해 배신 페널티를 매긴다 */
export interface SecretPact {
  proposer: PlayerId;
  counterparty: PlayerId;
  promise: SecretPactPromise;
}

/** 당선 효과(§14) 확정 결과. policyResolution이 이 값을 그대로 적용한다 */
export type ElectionEffectResolution =
  | { kind: 'move'; track: PolicyTrackId; direction: PolicyDirection; amount: number }
  | { kind: 'repeatPromise'; repeat: number };

/** 정책 트랙 1개에 쌓인 압박 총합 (§6) — 압박 액션과 공약의 backerPressureToken이 함께 쌓는다 */
export interface PolicyPressure {
  plus: number;
  minus: number;
}

/**
 * 라운드 단위로 리셋되는 상태.
 * 단일화·투표 관련 필드는 Skill 6~7이 추가한다.
 */
export interface RoundState {
  /** 1-based 라운드 번호 */
  round: number;
  /** 전반전에 선공개된 이슈 2장 */
  firstIssues: IssueId[];
  /** 후반전에 공개된 이슈 2장 */
  secondIssues: IssueId[];
  /** 플레이어들이 제안(어필)한 출품 후보들 */
  candidatesRevealed: CandidateId[];
  /** 개편안 B: 플레이어별 이번 라운드 후보 제안 기록 — 1인 1회 제한과 phase 전진 판정의 근거 */
  proposals: Partial<Record<PlayerId, CandidateId>>;
  /** 경매 정산 후 확정되는 출마 후보 3명 (§8) */
  candidatesRunning: CandidateId[];
  votersRevealed: VoterId[];
  /** 좌석별 입찰 상태. 부록 A-3: 마스킹 시 confirmed만 남기고 allocations는 제거해야 한다 */
  bids: Partial<Record<PlayerId, AuctionBidState>>;
  /** 출마 후보 id를 키로 하는 캠프 구성 (경매 정산 후 채워짐) */
  camps: Partial<Record<CandidateId, CampState>>;
  /** §10: 유권자 카드별 · 플레이어별 누적 영향력. 단독 최고값 보유자가 controller다 */
  voterInfluence: Partial<Record<VoterId, Partial<Record<PlayerId, number>>>>;
  /** §10 배치(assignVoterChoice) 결과. 투표 전까지 재배치 가능 — 마지막 값이 적용된다 */
  voterAssignments: Partial<Record<VoterId, CandidateId>>;
  /** §11 광고(+2)·스캔들(-2)·조건지지(+1)로 누적되는 후보별 표 보정치 */
  campaignVotes: Partial<Record<CandidateId, number>>;
  /** §11 조건지지를 실행한 플레이어 목록(후보별) — §15 "조건지지 성공" 채점에 쓰인다 */
  conditionalSupporters: Partial<Record<CandidateId, PlayerId[]>>;
  /** §6 정책 압박 누적 — 압박 액션과 공약 backerPressureToken 효과가 함께 쌓는다 */
  policyPressure: Record<PolicyTrackId, PolicyPressure>;
  /** 트랙·방향별 압박을 실행한 플레이어 목록 (§15 "내 정책 압박이 실제 반영됨" 채점용) */
  pressureContributors: Partial<Record<PolicyTrackId, Partial<Record<PolicyDirection, PlayerId[]>>>>;
  /** resolvePolicy가 실제로 반영한 (최대 2개) 트랙·방향 — roundScoring이 압박 성공 여부를 판단할 때 재사용한다 */
  pressureAppliedTracks: Array<{ track: PolicyTrackId; direction: PolicyDirection }>;
  /** §11 캠페인 액션 라운드로빈 순서 (좌석 순, campaignActions 진입 시 고정) */
  campaignTurnOrder: PlayerId[];
  /** campaignTurnOrder 안에서 현재 차례의 인덱스 */
  campaignActiveIndex: number;
  /** 플레이어별 이번 라운드 사용한 캠페인 액션 수 (최대 2, assignVoterChoice는 포함 안 됨) */
  campaignActionsUsed: Partial<Record<PlayerId, number>>;
  /** §12 비밀 pact 제안 대기 목록 — assignVoterChoice처럼 무료·차례 무관 (부록 A-16) */
  pendingSecretPactProposals: SecretPactProposal[];
  /** 수락되어 이번 라운드 판정 대상이 된 비밀 pact 목록 */
  activeSecretPacts: SecretPact[];
  /** §12 단일화로 사퇴한 후보 (라운드당 최대 1명 — 부록 A-12) */
  withdrawnCandidates: CandidateId[];
  /** 사퇴 후보 -> 대표 후보로 이전된 표 (대표 후보 id가 키) */
  unificationTransfers: Partial<Record<CandidateId, number>>;
  /** 현재 대기 중인 단일화 제안. 동시에 1건만 존재할 수 있다 */
  pendingUnificationProposal: UnificationProposal | null;
  /** majorBacker별로 "이번 라운드 단일화 관련 행동을 더 하지 않음" 표시 (스킵 또는 제안 거절됨) */
  unificationDone: Partial<Record<PlayerId, boolean>>;
  /** 수락된 단일화의 공개 조건 계약 (라운드당 최대 1건 — 부록 A-12와 동일한 제약) */
  unificationContract: UnificationContract | null;
  /** §13 투표 정산 후 확정되는 당선 후보 */
  winnerCandidateId: CandidateId | null;
  /** §14 당선 효과 선택 결과. policyResolution이 소비한다 */
  electionEffectResolution: ElectionEffectResolution | null;
  /** roundScoring이 채우는 이번 라운드 획득 VP 스냅샷 — cleanup이 RoundHistoryEntry를 만들 때 소비한다 */
  vpAwardedThisRound: Partial<Record<PlayerId, number>>;
  /** roundScoring이 채우는 이번 라운드 획득 영향력 마커 스냅샷 — cleanup이 RoundHistoryEntry를 만들 때 소비한다 */
  markersAwardedThisRound: Partial<Record<PlayerId, Partial<Record<VoterGroupId, number>>>>;
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
  /** §13 최종 표 (UI 라운드 히스토리 표시용) */
  candidateVotes: Partial<Record<CandidateId, number>>;
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

/** §16 최종 점수 1인분 — 항목 분해(score breakdown) 포함 */
export interface FinalScoreEntry {
  playerId: PlayerId;
  /** 라운드 중 공개 VP 누계 (§16-1) */
  baseVp: number;
  /** 전원 공개되는 비밀 의제 (§16-2) — 게임 종료 시에만 노출 */
  agendaId: AgendaId | null;
  agendaMet: boolean;
  agendaVp: number;
  /** 남은 money 5마다 +1 (§16-3) */
  moneyBonusVp: number;
  /** reputation 단독 1등 +2 (§16-4) */
  reputationBonusVp: number;
  /** 공개 계약 이행 수 단독 1등 +2 (§16-5) — Skill 12 전까지 항상 0 */
  contractBonusVp: number;
  total: number;
  /** §16 동점 처리(v0.3) 반영 후 최종 순위 — 모든 판정 기준이 같으면 공동 순위 */
  rank: number;
}

/** 게임 종료 시 확정되는 최종 결과 (§16) — projectView 마스킹 없이 전원 공개 */
export interface FinalResultSummary {
  entries: FinalScoreEntry[];
  /** 공동 승리 가능 (§16 동점 처리 5단계) */
  winners: PlayerId[];
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
  /** 각 정당의 누적 가치(주가) */
  partyValues: Partial<Record<PartyId, number>>;
  actionLog: ActionLogEntry[];
  roundHistory: RoundHistoryEntry[];
  lastRoundResult: RoundResultSummary | null;
  /** §16 최종 결과 — gameEnd 진입 시 채워지고 그 전에는 null */
  finalResult: FinalResultSummary | null;
  /** 다음에 발급할 ActionLogEntry.seq */
  nextLogSeq: number;
}
