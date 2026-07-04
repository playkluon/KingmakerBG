// 기반 스킬: skills/engine-core/SKILL.md
// 엔진 자체 테스트용 공용 fixture. 실제 카드 데이터는 packages/data가 공급하며,
// 엔진은 packages/data를 import하지 않으므로(외부 의존성 0) 테스트는 placeholder ID로 §4 수량을 재현한다.
import { reduce } from '../src/reducer';
import { buildPlaceholderIds, setupGame } from '../src/setup';
import type { CardCatalog } from '../src/types/cards';
import type { CandidateId, PlayerId } from '../src/types/ids';
import type { DrawPiles, GameState } from '../src/types/state';

/** §4 카드 수량(21/30/48/15/30/30/16)을 그대로 따르는 placeholder 덱 */
export function testDecks(): DrawPiles {
  return {
    candidateDeck: buildPlaceholderIds('candidate', 21),
    promiseDeck: buildPlaceholderIds('promise', 30),
    voterDeck: buildPlaceholderIds('voter', 48),
    issueDeck: buildPlaceholderIds('issue', 15),
    candidateEventDeck: buildPlaceholderIds('event-c', 30),
    voterEventDeck: buildPlaceholderIds('event-v', 30),
    agendaDeck: buildPlaceholderIds('agenda', 16),
  };
}

/** 카드 내용이 필요 없는 테스트(§28 phase 머신·결정성 검증)용 빈 카탈로그 */
export function emptyCatalog(): CardCatalog {
  return { candidates: {}, promises: {}, voters: {}, issues: {}, candidateEvents: {}, voterEvents: {}, agendas: {} };
}

/** startGame 후 자동 진행 가능한 phase를 끝까지 밟아 auctionBidding에 멈춘 상태를 만든다 (Skill 4+ 테스트 공용) */
export function setupAtAuction(seed: number, playerNames: string[]): GameState {
  const state = setupGame({ seed, players: playerNames.map((name) => ({ name })), decks: testDecks() });
  const started = reduce(state, { type: 'startGame' }, emptyCatalog());
  if (!started.ok) throw new Error(`fixture 준비 실패: ${started.reason}`);
  const advanced = reduce(started.state, { type: 'runUntilPlayerAction' }, emptyCatalog());
  if (!advanced.ok) throw new Error('fixture 준비 실패: runUntilPlayerAction');
  return advanced.state;
}

/** placeBid를 실행하고 결과 상태를 반환한다. 실패하면 테스트를 즉시 실패시킨다 */
export function bid(state: GameState, actor: PlayerId, allocations: Partial<Record<CandidateId, number>>): GameState {
  const result = reduce(state, { type: 'placeBid', actor, allocations }, emptyCatalog());
  if (!result.ok) throw new Error(`입찰 실패(${actor}): ${result.reason}`);
  return result.state;
}

/** confirmAuctionBids를 실행하고 결과 상태를 반환한다. 전원 확정 시 경매가 자동 정산된다 */
export function confirm(state: GameState, actor: PlayerId): GameState {
  const result = reduce(state, { type: 'confirmAuctionBids', actor }, emptyCatalog());
  if (!result.ok) throw new Error(`확정 실패(${actor}): ${result.reason}`);
  return result.state;
}
