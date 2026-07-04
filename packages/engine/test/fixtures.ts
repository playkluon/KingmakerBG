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

/**
 * 정확히 4명이 참여해 campaignActions phase까지 도달한 상태를 만든다 (Skill 5+ 테스트 공용).
 * 6/4/3/2로 서로 다른 후보에 입찰해 순위를 명확히 하고, 공약은 내용 없는 카탈로그로 아무거나 선택한다
 * (공약 즉시 보상은 Skill 4에서 이미 검증됨 — 여기서는 campaignActions 진입 자체가 목적).
 */
export function setupAtCampaign(seed: number, playerNames: [string, string, string, string]): GameState {
  let state = setupAtAuction(seed, playerNames);
  const [c0, c1, c2, c3] = state.round.candidatesRevealed;
  state = bid(state, 'player-0', { [c0!]: 6 });
  state = bid(state, 'player-1', { [c1!]: 4 });
  state = bid(state, 'player-2', { [c2!]: 3 });
  state = bid(state, 'player-3', { [c3!]: 2 });
  state = confirm(state, 'player-0');
  state = confirm(state, 'player-1');
  state = confirm(state, 'player-2');
  state = confirm(state, 'player-3');

  const toPromiseSelection = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
  if (!toPromiseSelection.ok) throw new Error('fixture 준비 실패: promiseSelection 진입');
  state = toPromiseSelection.state;

  for (const candidateId of [...state.round.candidatesRunning]) {
    if (state.phase !== 'promiseSelection') break; // 마지막 선택 직후 자동으로 voterReveal로 넘어갔을 수 있다
    const camp = state.round.camps[candidateId]!;
    if (!camp.majorBacker) continue; // majorBacker 없는 캠프는 autoSelectPromises 몫
    const picked = reduce(
      state,
      { type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! },
      emptyCatalog(),
    );
    if (!picked.ok) throw new Error(`fixture 준비 실패: ${picked.reason}`);
    state = picked.state;
  }
  if (state.phase === 'promiseSelection') {
    // majorBacker 없는 캠프가 남아 있을 때만 필요 — 이미 전원 선택 완료 상태면 호출할 필요도, 자리도 없다
    const autoFilled = reduce(state, { type: 'autoSelectPromises' }, emptyCatalog());
    if (!autoFilled.ok) throw new Error('fixture 준비 실패: autoSelectPromises');
    state = autoFilled.state;
  }

  const toCampaign = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
  if (!toCampaign.ok) throw new Error('fixture 준비 실패: campaignActions 진입');
  return toCampaign.state;
}

/**
 * 정확히 4명이 참여해 unification phase까지 도달한 상태를 만든다 (Skill 6 테스트 공용).
 * 캠페인 액션은 전원 conditionalSupport(비용 없음)로 2회씩 소진해 라운드로빈을 빠르게 끝낸다.
 */
export function setupAtUnification(seed: number, playerNames: [string, string, string, string]): GameState {
  let state = setupAtCampaign(seed, playerNames);
  const candidateId = state.round.candidatesRunning[0]!;
  for (let i = 0; i < 8; i += 1) {
    const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
    const result = reduce(state, { type: 'conditionalSupport', actor, candidateId }, emptyCatalog());
    if (!result.ok) throw new Error(`fixture 준비 실패(conditionalSupport ${actor}): ${result.reason}`);
    state = result.state;
  }
  if (state.phase !== 'unification') throw new Error(`fixture 준비 실패: unification 진입 (실제 phase=${state.phase})`);
  return state;
}
