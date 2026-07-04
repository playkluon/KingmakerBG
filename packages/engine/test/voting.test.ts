// 기반 스킬: skills/unification-voting/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { computeVoteBreakdown } from '../src/rules/voting';
import type { CandidateCard, CardCatalog } from '../src/types/cards';
import type { CandidateId, PlayerId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { emptyCatalog, setupAtUnification } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

function candidateWithVotes(id: CandidateId, baseVotes: number): CandidateCard {
  return {
    id,
    name: id,
    description: '',
    baseVotes,
    leaningTags: ['x'],
    supportedVoterGroups: ['laborers'],
    electionEffect: { kind: 'fixedPolicyMove', track: 'economy', direction: 1, amount: 1 },
    abilities: [],
  };
}

/** unification을 전원 스킵으로 넘기고 voting phase에 진입한 상태를 만든다 */
function skipToVoting(state: GameState): GameState {
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

describe('§13 최종 표 합산 (computeVoteBreakdown)', () => {
  it('기본 표 + 캠페인 표를 합산한다', () => {
    const state = setupAtUnification(1, PLAYERS4);
    const [c0] = state.round.candidatesRunning;
    // setupAtUnification 픽스처가 c0에 conditionalSupport를 8회 실행해 campaignVotes +8을 이미 남겨 두었다
    const catalog: CardCatalog = { ...emptyCatalog(), candidates: { [c0!]: candidateWithVotes(c0!, 3) } };
    const breakdown = computeVoteBreakdown(state, catalog);
    expect(breakdown[c0!]!.base).toBe(3);
    expect(breakdown[c0!]!.campaign).toBe(8);
    expect(breakdown[c0!]!.total).toBe(11);
  });
});

describe('§13 당선자 결정 + 동점 처리', () => {
  it('표가 가장 많은 후보가 당선된다', () => {
    let state = setupAtUnification(2, PLAYERS4);
    state = skipToVoting(state);
    const [c0, c1, c2] = state.round.candidatesRunning;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: { [c0!]: candidateWithVotes(c0!, 100), [c1!]: candidateWithVotes(c1!, 1), [c2!]: candidateWithVotes(c2!, 1) },
    };
    const result = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.round.winnerCandidateId).toBe(c0);
  });

  it('총합이 같으면 majorBacker의 reputation이 높은 쪽이 이긴다', () => {
    let state = setupAtUnification(3, PLAYERS4);
    state = skipToVoting(state);
    const [c0, c1, c2] = state.round.candidatesRunning;
    // 세 후보의 기본표를 0으로 맞추고, campaignVotes도 없다고 가정할 수 없으니(fixture가 c0에 +8을 이미 줌) c0만 비교 대상으로 쓴다
    // 대신 c1/c2를 동일 조건으로 만들어 비교한다: 둘 다 기본표 0, 캠페인 표 0
    const c1Backer = state.round.camps[c1!]!.majorBacker!;
    const c2Backer = state.round.camps[c2!]!.majorBacker!;
    state = {
      ...state,
      players: state.players.map((p) => (p.id === c1Backer ? { ...p, reputation: 9 } : p.id === c2Backer ? { ...p, reputation: 1 } : p)),
      round: { ...state.round, campaignVotes: {} }, // c0의 +8도 제거해 세 후보를 동일 선상에 둔다
    };
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: { [c0!]: candidateWithVotes(c0!, 0), [c1!]: candidateWithVotes(c1!, 0), [c2!]: candidateWithVotes(c2!, 0) },
    };
    const result = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.round.winnerCandidateId).toBe(c1);
  });
});

describe('§14 당선 효과 진입', () => {
  it('fixedPolicyMove는 선택 없이 즉시 확정되어 policyResolution까지 넘어간다', () => {
    let state = setupAtUnification(4, PLAYERS4);
    state = skipToVoting(state);
    const [c0] = state.round.candidatesRunning;
    const catalog: CardCatalog = { ...emptyCatalog(), candidates: { [c0!]: candidateWithVotes(c0!, 100) } };
    const result = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.phase).toBe('policyResolution');
    expect(result.state.round.electionEffectResolution).toEqual({ kind: 'move', track: 'economy', direction: 1, amount: 1 });
  });

  it('choosePolicyMove는 majorBacker의 선택을 기다리며 electionEffectSelection에 멈춘다', () => {
    let state = setupAtUnification(5, PLAYERS4);
    state = skipToVoting(state);
    const [c0] = state.round.candidatesRunning;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      candidates: {
        [c0!]: {
          ...candidateWithVotes(c0!, 100),
          electionEffect: { kind: 'choosePolicyMove', options: [{ track: 'economy', direction: 1, amount: 1 }, { track: 'labor', direction: -1, amount: 1 }] },
        },
      },
    };
    const result = reduce(state, { type: 'resolveVoting' }, catalog);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.phase).toBe('electionEffectSelection');
    expect(result.state.round.electionEffectResolution).toBeNull();

    const majorBacker = result.state.round.camps[c0!]!.majorBacker!;
    const picked = reduce(result.state, { type: 'selectElectionPolicyMove', actor: majorBacker, track: 'labor', direction: -1 }, catalog);
    expect(picked.ok).toBe(true);
    if (picked.ok) {
      expect(picked.state.phase).toBe('policyResolution');
      expect(picked.state.round.electionEffectResolution).toEqual({ kind: 'move', track: 'labor', direction: -1, amount: 1 });
    }
  });
});
