// 기반 스킬: skills/server-rooms/SKILL.md
// projectView(state, viewer) — 부록 A-3 뷰 마스킹.
// 원칙: 비밀 정보는 CSS 숨김이 아니라 **데이터 자체를 보내지 않는다** (CLAUDE.md 아키텍처 원칙 3).
import type { ActionLogEntry, GameState, PlayerId } from '@kingmakers/engine';

/** §12 비밀 pact 관련 액션 로그 타입 — 당사자 외에게는 항목 자체를 제거한다 (부록 A-16) */
const SECRET_PACT_ACTIONS = new Set<ActionLogEntry['action']>(['proposeSecretPact', 'acceptSecretPact', 'declineSecretPact']);

/** 뷰 시점 3종 (§21): table(공개+시스템 진행) / player-{seat}(공개+자기 비밀) / spectator(공개만) */
export type Viewer = { kind: 'table' } | { kind: 'spectator' } | { kind: 'player'; playerId: PlayerId };

const EMPTY_DECKS: GameState['drawPiles'] = {
  candidateDeck: [],
  promiseDeck: [],
  voterDeck: [],
  issueDeck: [],
  candidateEventDeck: [],
  voterEventDeck: [],
  agendaDeck: [],
};

/** 액션 로그 항목이 이 시점(me)과 관련 있는지 — actor 본인이거나, secretPactCounterparty effect의 대상인 경우 */
function involvesViewer(entry: ActionLogEntry, me: PlayerId | null): boolean {
  if (!me) return false;
  if (entry.actor === me) return true;
  return entry.effects.some((e) => e.field === 'secretPactCounterparty' && e.target === me);
}

/**
 * 부록 A-16 마스킹을 actionLog 하나에 대해 적용한다 — projectView(전체 상태 스냅샷)와
 * sockets.ts의 game:log 증분 브로드캐스트가 이 필터를 공유한다. 두 경로가 각자 필터를 따로
 * 구현하면 한쪽만 고쳤을 때 다른 경로로 비밀 로그가 새는 사고가 나기 쉽다(실제로 game:log가
 * 이 필터 없이 원본 로그를 그대로 내보내고 있었다 — CLAUDE.md 원칙 3 위반).
 */
export function filterActionLog(log: ActionLogEntry[], viewer: Viewer): ActionLogEntry[] {
  const me = viewer.kind === 'player' ? viewer.playerId : null;
  return log.filter((entry) => !SECRET_PACT_ACTIONS.has(entry.action) || involvesViewer(entry, me));
}

/**
 * 마스킹 대상 (부록 A-3):
 * - 타인 비밀 의제 (단, gameEnd에서는 §16에 따라 전원 공개)
 * - auctionBidding 중 타인 입찰 내용 — 확정 여부(confirmed)만 남긴다
 * - 타인 이벤트 카드 손패(후보·유권자 이벤트 모두)
 * - 덱 순서·RNG 상태·seed — 다음에 나올 카드를 예측할 수 있으므로 모든 시점에서 제거
 * - 부록 A-16: 당사자 아닌 비밀 pact 제안/활성 pact — 데이터 자체를 제거. 관련 액션 로그 항목도 당사자 외에겐 제거한다
 *   (table/spectator는 애초에 당사자가 될 수 없으므로 항상 전부 제거된다)
 */
export function projectView(state: GameState, viewer: Viewer): GameState {
  const me = viewer.kind === 'player' ? viewer.playerId : null;
  const agendasRevealed = state.phase === 'gameEnd';

  const players = state.players.map((p) => ({
    ...p,
    secretAgendaId: agendasRevealed || p.id === me ? p.secretAgendaId : null,
    candidateEventHand: p.id === me ? p.candidateEventHand : [],
    voterEventHand: p.id === me ? p.voterEventHand : [],
  }));

  const maskBids = state.phase === 'auctionBidding';
  const bids: GameState['round']['bids'] = {};
  for (const [playerId, bid] of Object.entries(state.round.bids)) {
    if (!bid) continue;
    bids[playerId as PlayerId] = !maskBids || playerId === me ? bid : { allocations: {}, confirmed: bid.confirmed };
  }

  const isParty = (p: { proposer: PlayerId; counterparty: PlayerId }) => me != null && (p.proposer === me || p.counterparty === me);
  const pendingSecretPactProposals = state.round.pendingSecretPactProposals.filter(isParty);
  const activeSecretPacts = state.round.activeSecretPacts.filter(isParty);
  const actionLog = filterActionLog(state.actionLog, viewer);

  return {
    ...state,
    seed: 0,
    rngState: 0,
    drawPiles: EMPTY_DECKS,
    players,
    actionLog,
    round: { ...state.round, bids, pendingSecretPactProposals, activeSecretPacts },
  };
}
