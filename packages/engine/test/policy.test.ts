// 기반 스킬: skills/unification-voting/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { POLICY_TRACK_MAX } from '../src/constants';
import type { CardCatalog, PromiseCard } from '../src/types/cards';
import type { PlayerId, PromiseId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { emptyCatalog, setupAtUnification } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

function promise(id: PromiseId, track: 'economy' | 'labor', direction: 1 | -1, amount = 1): PromiseCard {
  return { id, name: id, description: '', policyMove: { track, direction, amount }, reactionTag: `${track}-${direction}`, effect: { kind: 'extraVotes', amount: 0 } };
}

/** unification을 스킵하고 voting까지 진행한 상태를 만든다 */
function toVoting(state: GameState): GameState {
  const majorBackers = new Set(
    state.round.candidatesRunning.map((id) => state.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null),
  );
  let next = state;
  for (const actor of majorBackers) {
    const result = reduce(next, { type: 'skipUnification', actor }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    next = result.state;
  }
  return next;
}

describe('§14 정책 변화 — 당선 공약·당선 효과', () => {
  it('당선 공약의 정책 이동이 반영된다', () => {
    let state = setupAtUnification(1, PLAYERS4);
    state = toVoting(state);
    const [c0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[c0!]!.promiseId!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: c0!,
          description: '',
          baseVotes: 100,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'flexPolicyMove', amount: 0 }, // 당선 효과는 0으로 둬서 공약 이동만 관찰
          abilities: [],
        },
      },
      promises: { [promiseId]: promise(promiseId, 'economy', 1) },
    };
    const voted = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!voted.ok) throw new Error(voted.reason);
    expect(voted.state.phase).toBe('electionEffectSelection'); // flexPolicyMove는 선택 대기(majorBacker 있음)

    const majorBacker = voted.state.round.camps[c0!]!.majorBacker!;
    const picked = reduce(voted.state, { type: 'selectElectionPolicyMove', actor: majorBacker, track: 'economy', direction: 1 }, catalog);
    if (!picked.ok) throw new Error(picked.reason);
    expect(picked.state.phase).toBe('policyResolution');

    const resolved = reduce(picked.state, { type: 'resolvePolicy' }, catalog);
    if (!resolved.ok) throw new Error(resolved.reason);
    // 공약(+1) + 당선효과(0, direction만 선택했지만 amount=0) = 총 +1
    expect(resolved.state.policyTracks.economy).toBe(1);
  });

  it('winningPromisePolicyMove는 당선 공약 이동을 repeat회 추가 반복한다', () => {
    let state = setupAtUnification(2, PLAYERS4);
    state = toVoting(state);
    const [c0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[c0!]!.promiseId!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: c0!,
          description: '',
          baseVotes: 100,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'winningPromisePolicyMove', repeat: 2 },
          abilities: [],
        },
      },
      promises: { [promiseId]: promise(promiseId, 'labor', -1) },
    };
    const voted = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!voted.ok) throw new Error(voted.reason);
    expect(voted.state.phase).toBe('policyResolution'); // 선택 불필요 — 즉시 확정

    const resolved = reduce(voted.state, { type: 'resolvePolicy' }, catalog);
    if (!resolved.ok) throw new Error(resolved.reason);
    // 공약 자체 1회 + repeat 2회 = 총 -3, 클램프(-2..2)로 -2에서 멈춘다
    expect(resolved.state.policyTracks.labor).toBe(-2);
  });

  it('정책 트랙은 -2..2를 벗어나지 않는다', () => {
    let state = setupAtUnification(3, PLAYERS4);
    state = { ...state, policyTracks: { ...state.policyTracks, economy: POLICY_TRACK_MAX } };
    state = toVoting(state);
    const [c0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[c0!]!.promiseId!;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: c0!,
          description: '',
          baseVotes: 100,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'fixedPolicyMove', track: 'economy', direction: 1, amount: 5 },
          abilities: [],
        },
      },
      promises: { [promiseId]: promise(promiseId, 'economy', 1) },
    };
    const voted = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!voted.ok) throw new Error(voted.reason);
    const resolved = reduce(voted.state, { type: 'resolvePolicy' }, catalog);
    if (!resolved.ok) throw new Error(resolved.reason);
    expect(resolved.state.policyTracks.economy).toBe(POLICY_TRACK_MAX);
  });
});

describe('§6 정책 압박 비교', () => {
  it('차이가 큰 트랙부터 최대 2개만 반영한다', () => {
    let state = setupAtUnification(4, PLAYERS4);
    state = toVoting(state);
    const [c0] = state.round.candidatesRunning;
    const promiseId = state.round.camps[c0!]!.promiseId!;
    // 당선 공약·당선 효과는 foreign 트랙에 0만큼만 움직이도록 두어 압박 비교와 간섭하지 않게 한다
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          id: c0!,
          name: c0!,
          description: '',
          baseVotes: 100,
          leaningTags: ['x'],
          supportedVoterGroups: ['laborers'],
          electionEffect: { kind: 'fixedPolicyMove', track: 'foreign', direction: 1, amount: 0 },
          abilities: [],
        },
      },
      promises: { [promiseId]: promise(promiseId, 'labor', 1, 0) },
    };
    const voted = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!voted.ok) throw new Error(voted.reason);
    expect(voted.state.phase).toBe('policyResolution');

    const withPressure: GameState = {
      ...voted.state,
      round: {
        ...voted.state.round,
        policyPressure: {
          economy: { plus: 5, minus: 0 }, // 차이 5 (1순위)
          labor: { plus: 0, minus: 3 }, // 차이 3 (2순위)
          society: { plus: 2, minus: 1 }, // 차이 1 (3순위 — 반영 안 됨)
          industry: { plus: 0, minus: 0 },
          foreign: { plus: 0, minus: 0 },
        },
      },
    };
    const resolved = reduce(withPressure, { type: 'resolvePolicy' }, catalog);
    if (!resolved.ok) throw new Error(resolved.reason);
    expect(resolved.state.policyTracks.economy).toBe(1);
    expect(resolved.state.policyTracks.labor).toBe(-1);
    expect(resolved.state.policyTracks.society).toBe(0); // 3순위라 반영되지 않음
  });
});
