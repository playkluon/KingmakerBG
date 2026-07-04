// 기반 스킬: skills/voters-campaign/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { computeVoterVotes, getVoterController } from '../src/rules/voters';
import type { CardCatalog, PromiseCard, VoterCard } from '../src/types/cards';
import type { GameState } from '../src/types/state';
import { emptyCatalog, setupAtCampaign } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

describe('§7 유권자 공개', () => {
  it('4인 기준 인원별 공개 수(5명)만큼 공개되고 캠페인 라운드로빈이 좌석 순으로 초기화된다', () => {
    const state = setupAtCampaign(1, PLAYERS4);
    expect(state.phase).toBe('campaignActions');
    expect(state.round.votersRevealed).toHaveLength(5);
    expect(state.round.campaignTurnOrder).toEqual(['player-0', 'player-1', 'player-2', 'player-3']);
    expect(state.round.campaignActiveIndex).toBe(0);
  });
});

describe('§10 유권자 통제 판정', () => {
  it('영향력이 단독 최고인 플레이어만 controller다', () => {
    const influence = { 'voter-01': { 'player-0': 4, 'player-1': 2 } } as GameState['round']['voterInfluence'];
    expect(getVoterController(influence, 'voter-01' as never)).toBe('player-0');
  });

  it('공동 1위면 controller가 없다', () => {
    const influence = { 'voter-01': { 'player-0': 3, 'player-1': 3 } } as GameState['round']['voterInfluence'];
    expect(getVoterController(influence, 'voter-01' as never)).toBeNull();
  });

  it('영향력이 전부 0이거나 없으면 controller가 없다', () => {
    expect(getVoterController({}, 'voter-01' as never)).toBeNull();
  });
});

describe('§10 배치(assignVoterChoice)', () => {
  it('단독 controller만 배치할 수 있고, 배치는 액션을 소모하지 않는다', () => {
    let state = setupAtCampaign(2, PLAYERS4);
    const voterId = state.round.votersRevealed[0]!;
    const candidateId = state.round.candidatesRunning[0]!;

    // player-0이 접촉으로 단독 controller가 된다 (액션 1/2 소모)
    const contact = reduce(state, { type: 'contactVoter', actor: 'player-0', voterId }, emptyCatalog());
    if (!contact.ok) throw new Error(contact.reason);
    state = contact.state;
    expect(state.round.campaignActionsUsed['player-0']).toBe(1);

    // 다음 차례는 player-1이므로, player-0의 배치는 "차례가 아니어도" 되는 무료 보조 권한이어야 한다
    expect(state.round.campaignTurnOrder[state.round.campaignActiveIndex]).toBe('player-1');
    const assign = reduce(state, { type: 'assignVoterChoice', actor: 'player-0', voterId, candidateId }, emptyCatalog());
    expect(assign.ok).toBe(true);
    if (assign.ok) {
      expect(assign.state.round.voterAssignments[voterId]).toBe(candidateId);
      // 액션 소모 카운트는 그대로다 (무료)
      expect(assign.state.round.campaignActionsUsed['player-0']).toBe(1);
      expect(assign.state.round.campaignActiveIndex).toBe(state.round.campaignActiveIndex);
    }
  });

  it('단독으로 통제하지 않는 유권자는 배치할 수 없다', () => {
    const state = setupAtCampaign(3, PLAYERS4);
    const voterId = state.round.votersRevealed[0]!;
    const candidateId = state.round.candidatesRunning[0]!;
    const result = reduce(state, { type: 'assignVoterChoice', actor: 'player-0', voterId, candidateId }, emptyCatalog());
    expect(result.ok).toBe(false);
  });

  it('재배치하면 마지막 배치가 적용된다', () => {
    let state = setupAtCampaign(4, PLAYERS4);
    const voterId = state.round.votersRevealed[0]!;
    const [cand0, cand1] = state.round.candidatesRunning;

    const contact = reduce(state, { type: 'contactVoter', actor: 'player-0', voterId }, emptyCatalog());
    if (!contact.ok) throw new Error(contact.reason);
    state = contact.state;

    const first = reduce(state, { type: 'assignVoterChoice', actor: 'player-0', voterId, candidateId: cand0! }, emptyCatalog());
    if (!first.ok) throw new Error(first.reason);
    const second = reduce(first.state, { type: 'assignVoterChoice', actor: 'player-0', voterId, candidateId: cand1! }, emptyCatalog());
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.state.round.voterAssignments[voterId]).toBe(cand1);
    }
  });
});

describe('§10 자동 투표 집계 (computeVoterVotes)', () => {
  const track = 'labor' as const;

  function promise(id: string, reactionTag: string): PromiseCard {
    return { id: id as never, name: id, description: '', policyMove: { track, direction: -1, amount: 1 }, reactionTag, effect: { kind: 'extraVotes', amount: 0 } };
  }
  function voter(id: string, preferredTag: string, conflictTag: string, dislikedTag: string | undefined, voteWeight: number): VoterCard {
    return { id: id as never, name: id, description: '', group: 'laborers', voteWeight, preferredTag, conflictTag, dislikedTag };
  }

  function baseState(): GameState {
    let state = setupAtCampaign(5, PLAYERS4);
    // 캠프 공약을 태그 있는 값으로 갈아끼운다 (fixture는 emptyCatalog로 선택했으므로 promiseId만 있고 태그는 카탈로그에서 조회)
    return state;
  }

  it('배치된 유권자는 선호 태그가 맞으면 voteWeight 그대로 지지한다', () => {
    const state = baseState();
    const [cand0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[cand0!]!.promiseId!;
    const voterId = state.round.votersRevealed[0]!;

    const catalog: CardCatalog = {
      ...emptyCatalog(),
      promises: { [promiseId]: promise(promiseId, 'labor-workerRights') },
      voters: { [voterId]: voter(voterId, 'labor-workerRights', 'labor-corporate', undefined, 3) },
    };
    const assigned: GameState = { ...state, round: { ...state.round, voterAssignments: { [voterId]: cand0! } } };
    const votes = computeVoterVotes(assigned, catalog);
    expect(votes[cand0!]).toBe(3);
  });

  it('배치된 유권자가 직접 충돌 태그와 맞으면 0표로 클램프된다 (voteWeight*-2를 0 미만으로 두지 않음)', () => {
    const state = baseState();
    const [cand0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[cand0!]!.promiseId!;
    const voterId = state.round.votersRevealed[0]!;

    const catalog: CardCatalog = {
      ...emptyCatalog(),
      promises: { [promiseId]: promise(promiseId, 'labor-corporate') },
      voters: { [voterId]: voter(voterId, 'labor-workerRights', 'labor-corporate', undefined, 3) },
    };
    const assigned: GameState = { ...state, round: { ...state.round, voterAssignments: { [voterId]: cand0! } } };
    const votes = computeVoterVotes(assigned, catalog);
    expect(votes[cand0!] ?? 0).toBe(0);
  });

  it('미배치 유권자는 선호 태그가 일치하는 출마 후보를 찾아 전액 지지한다', () => {
    const state = baseState();
    const [cand0, cand1] = state.round.candidatesRunning;
    const promiseId0 = state.round.camps[cand0!]!.promiseId!;
    const promiseId1 = state.round.camps[cand1!]!.promiseId!;
    const voterId = state.round.votersRevealed[0]!;

    const catalog: CardCatalog = {
      ...emptyCatalog(),
      promises: {
        [promiseId0]: promise(promiseId0, 'labor-corporate'),
        [promiseId1]: promise(promiseId1, 'labor-workerRights'),
      },
      voters: { [voterId]: voter(voterId, 'labor-workerRights', 'labor-corporate', undefined, 2) },
    };
    const votes = computeVoterVotes(state, catalog);
    expect(votes[cand1!]).toBe(2);
    expect(votes[cand0!] ?? 0).toBe(0);
  });

  it('미배치 유권자는 선호와 일치하는 후보가 없으면 기권한다', () => {
    const state = baseState();
    const voterId = state.round.votersRevealed[0]!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      voters: { [voterId]: voter(voterId, 'labor-workerRights', 'labor-corporate', undefined, 2) },
    };
    const votes = computeVoterVotes(state, catalog);
    expect(Object.values(votes).reduce((a: number, b) => a + (b ?? 0), 0)).toBe(0);
  });
});
