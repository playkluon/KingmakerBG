// 기반 스킬: skills/voters-campaign/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import type { CardCatalog } from '../src/types/cards';
import type { PlayerId } from '../src/types/ids';
import { emptyCatalog, setupAtCampaign } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

describe('§11 캠페인 액션 — 라운드로빈', () => {
  it('차례가 아닌 플레이어의 액션은 거부된다', () => {
    const state = setupAtCampaign(1, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    // 첫 차례는 player-0 — player-1이 먼저 시도하면 거부되어야 한다
    const result = reduce(state, { type: 'runAd', actor: 'player-1', candidateId }, emptyCatalog());
    expect(result.ok).toBe(false);
  });

  it('플레이어당 정확히 2회 행동하며, 좌석 순으로 두 바퀴 돈다', () => {
    let state = setupAtCampaign(2, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    const order: PlayerId[] = ['player-0', 'player-1', 'player-2', 'player-3', 'player-0', 'player-1', 'player-2', 'player-3'];

    for (const actor of order) {
      expect(state.round.campaignTurnOrder[state.round.campaignActiveIndex]).toBe(actor);
      const result = reduce(state, { type: 'conditionalSupport', actor, candidateId }, emptyCatalog());
      if (!result.ok) throw new Error(`${actor} 실패: ${result.reason}`);
      state = result.state;
    }

    state.players.forEach((p) => expect(state.round.campaignActionsUsed[p.id]).toBe(2));
    // 8번째(마지막) 액션 이후 캠페인이 끝나고 단일화로 넘어간다
    expect(state.phase).toBe('unification');
  });
});

describe('§11 자원 검증', () => {
  it('자금이 부족하면 광고가 거부된다', () => {
    let state = setupAtCampaign(3, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, money: 0 } : p)) };
    const result = reduce(state, { type: 'runAd', actor: 'player-0', candidateId }, emptyCatalog());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('부족');
  });

  it('조직력이 부족하면 접촉이 거부된다', () => {
    let state = setupAtCampaign(4, PLAYERS4);
    const voterId = state.round.votersRevealed[0]!;
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, organization: 0 } : p)) };
    const result = reduce(state, { type: 'contactVoter', actor: 'player-0', voterId }, emptyCatalog());
    expect(result.ok).toBe(false);
  });
});

describe('§11 후보 표 조정 — 광고·스캔들·조건지지', () => {
  it('광고는 +2, 스캔들은 -2, 조건지지는 +1을 campaignVotes에 누적한다', () => {
    let state = setupAtCampaign(5, PLAYERS4);
    const [c0] = state.round.candidatesRunning;

    const ad = reduce(state, { type: 'runAd', actor: 'player-0', candidateId: c0! }, emptyCatalog());
    if (!ad.ok) throw new Error(ad.reason);
    state = ad.state;
    expect(state.round.campaignVotes[c0!]).toBe(2);

    const scandal = reduce(state, { type: 'reportScandal', actor: 'player-1', candidateId: c0! }, emptyCatalog());
    if (!scandal.ok) throw new Error(scandal.reason);
    state = scandal.state;
    expect(state.round.campaignVotes[c0!]).toBe(0);

    const support = reduce(state, { type: 'conditionalSupport', actor: 'player-2', candidateId: c0! }, emptyCatalog());
    if (!support.ok) throw new Error(support.reason);
    state = support.state;
    expect(state.round.campaignVotes[c0!]).toBe(1);
    expect(state.round.conditionalSupporters[c0!]).toEqual(['player-2']);
  });

  it('스캔들 비용(money2+rep1)이 정확히 차감된다', () => {
    let state = setupAtCampaign(6, PLAYERS4);
    const [c0] = state.round.candidatesRunning;
    const before = state.players.find((p) => p.id === 'player-0')!;
    const result = reduce(state, { type: 'reportScandal', actor: 'player-0', candidateId: c0! }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === 'player-0')!;
    expect(after.money).toBe(before.money - 2);
    expect(after.reputation).toBe(before.reputation - 1);
  });
});

describe('§11 압박·모금', () => {
  it('압박은 방향에 맞는 policyPressure를 1 올린다', () => {
    let state = setupAtCampaign(7, PLAYERS4);
    const result = reduce(state, { type: 'pressurePolicy', actor: 'player-0', track: 'economy', direction: 1 }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.round.policyPressure.economy).toEqual({ plus: 1, minus: 0 });
  });

  it('모금은 money +4를 지급하고 reputation 1을 소모한다', () => {
    const state = setupAtCampaign(8, PLAYERS4);
    const before = state.players.find((p) => p.id === 'player-0')!;
    const result = reduce(state, { type: 'fundraise', actor: 'player-0' }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === 'player-0')!;
    expect(after.money).toBe(before.money + 4);
    expect(after.reputation).toBe(before.reputation - 1);
  });
});

describe('§11 MVP 활성 후보 능력', () => {
  it('모금 보너스(fundraiseBonus) 능력을 가진 후보의 majorBacker는 money +5를 받는다', () => {
    const state = setupAtCampaign(9, PLAYERS4);
    const [c0] = state.round.candidatesRunning;
    const majorBacker = state.round.camps[c0!]!.majorBacker!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: '테스트',
          description: '',
          baseVotes: 1,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'flexPolicyMove', amount: 1 },
          abilities: [{ kind: 'fundraiseBonus', amount: 1, active: true }],
        },
      },
    };
    const before = state.players.find((p) => p.id === majorBacker)!;
    const result = reduce(state, { type: 'fundraise', actor: majorBacker }, catalog);
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === majorBacker)!;
    expect(after.money).toBe(before.money + 5);
  });

  it('노동자 접촉 할인(voterContactDiscount) 능력은 조직력 비용을 낮춘다', () => {
    const state = setupAtCampaign(10, PLAYERS4);
    const [c0] = state.round.candidatesRunning;
    const majorBacker = state.round.camps[c0!]!.majorBacker!;
    const voterId = state.round.votersRevealed[0]!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: '테스트',
          description: '',
          baseVotes: 1,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'flexPolicyMove', amount: 1 },
          abilities: [{ kind: 'voterContactDiscount', group: 'laborers', amount: 1, active: true }],
        },
      },
      voters: { [voterId]: { id: voterId, name: 'v', description: '', group: 'laborers', voteWeight: 1, preferredTag: 't', conflictTag: 't2' } },
    };
    const before = state.players.find((p) => p.id === majorBacker)!;
    const result = reduce(state, { type: 'contactVoter', actor: majorBacker, voterId }, catalog);
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === majorBacker)!;
    // 기본 비용 org 1에서 할인 1 -> 0
    expect(after.organization).toBe(before.organization);
  });
});

describe('§29·부록 A-4: poll/useEvent', () => {
  it('poll은 비활성 상태로 거부된다', () => {
    const state = setupAtCampaign(11, PLAYERS4);
    const result = reduce(state, { type: 'poll', actor: 'player-0' }, emptyCatalog());
    expect(result.ok).toBe(false);
  });

  it('useEvent는 손패에 없는 카드면 거부되고, 손패에 있어도 효과 미구현으로 거부된다', () => {
    const state = setupAtCampaign(12, PLAYERS4);
    const notOwned = reduce(state, { type: 'useEvent', actor: 'player-0', eventId: 'event-c-99' as never }, emptyCatalog());
    expect(notOwned.ok).toBe(false);

    const hand = state.players.find((p) => p.id === 'player-0')!.candidateEventHand;
    if (hand.length > 0) {
      const owned = reduce(state, { type: 'useEvent', actor: 'player-0', eventId: hand[0]! }, emptyCatalog());
      expect(owned.ok).toBe(false);
      if (!owned.ok) expect(owned.reason).toContain('구현');
    }
  });
});
