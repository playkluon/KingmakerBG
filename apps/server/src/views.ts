// 기반 스킬: skills/server-rooms/SKILL.md
// projectView(state, viewer) — 부록 A-3 뷰 마스킹.
// 원칙: 비밀 정보는 CSS 숨김이 아니라 **데이터 자체를 보내지 않는다** (CLAUDE.md 아키텍처 원칙 3).
import type { GameState, PlayerId } from '@kingmakers/engine';

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

/**
 * 마스킹 대상 (부록 A-3):
 * - 타인 비밀 의제 (단, gameEnd에서는 §16에 따라 전원 공개)
 * - auctionBidding 중 타인 입찰 내용 — 확정 여부(confirmed)만 남긴다
 * - 타인 이벤트 카드 손패
 * - 덱 순서·RNG 상태·seed — 다음에 나올 카드를 예측할 수 있으므로 모든 시점에서 제거
 */
export function projectView(state: GameState, viewer: Viewer): GameState {
  const me = viewer.kind === 'player' ? viewer.playerId : null;
  const agendasRevealed = state.phase === 'gameEnd';

  const players = state.players.map((p) => ({
    ...p,
    secretAgendaId: agendasRevealed || p.id === me ? p.secretAgendaId : null,
    candidateEventHand: p.id === me ? p.candidateEventHand : [],
  }));

  const maskBids = state.phase === 'auctionBidding';
  const bids: GameState['round']['bids'] = {};
  for (const [playerId, bid] of Object.entries(state.round.bids)) {
    if (!bid) continue;
    bids[playerId as PlayerId] = !maskBids || playerId === me ? bid : { allocations: {}, confirmed: bid.confirmed };
  }

  return {
    ...state,
    seed: 0,
    rngState: 0,
    drawPiles: EMPTY_DECKS,
    players,
    round: { ...state.round, bids },
  };
}
