// 기반 스킬: skills/auction-promise/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import type { CardCatalog, PromiseCard } from '../src/types/cards';
import type { PromiseId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { bid, confirm, emptyCatalog, setupAtAuction } from './fixtures';

const PLAYERS4 = ['A', 'B', 'C', 'D'];

/** 4인 경매를 확실한 순위(6/4/3)로 정산해 3후보 모두 majorBacker가 있는 promiseSelection 상태를 만든다 */
function setupAtPromiseSelection(seed: number): GameState {
  let state = setupAtAuction(seed, PLAYERS4);
  const [c0, c1, c2] = state.round.candidatesRevealed;
  state = bid(state, 'player-0', { [c0!]: 6 });
  state = bid(state, 'player-1', { [c1!]: 4 });
  state = bid(state, 'player-2', { [c2!]: 3 });
  state = confirm(state, 'player-0');
  state = confirm(state, 'player-1');
  state = confirm(state, 'player-2');
  state = confirm(state, 'player-3'); // 무입찰로 확정 -> 경매 자동 정산 (phase: auctionResolved)

  const advanced = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
  if (!advanced.ok) throw new Error('fixture 준비 실패');
  return advanced.state; // phase: promiseSelection
}

function testPromise(id: PromiseId, effect: PromiseCard['effect']): PromiseCard {
  return {
    id,
    name: `테스트공약-${id}`,
    description: '테스트용',
    policyMove: { track: 'economy', direction: 1, amount: 1 },
    reactionTag: 'economy-market',
    effect,
  };
}

/** camp.promiseOptions를 실제 카드 콘텐츠로 채운 카탈로그를 만든다. options[0]은 backerReward, 나머지는 무관한 효과 */
function catalogFor(promiseOptions: PromiseId[]): CardCatalog {
  const [first, ...rest] = promiseOptions;
  return {
    ...emptyCatalog(),
    promises: {
      [first!]: testPromise(first!, { kind: 'backerReward', resource: 'money', amount: 7 }),
      ...Object.fromEntries(rest.map((id) => [id, testPromise(id, { kind: 'extraVotes', amount: 2 })])),
    },
  };
}

describe('§9 공약 선택 — 제시와 선택', () => {
  it('출마 후보마다 공약 후보 3장이 제시된다', () => {
    const state = setupAtPromiseSelection(1);
    expect(state.phase).toBe('promiseSelection');
    for (const candidateId of state.round.candidatesRunning) {
      expect(state.round.camps[candidateId]!.promiseOptions).toHaveLength(3);
      expect(state.round.camps[candidateId]!.promiseId).toBeNull();
    }
  });

  it('majorBacker가 제시된 공약 중 하나를 선택하면 즉시 보상(backerReward)이 적용된다', () => {
    const state = setupAtPromiseSelection(2);
    const [c0] = state.round.candidatesRunning;
    const camp = state.round.camps[c0!]!;
    const catalog = catalogFor(camp.promiseOptions);
    const before = state.players.find((p) => p.id === camp.majorBacker)!.money;

    const result = reduce(
      state,
      { type: 'selectPromise', actor: camp.majorBacker!, candidateId: c0!, promiseId: camp.promiseOptions[0]! },
      catalog,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.round.camps[c0!]!.promiseId).toBe(camp.promiseOptions[0]);
    const after = result.state.players.find((p) => p.id === camp.majorBacker)!.money;
    expect(after).toBe(before + 7);
  });

  it('한 번 선택한 공약의 보상은 다시 적용되지 않는다 (재선택은 거부된다)', () => {
    const state = setupAtPromiseSelection(3);
    const [c0] = state.round.candidatesRunning;
    const camp = state.round.camps[c0!]!;
    const catalog = catalogFor(camp.promiseOptions);
    const before = state.players.find((p) => p.id === camp.majorBacker)!.money;

    const first = reduce(
      state,
      { type: 'selectPromise', actor: camp.majorBacker!, candidateId: c0!, promiseId: camp.promiseOptions[0]! },
      catalog,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // 보상(+7)은 첫 선택 때 정확히 한 번만 반영된다
    expect(first.state.players.find((p) => p.id === camp.majorBacker)!.money).toBe(before + 7);

    const second = reduce(
      first.state,
      { type: 'selectPromise', actor: camp.majorBacker!, candidateId: c0!, promiseId: camp.promiseOptions[1]! },
      catalog,
    );
    expect(second.ok).toBe(false);
  });

  it('주요 후원자가 아닌 플레이어의 선택은 거부된다', () => {
    const state = setupAtPromiseSelection(4);
    const [c0] = state.round.candidatesRunning;
    const camp = state.round.camps[c0!]!;
    const impostor = state.players.find((p) => p.id !== camp.majorBacker)!.id;
    const catalog = catalogFor(camp.promiseOptions);
    const result = reduce(state, { type: 'selectPromise', actor: impostor, candidateId: c0!, promiseId: camp.promiseOptions[0]! }, catalog);
    expect(result.ok).toBe(false);
  });

  it('제시되지 않은 공약은 선택할 수 없다', () => {
    const state = setupAtPromiseSelection(5);
    const [c0] = state.round.candidatesRunning;
    const camp = state.round.camps[c0!]!;
    const result = reduce(
      state,
      { type: 'selectPromise', actor: camp.majorBacker!, candidateId: c0!, promiseId: 'promise-없음' as PromiseId },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('출마 후보 전원의 공약이 확정되면 유권자 공개 단계로 자동 진행한다', () => {
    let state = setupAtPromiseSelection(6);
    for (const candidateId of [...state.round.candidatesRunning]) {
      const camp = state.round.camps[candidateId]!;
      const catalog = catalogFor(camp.promiseOptions);
      const result = reduce(
        state,
        { type: 'selectPromise', actor: camp.majorBacker!, candidateId, promiseId: camp.promiseOptions[0]! },
        catalog,
      );
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    // 마지막 선택이 끝나는 즉시 다음 phase(voterReveal)로 넘어간다 (confirmAuctionBids -> auctionResolved와 같은 패턴)
    expect(state.phase).toBe('voterReveal');
    const advanced = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
    expect(advanced.ok).toBe(true);
    if (advanced.ok) {
      // voterReveal의 실제 유권자 공개는 Skill 5(voters-campaign)의 몫이다 — 여기서는
      // promiseSelection을 벗어나 다음 결정 지점(campaignActions)까지 phase가 정확히 흘러가는지만 확인한다.
      expect(advanced.state.phase).toBe('campaignActions');
    }
  });
});

describe('§9 majorBacker 없는 후보 — autoSelectPromises fallback', () => {
  it('입찰자가 부족해 후원자 없이 출마한 후보는 majorBacker가 null이고, autoSelectPromises가 대신 공약을 고른다', () => {
    // player-0/1만 서로 다른 후보에 입찰하고 나머지는 무입찰 -> 3번째 출마 후보는 후원자가 0명
    let state = setupAtAuction(7, PLAYERS4);
    const [c0, c1] = state.round.candidatesRevealed;
    state = bid(state, 'player-0', { [c0!]: 3 });
    state = bid(state, 'player-1', { [c1!]: 2 });
    state = confirm(state, 'player-0');
    state = confirm(state, 'player-1');
    state = confirm(state, 'player-2');
    state = confirm(state, 'player-3');

    const advanced = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
    if (!advanced.ok) throw new Error('fixture 준비 실패');
    state = advanced.state;
    expect(state.phase).toBe('promiseSelection');

    const orphanId = state.round.candidatesRunning.find((id) => state.round.camps[id]!.majorBacker === null);
    expect(orphanId).toBeDefined();
    const humanCamps = state.round.candidatesRunning.filter((id) => id !== orphanId);
    expect(humanCamps).toHaveLength(2);

    const autoResult = reduce(state, { type: 'autoSelectPromises' }, emptyCatalog());
    expect(autoResult.ok).toBe(true);
    if (!autoResult.ok) return;

    expect(autoResult.state.round.camps[orphanId!]!.promiseId).not.toBeNull();
    // majorBacker가 있는 나머지 두 후보는 자동 선택 대상이 아니다
    humanCamps.forEach((id) => expect(autoResult.state.round.camps[id]!.promiseId).toBeNull());
    // 아직 사람 majorBacker 2명이 선택하지 않았으므로 phase는 그대로다
    expect(autoResult.state.phase).toBe('promiseSelection');
  });
});
