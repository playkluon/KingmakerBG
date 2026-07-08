// 기반 스킬: skills/engine-core/SKILL.md
// 엔진 자체 테스트용 공용 fixture. 실제 카드 데이터는 packages/data가 공급하며,
// 엔진은 packages/data를 import하지 않으므로(외부 의존성 0) 테스트는 placeholder ID로 §4 수량을 재현한다.
import { reduce } from '../src/reducer';
import { buildPlaceholderIds, setupGame } from '../src/setup';
import type { CardCatalog } from '../src/types/cards';
import type { AgendaId, CandidateId, PartyId, PlayerId, PromiseId, VoterId } from '../src/types/ids';
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

const PLACEHOLDER_TRACKS = ['economy', 'labor', 'society', 'industry', 'foreign'] as const;
const PLACEHOLDER_GROUPS = ['laborers', 'youth', 'seniors'] as const;

/** 테스트용 정당 7개 id — 실카드와 같은 party-01..party-07 체계 */
export const TEST_PARTIES: PartyId[] = ['party-01', 'party-02', 'party-03', 'party-04', 'party-05', 'party-06', 'party-07'];

/**
 * testDecks()의 placeholder ID 전체에 대응하는 카드 내용을 결정적으로 채운 카탈로그.
 * 통합 테스트(1라운드 완주)처럼 어떤 카드가 뽑히든 내용 조회가 성공해야 하는 시나리오에서 사용한다.
 * 개편안 A(정당 선택→손패)를 통과해야 하므로 후보 21명을 7개 정당에 3명씩 배정하고 정당 카드도 채운다.
 * 실카드 데이터(packages/data)와의 통합은 data 쪽 engineIntegration.test.ts가 검증한다.
 */
export function placeholderCatalog(): CardCatalog {
  const catalog = emptyCatalog();
  catalog.parties = {};
  TEST_PARTIES.forEach((partyId, i) => {
    catalog.parties![partyId] = {
      id: partyId,
      name: `정당${i + 1}`,
      description: '테스트',
      color: '#888888',
      passiveAdvantage: '없음',
      passiveDisadvantage: '없음',
      passives: [],
    };
  });
  buildPlaceholderIds<CandidateId>('candidate', 21).forEach((id, i) => {
    catalog.candidates[id] = {
      id,
      name: `후보${i}`,
      description: '테스트',
      party: TEST_PARTIES[i % 7]!,
      baseVotes: (i % 5) + 2,
      leaningTags: [`성향${i % 3}`],
      supportedVoterGroups: [PLACEHOLDER_GROUPS[i % 3]!],
      electionEffect: { kind: 'fixedPolicyMove', track: PLACEHOLDER_TRACKS[i % 5]!, direction: i % 2 === 0 ? 1 : -1, amount: 1 },
      abilities: [],
    };
  });
  buildPlaceholderIds<PromiseId>('promise', 30).forEach((id, i) => {
    const track = PLACEHOLDER_TRACKS[i % 5]!;
    const direction = i % 2 === 0 ? 1 : (-1 as const);
    catalog.promises[id] = {
      id,
      name: `공약${i}`,
      description: '테스트',
      policyMove: { track, direction, amount: 1 },
      reactionTag: `${track}:${direction}`,
      effect: { kind: 'extraVotes', amount: 1 },
    };
  });
  buildPlaceholderIds<VoterId>('voter', 48).forEach((id, i) => {
    const track = PLACEHOLDER_TRACKS[i % 5]!;
    catalog.voters[id] = {
      id,
      name: `유권자${i}`,
      description: '테스트',
      group: PLACEHOLDER_GROUPS[i % 3]!,
      voteWeight: (i % 3) + 1,
      preferredTag: `${track}:1`,
      conflictTag: `${track}:-1`,
    };
  });
  buildPlaceholderIds<AgendaId>('agenda', 16).forEach((id, i) => {
    catalog.agendas[id] = {
      id,
      name: `의제${i}`,
      description: '테스트',
      condition: { kind: 'remainingMoneyAtLeast', minAmount: 5 },
      points: 8,
    };
  });
  return catalog;
}

/** reduce를 실행하고 실패 시 즉시 throw하는 헬퍼 — fixture 준비 단계 공용 */
function mustReduce(state: GameState, action: Parameters<typeof reduce>[1], catalog: CardCatalog, label: string): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`fixture 준비 실패(${label}): ${result.reason}`);
  return result.state;
}

/**
 * 개편안 A·B: partySelection(전원 정당 선택)과 candidateProposal(전원 후보 1명 제안)을 통과시킨다.
 * 정당은 좌석 순서대로 서로 다른 정당(party-01부터)에 가입시키고, 제안은 손패 첫 장을 낸다 — 전부 결정적.
 */
export function walkThroughPartyAndProposal(state: GameState, catalog: CardCatalog): GameState {
  let current = state;
  if (current.phase === 'partySelection') {
    current.players.forEach((p, i) => {
      current = mustReduce(current, { type: 'selectParty', actor: p.id, partyId: TEST_PARTIES[i % TEST_PARTIES.length]! }, catalog, 'selectParty');
    });
    current = mustReduce(current, { type: 'runUntilPlayerAction' }, catalog, 'partySelection 이후 진행');
  }
  if (current.phase === 'candidateProposal') {
    for (const p of current.players) {
      const hand = current.players.find((x) => x.id === p.id)!.hand;
      if (current.round.proposals[p.id] || hand.length === 0) continue;
      current = mustReduce(current, { type: 'proposeCandidate', actor: p.id, candidateId: hand[0]! }, catalog, 'proposeCandidate');
    }
    current = mustReduce(current, { type: 'runUntilPlayerAction' }, catalog, 'candidateProposal 이후 진행');
  }
  return current;
}

/**
 * startGame 후 정당 선택·후보 제안까지 밟아 auctionBidding에 멈춘 상태를 만든다 (Skill 4+ 테스트 공용).
 * 개편안 A 이후 이 경로는 카드 내용(정당·후보 소속) 조회가 필요해 placeholderCatalog를 사용한다.
 */
export function setupAtAuction(seed: number, playerNames: string[]): GameState {
  const catalog = placeholderCatalog();
  let state = setupGame({ seed, players: playerNames.map((name) => ({ name })), decks: testDecks() });
  state = mustReduce(state, { type: 'startGame' }, catalog, 'startGame');
  state = mustReduce(state, { type: 'runUntilPlayerAction' }, catalog, 'startGame 이후 진행');
  state = walkThroughPartyAndProposal(state, catalog);
  if (state.phase !== 'auctionBidding') throw new Error(`fixture 준비 실패: auctionBidding 진입 (실제 phase=${state.phase})`);
  return state;
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
