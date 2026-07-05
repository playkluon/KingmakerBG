// 기반 스킬: skills/voters-campaign/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import type { CandidateAbility, CardCatalog, EventCard } from '../src/types/cards';
import type { CandidateId, EventId, PlayerId } from '../src/types/ids';
import { bid, confirm, emptyCatalog, setupAtAuction, setupAtCampaign } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

/** promiseSelection phase에 정확히 멈춘 상태를 만든다 (setupAtCampaign은 그 이후까지 진행해버린다) */
function setupAtPromiseSelection(seed: number) {
  let state = setupAtAuction(seed, PLAYERS4);
  const [c0, c1, c2, c3] = state.round.candidatesRevealed;
  state = bid(state, 'player-0', { [c0!]: 6 });
  state = bid(state, 'player-1', { [c1!]: 4 });
  state = bid(state, 'player-2', { [c2!]: 3 });
  state = bid(state, 'player-3', { [c3!]: 2 });
  state = confirm(state, 'player-0');
  state = confirm(state, 'player-1');
  state = confirm(state, 'player-2');
  state = confirm(state, 'player-3');
  const advanced = reduce(state, { type: 'runUntilPlayerAction' }, emptyCatalog());
  if (!advanced.ok) throw new Error(`fixture 준비 실패: ${advanced.reason}`);
  state = advanced.state;
  if (state.phase !== 'promiseSelection') throw new Error(`fixture 준비 실패: phase=${state.phase}`);
  return state;
}

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

  it('정책 압박 할인(policyPressureDiscount) 능력은 조직력 비용을 낮춘다', () => {
    const state = setupAtCampaign(18, PLAYERS4);
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
          abilities: [{ kind: 'policyPressureDiscount', amount: 1, active: true }],
        },
      },
    };
    const before = state.players.find((p) => p.id === majorBacker)!;
    const result = reduce(state, { type: 'pressurePolicy', actor: majorBacker, track: 'economy', direction: 1 }, catalog);
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === majorBacker)!;
    // 기본 비용 org 2에서 할인 1 -> 1
    expect(after.organization).toBe(before.organization - 1);
  });
});

describe('부록 A-18: promiseRestriction/reputationLossOnPromise (후보 자신의 약점)', () => {
  function candidateWithAbility(id: CandidateId, ability: CandidateAbility) {
    return {
      id,
      name: '테스트',
      description: '',
      baseVotes: 1,
      leaningTags: ['x'],
      supportedVoterGroups: ['laborers' as const],
      electionEffect: { kind: 'flexPolicyMove' as const, amount: 1 },
      abilities: [ability],
    };
  }

  it('promiseRestriction: 제외 태그와 일치하는 공약은 선택이 거부된다', () => {
    const state = setupAtPromiseSelection(19);
    const [c0] = state.round.candidatesRunning;
    const majorBacker = state.round.camps[c0!]!.majorBacker!;
    const promiseId = state.round.camps[c0!]!.promiseOptions[0]!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: { [c0!]: candidateWithAbility(c0!, { kind: 'promiseRestriction', excludedTag: 'economy-1', active: true }) },
      promises: {
        [promiseId]: {
          id: promiseId,
          name: '금지된 공약',
          description: '',
          policyMove: { track: 'economy', direction: 1, amount: 1 },
          reactionTag: 'economy-1',
          effect: { kind: 'extraVotes', amount: 1 },
        },
      },
    };
    const result = reduce(state, { type: 'selectPromise', actor: majorBacker, candidateId: c0!, promiseId }, catalog);
    expect(result.ok).toBe(false);
  });

  it('promiseRestriction: 제외 태그와 다른 공약은 정상적으로 선택된다', () => {
    const state = setupAtPromiseSelection(20);
    const [c0] = state.round.candidatesRunning;
    const majorBacker = state.round.camps[c0!]!.majorBacker!;
    const promiseId = state.round.camps[c0!]!.promiseOptions[0]!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: { [c0!]: candidateWithAbility(c0!, { kind: 'promiseRestriction', excludedTag: 'labor-1', active: true }) },
      promises: {
        [promiseId]: {
          id: promiseId,
          name: '허용된 공약',
          description: '',
          policyMove: { track: 'economy', direction: 1, amount: 1 },
          reactionTag: 'economy-1',
          effect: { kind: 'extraVotes', amount: 1 },
        },
      },
    };
    const result = reduce(state, { type: 'selectPromise', actor: majorBacker, candidateId: c0!, promiseId }, catalog);
    expect(result.ok).toBe(true);
  });

  it('reputationLossOnPromise: 공약 선택 시 평판이 깎인다', () => {
    const state = setupAtPromiseSelection(21);
    const [c0] = state.round.candidatesRunning;
    const majorBacker = state.round.camps[c0!]!.majorBacker!;
    const promiseId = state.round.camps[c0!]!.promiseOptions[0]!;
    const before = state.players.find((p) => p.id === majorBacker)!.reputation;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: { [c0!]: candidateWithAbility(c0!, { kind: 'reputationLossOnPromise', amount: 1, active: true }) },
      promises: {
        [promiseId]: {
          id: promiseId,
          name: '테스트 공약',
          description: '',
          policyMove: { track: 'economy', direction: 1, amount: 1 },
          reactionTag: 'economy-1',
          effect: { kind: 'extraVotes', amount: 1 },
        },
      },
    };
    const result = reduce(state, { type: 'selectPromise', actor: majorBacker, candidateId: c0!, promiseId }, catalog);
    if (!result.ok) throw new Error(result.reason);
    const after = result.state.players.find((p) => p.id === majorBacker)!;
    expect(after.reputation).toBe(before - 1);
  });
});

describe('부록 A-18: poll(여론조사) 활성화', () => {
  it('poll을 실행하면 자금 2를 쓰고 현재 예상 득표가 로그 summary로 공개된다', () => {
    const state = setupAtCampaign(22, PLAYERS4);
    const before = state.players.find((p) => p.id === 'player-0')!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: Object.fromEntries(
        state.round.candidatesRunning.map((id) => [
          id,
          { id, name: `후보-${id}`, description: '', baseVotes: 3, leaningTags: ['x'], supportedVoterGroups: ['laborers' as const], electionEffect: { kind: 'flexPolicyMove' as const, amount: 1 }, abilities: [] },
        ]),
      ),
    };
    const result = reduce(state, { type: 'poll', actor: 'player-0' }, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.state.players.find((p) => p.id === 'player-0')!;
    expect(after.money).toBe(before.money - 2);
    const entry = result.log[0]!;
    for (const id of state.round.candidatesRunning) {
      expect(entry.summary).toContain(`후보-${id}`);
    }
  });
});

function eventCatalogWith(eventId: EventId, effect: EventCard['effect']): CardCatalog {
  return {
    ...emptyCatalog(),
    candidateEvents: { [eventId]: { id: eventId, name: '테스트 이벤트', description: '', category: 'candidate', effect } },
  };
}

describe('부록 A-17: useEvent 이벤트 카드 효과', () => {
  it('보유하지 않은 카드는 거부된다', () => {
    const state = setupAtCampaign(12, PLAYERS4);
    const result = reduce(state, { type: 'useEvent', actor: 'player-0', eventId: 'event-c-99' as EventId }, emptyCatalog());
    expect(result.ok).toBe(false);
  });

  it('resourceDelta: 자원이 변하고 카드가 손패에서 사라진다', () => {
    const eventId = 'event-c-01' as EventId;
    let state = setupAtCampaign(13, PLAYERS4);
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, candidateEventHand: [eventId] } : p)) };
    const moneyBefore = state.players.find((p) => p.id === 'player-0')!.money;
    const catalog = eventCatalogWith(eventId, { kind: 'resourceDelta', resource: 'money', amount: 3 });

    const result = reduce(state, { type: 'useEvent', actor: 'player-0', eventId }, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.state.players.find((p) => p.id === 'player-0')!;
    expect(after.money).toBe(moneyBefore + 3);
    expect(after.candidateEventHand).toHaveLength(0);
  });

  it('candidateVotesDelta: targetCandidateId가 없거나 출마 중이 아니면 거부된다', () => {
    const eventId = 'event-c-02' as EventId;
    let state = setupAtCampaign(14, PLAYERS4);
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, candidateEventHand: [eventId] } : p)) };
    const catalog = eventCatalogWith(eventId, { kind: 'candidateVotesDelta', amount: 2 });

    const noTarget = reduce(state, { type: 'useEvent', actor: 'player-0', eventId }, catalog);
    expect(noTarget.ok).toBe(false);

    const notRunning = reduce(state, { type: 'useEvent', actor: 'player-0', eventId, targetCandidateId: 'candidate-999' as never }, catalog);
    expect(notRunning.ok).toBe(false);
  });

  it('candidateVotesDelta: 지정한 출마 후보의 campaignVotes에 반영된다', () => {
    const eventId = 'event-c-03' as EventId;
    let state = setupAtCampaign(15, PLAYERS4);
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, candidateEventHand: [eventId] } : p)) };
    const candidateId = state.round.candidatesRunning[1]!;
    const before = state.round.campaignVotes[candidateId] ?? 0;
    const catalog = eventCatalogWith(eventId, { kind: 'candidateVotesDelta', amount: -2 });

    const result = reduce(state, { type: 'useEvent', actor: 'player-0', eventId, targetCandidateId: candidateId }, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round.campaignVotes[candidateId]).toBe(before - 2);
  });

  it('groupInfluence: 해당 그룹의 공개된 유권자 전원에게 영향력이 오른다', () => {
    const eventId = 'event-v-01' as EventId;
    let state = setupAtCampaign(16, PLAYERS4);
    state = { ...state, players: state.players.map((p) => (p.id === 'player-0' ? { ...p, voterEventHand: [eventId] } : p)) };
    const voterId = state.round.votersRevealed[0]!;
    const otherVoterId = state.round.votersRevealed[1]!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      voterEvents: { [eventId]: { id: eventId, name: '테스트', description: '', category: 'voter', effect: { kind: 'groupInfluence', group: 'laborers', amount: 3 } } },
      voters: {
        [voterId]: { id: voterId, name: '유권자1', description: '', group: 'laborers', voteWeight: 1, preferredTag: 'x', conflictTag: 'y' },
        [otherVoterId]: { id: otherVoterId, name: '유권자2', description: '', group: 'youth', voteWeight: 1, preferredTag: 'x', conflictTag: 'y' },
      },
    };

    const result = reduce(state, { type: 'useEvent', actor: 'player-0', eventId }, catalog);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round.voterInfluence[voterId]?.['player-0']).toBe(3);
    expect(result.state.round.voterInfluence[otherVoterId]?.['player-0']).toBeUndefined();
    expect(result.state.players.find((p) => p.id === 'player-0')!.voterEventHand).toHaveLength(0);
  });

  it('useEvent는 차례와 무관하게 언제든 가능하다(assignVoterChoice와 동일한 성격)', () => {
    const eventId = 'event-c-04' as EventId;
    let state = setupAtCampaign(17, PLAYERS4);
    const notCurrent = state.players.find((p) => p.id !== state.round.campaignTurnOrder[state.round.campaignActiveIndex])!.id;
    state = { ...state, players: state.players.map((p) => (p.id === notCurrent ? { ...p, candidateEventHand: [eventId] } : p)) };
    const catalog = eventCatalogWith(eventId, { kind: 'resourceDelta', resource: 'organization', amount: 1 });

    const result = reduce(state, { type: 'useEvent', actor: notCurrent, eventId }, catalog);
    expect(result.ok).toBe(true);
  });
});
