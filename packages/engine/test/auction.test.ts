// 기반 스킬: skills/auction-promise/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { INCOME_MONEY, STARTING_MONEY } from '../src/constants';
import { bid, confirm, emptyCatalog, placeholderCatalog, setupAtAuction } from './fixtures';
import type { PromiseId } from '../src/types/ids';

const PLAYERS4 = ['A', 'B', 'C', 'D'];
// setupAtAuction은 income phase(§5: money +5)를 거친 뒤 경매 단계에 도달하므로,
// 경매 시작 시점의 실제 자금은 STARTING_MONEY가 아니라 이 값이다.
const AUCTION_MONEY = STARTING_MONEY + INCOME_MONEY;

describe('§8 후보 경매 — 출마 확정', () => {
  it('총 입찰액 상위 3명이 출마하고, 전원 확정 시 자동으로 정산된다', () => {
    let state = setupAtAuction(1, PLAYERS4);
    const [c0, c1, c2, c3, c4] = state.round.candidatesRevealed;

    state = bid(state, 'player-0', { [c0!]: 5 });
    state = bid(state, 'player-1', { [c1!]: 4 });
    state = bid(state, 'player-2', { [c2!]: 3 });
    state = bid(state, 'player-3', { [c3!]: 1 }); // 4번째로 낮은 입찰 -> 낙선 예정

    state = confirm(state, 'player-0');
    state = confirm(state, 'player-1');
    state = confirm(state, 'player-2');
    state = confirm(state, 'player-3'); // 마지막 확정 -> resolveAuction 자동 실행

    expect(state.phase).toBe('auctionResolved');
    expect(state.round.candidatesRunning).toEqual([c0, c1, c2]);
    expect(state.round.candidatesRunning).not.toContain(c3);
    expect(state.round.candidatesRunning).not.toContain(c4);
  });

  it('출마 후보 입찰금은 전액 소비되고, 낙선 후보 입찰금은 절반(내림) 환급된다', () => {
    // 동점을 피하려고 4개 후보에 전부 다른 금액을 걸어 순위를 명확히 한다 (동점 처리는 별도 테스트가 검증)
    let state = setupAtAuction(2, PLAYERS4);
    const [c0, c1, c2, c3] = state.round.candidatesRevealed;

    state = bid(state, 'player-0', { [c0!]: 6 });
    state = bid(state, 'player-1', { [c1!]: 4 });
    state = bid(state, 'player-2', { [c2!]: 3 });
    state = bid(state, 'player-3', { [c3!]: 2 }); // 4위 -> 낙선

    state = confirm(state, 'player-0');
    state = confirm(state, 'player-1');
    state = confirm(state, 'player-2');
    state = confirm(state, 'player-3');

    expect(state.round.candidatesRunning).toEqual([c0, c1, c2]);

    const money = (id: string) => state.players.find((p) => p.id === id)!.money;
    expect(money('player-0')).toBe(AUCTION_MONEY - 6); // 출마: 전액 소비
    expect(money('player-1')).toBe(AUCTION_MONEY - 4);
    expect(money('player-2')).toBe(AUCTION_MONEY - 3);
    // 낙선: 2 걸었으면 floor(2/2)=1 환급 -> 실제 비용 1
    expect(money('player-3')).toBe(AUCTION_MONEY - 1);
  });

  it('경매 동점 처리가 결정적이다 (같은 seed·같은 입찰 재생 시 같은 결과)', () => {
    const run = () => {
      let state = setupAtAuction(3, PLAYERS4);
      const [c0, c1] = state.round.candidatesRevealed;
      state = bid(state, 'player-0', { [c0!]: 2 });
      state = bid(state, 'player-1', { [c1!]: 2 }); // 동점 유발
      state = confirm(state, 'player-0');
      state = confirm(state, 'player-1');
      state = confirm(state, 'player-2');
      state = confirm(state, 'player-3');
      return state.round.candidatesRunning;
    };
    expect(run()).toEqual(run());
  });
});

describe('§8 캠프 슬롯 배정', () => {
  it('majorBacker(최고 입찰자)·coBacker(2 money 이상 차순위)가 정확히 배정된다', () => {
    let state = setupAtAuction(4, PLAYERS4);
    const [c0] = state.round.candidatesRevealed;

    state = bid(state, 'player-0', { [c0!]: 5 });
    state = bid(state, 'player-1', { [c0!]: 3 });
    state = bid(state, 'player-2', { [c0!]: 1 }); // 2 미만 -> coBacker 자격 없음
    state = bid(state, 'player-3', {});

    state = confirm(state, 'player-0');
    state = confirm(state, 'player-1');
    state = confirm(state, 'player-2');
    state = confirm(state, 'player-3');

    const camp = state.round.camps[c0!]!;
    expect(camp.majorBacker).toBe('player-0');
    expect(camp.coBacker).toBe('player-1');
    // 4인 게임은 organizer 슬롯 자체가 없다 (§3)
    expect(camp.organizer).toBeNull();
  });

  it('4-5인 게임에서는 3순위 후원자가 있어도 organizer가 배정되지 않는다', () => {
    let state = setupAtAuction(5, PLAYERS4);
    const [c0] = state.round.candidatesRevealed;
    state = bid(state, 'player-0', { [c0!]: 5 });
    state = bid(state, 'player-1', { [c0!]: 4 });
    state = bid(state, 'player-2', { [c0!]: 3 });
    state = bid(state, 'player-3', {});
    state = confirm(state, 'player-0');
    state = confirm(state, 'player-1');
    state = confirm(state, 'player-2');
    state = confirm(state, 'player-3');

    expect(state.round.camps[c0!]!.organizer).toBeNull();
  });

  it('6인 게임에서는 organizer(3순위, 2 money 이상)가 배정된다', () => {
    const players6 = ['A', 'B', 'C', 'D', 'E', 'F'];
    let state = setupAtAuction(6, players6);
    const [c0] = state.round.candidatesRevealed;
    state = bid(state, 'player-0', { [c0!]: 6 });
    state = bid(state, 'player-1', { [c0!]: 5 });
    state = bid(state, 'player-2', { [c0!]: 2 });
    const actors6 = ['player-0', 'player-1', 'player-2', 'player-3', 'player-4', 'player-5'] as const;
    for (const actor of actors6) {
      state = confirm(state, actor);
    }
    const camp = state.round.camps[c0!]!;
    expect(camp.majorBacker).toBe('player-0');
    expect(camp.coBacker).toBe('player-1');
    expect(camp.organizer).toBe('player-2');
  });
});

describe('부록 A-20: 공약 옵션 draw 시 promiseRestriction(후보 약점) 회피', () => {
  it('제시된 3장이 전부 약점 계열이어도 배제하고 다음 카드로 채우며, 배제된 카드는 덱 아래로 돌아간다', () => {
    let state = setupAtAuction(10, PLAYERS4);
    const [c0, c1, c2, c3] = state.round.candidatesRevealed;

    // placeholderCatalog는 30장을 10개 태그(트랙×방향)로 3장씩 배정한다 — i=1,11,21이 전부 'labor:-1'
    const restrictedIds: PromiseId[] = ['promise-1', 'promise-11', 'promise-21'];
    const rest = state.drawPiles.promiseDeck.filter((id) => !restrictedIds.includes(id));
    state = { ...state, drawPiles: { ...state.drawPiles, promiseDeck: [...restrictedIds, ...rest] } };

    const catalog = placeholderCatalog();
    catalog.candidates[c0!] = {
      ...catalog.candidates[c0!]!,
      abilities: [{ kind: 'promiseRestriction', excludedTag: 'labor:-1', active: true }],
    };

    const applyBid = (s: typeof state, actor: string, target: string, amount: number) => {
      const r = reduce(s, { type: 'placeBid', actor: actor as never, allocations: { [target]: amount } as never }, catalog);
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };
    const applyConfirm = (s: typeof state, actor: string) => {
      const r = reduce(s, { type: 'confirmAuctionBids', actor: actor as never }, catalog);
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };

    state = applyBid(state, 'player-0', c0!, 5);
    state = applyBid(state, 'player-1', c1!, 4);
    state = applyBid(state, 'player-2', c2!, 3);
    state = applyBid(state, 'player-3', c3!, 1);
    state = applyConfirm(state, 'player-0');
    state = applyConfirm(state, 'player-1');
    state = applyConfirm(state, 'player-2');
    state = applyConfirm(state, 'player-3');

    const camp = state.round.camps[c0!]!;
    expect(camp.promiseOptions).toHaveLength(3);
    for (const id of camp.promiseOptions) {
      expect(catalog.promises[id]!.reactionTag).not.toBe('labor:-1');
    }
    // 배제된 3장은 사라지지 않고 덱 맨 아래로 이동해 재사용 가능하다
    for (const id of restrictedIds) {
      expect(state.drawPiles.promiseDeck).toContain(id);
    }
  });
});

describe('placeBid 검증', () => {
  it('보유 자금을 초과하는 입찰은 거부된다', () => {
    const state = setupAtAuction(7, PLAYERS4);
    const [c0] = state.round.candidatesRevealed;
    const result = reduce(
      state,
      { type: 'placeBid', actor: 'player-0', allocations: { [c0!]: AUCTION_MONEY + 1 } },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('공개되지 않은 후보에는 입찰할 수 없다', () => {
    const state = setupAtAuction(8, PLAYERS4);
    const result = reduce(
      state,
      { type: 'placeBid', actor: 'player-0', allocations: { 'candidate-없음': 1 } as never },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('입찰을 확정한 뒤에는 재제출할 수 없다', () => {
    let state = setupAtAuction(9, PLAYERS4);
    const [c0] = state.round.candidatesRevealed;
    state = bid(state, 'player-0', { [c0!]: 1 });
    state = confirm(state, 'player-0');
    const result = reduce(state, { type: 'placeBid', actor: 'player-0', allocations: {} }, emptyCatalog());
    expect(result.ok).toBe(false);
  });
});
