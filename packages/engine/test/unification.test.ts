// 기반 스킬: skills/unification-voting/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { computeTransferRatio } from '../src/rules/unification';
import type { CandidateCard, CardCatalog, PromiseCard } from '../src/types/cards';
import type { CandidateId, PlayerId, PromiseId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { emptyCatalog, setupAtUnification } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

function candidate(id: CandidateId, supportedVoterGroups: string[]): CandidateCard {
  return {
    id,
    name: id,
    description: '',
    baseVotes: 1,
    leaningTags: ['x'],
    supportedVoterGroups,
    electionEffect: { kind: 'flexPolicyMove', amount: 1 },
    abilities: [],
  };
}

function promise(id: PromiseId, track: 'economy' | 'labor', direction: 1 | -1): PromiseCard {
  return { id, name: id, description: '', policyMove: { track, direction, amount: 1 }, reactionTag: `${track}-${direction}`, effect: { kind: 'extraVotes', amount: 0 } };
}

function catalogFor(state: GameState, leadGroups: string[], withdrawGroups: string[], leadTrack: 'economy' | 'labor', leadDir: 1 | -1, withdrawTrack: 'economy' | 'labor', withdrawDir: 1 | -1): CardCatalog {
  const [leadId, withdrawId] = state.round.candidatesRunning;
  const leadPromiseId = state.round.camps[leadId!]!.promiseId!;
  const withdrawPromiseId = state.round.camps[withdrawId!]!.promiseId!;
  return {
    ...emptyCatalog(),
    candidates: { [leadId!]: candidate(leadId!, leadGroups), [withdrawId!]: candidate(withdrawId!, withdrawGroups) },
    promises: {
      [leadPromiseId]: promise(leadPromiseId, leadTrack, leadDir),
      [withdrawPromiseId]: promise(withdrawPromiseId, withdrawTrack, withdrawDir),
    },
  };
}

describe('부록 A-12 이전 비율 계산', () => {
  it('같은 트랙·같은 방향이면 70%', () => {
    const state = setupAtUnification(1, PLAYERS4);
    const catalog = catalogFor(state, ['laborers'], ['youth'], 'economy', 1, 'economy', 1);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    expect(computeTransferRatio(state, catalog, leadId!, withdrawId!)).toBe(0.7);
  });

  it('같은 트랙·반대 방향이면 직접 충돌로 null(불가)', () => {
    const state = setupAtUnification(2, PLAYERS4);
    const catalog = catalogFor(state, ['laborers'], ['youth'], 'economy', 1, 'economy', -1);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    expect(computeTransferRatio(state, catalog, leadId!, withdrawId!)).toBeNull();
  });

  it('트랙이 다르고 지지 그룹이 겹치면 50%', () => {
    const state = setupAtUnification(3, PLAYERS4);
    const catalog = catalogFor(state, ['laborers', 'youth'], ['youth'], 'economy', 1, 'labor', 1);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    expect(computeTransferRatio(state, catalog, leadId!, withdrawId!)).toBe(0.5);
  });

  it('트랙도 다르고 지지 그룹도 겹치지 않으면 30%', () => {
    const state = setupAtUnification(4, PLAYERS4);
    const catalog = catalogFor(state, ['laborers'], ['seniors'], 'economy', 1, 'labor', 1);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    expect(computeTransferRatio(state, catalog, leadId!, withdrawId!)).toBe(0.3);
  });
});

describe('§12 단일화 제안·수락·거절·스킵', () => {
  it('대표 후보의 majorBacker만 제안할 수 있다', () => {
    const state = setupAtUnification(5, PLAYERS4);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const catalog = catalogFor(state, ['laborers'], ['seniors'], 'economy', 1, 'labor', 1);
    const notMajorBacker = state.players.find((p) => p.id !== state.round.camps[leadId!]!.majorBacker)!.id;
    const result = reduce(state, { type: 'proposeUnification', actor: notMajorBacker, leadCandidateId: leadId!, withdrawCandidateId: withdrawId! }, catalog);
    expect(result.ok).toBe(false);
  });

  it('직접 충돌하는 후보는 제안 자체가 거부된다', () => {
    const state = setupAtUnification(6, PLAYERS4);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const catalog = catalogFor(state, ['laborers'], ['seniors'], 'economy', 1, 'economy', -1);
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const result = reduce(state, { type: 'proposeUnification', actor: proposer, leadCandidateId: leadId!, withdrawCandidateId: withdrawId! }, catalog);
    expect(result.ok).toBe(false);
  });

  it('수락하면 사퇴 후보가 candidatesRunning에서 빠지고 표가 이전되며 투표로 넘어간다', () => {
    let state = setupAtUnification(7, PLAYERS4);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const catalog = catalogFor(state, ['laborers'], ['seniors'], 'economy', 1, 'economy', 1); // 70%
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const accepter = state.round.camps[withdrawId!]!.majorBacker!;

    const proposed = reduce(state, { type: 'proposeUnification', actor: proposer, leadCandidateId: leadId!, withdrawCandidateId: withdrawId! }, catalog);
    if (!proposed.ok) throw new Error(proposed.reason);
    state = proposed.state;
    expect(state.round.pendingUnificationProposal).not.toBeNull();

    const accepted = reduce(state, { type: 'acceptUnification', actor: accepter }, catalog);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.state.round.candidatesRunning).not.toContain(withdrawId);
    expect(accepted.state.round.withdrawnCandidates).toContain(withdrawId);
    expect(accepted.state.round.unificationTransfers[leadId!]).toBeGreaterThanOrEqual(0);
    expect(accepted.state.phase).toBe('voting');
  });

  it('거절하면 제안자만 스킵 처리되고, 남은 majorBacker가 있으면 unification에 머문다', () => {
    let state = setupAtUnification(8, PLAYERS4);
    const [leadId, withdrawId, thirdId] = state.round.candidatesRunning;
    const catalog = catalogFor(state, ['laborers'], ['seniors'], 'economy', 1, 'economy', 1);
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const decliner = state.round.camps[withdrawId!]!.majorBacker!;

    const proposed = reduce(state, { type: 'proposeUnification', actor: proposer, leadCandidateId: leadId!, withdrawCandidateId: withdrawId! }, catalog);
    if (!proposed.ok) throw new Error(proposed.reason);
    state = proposed.state;

    const declined = reduce(state, { type: 'declineUnification', actor: decliner }, catalog);
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.state.round.pendingUnificationProposal).toBeNull();
    expect(declined.state.round.unificationDone[proposer]).toBe(true);
    // 3번째 후보의 majorBacker는 아직 행동하지 않았으므로 unification에 머문다 (해당 majorBacker가 존재한다면)
    if (state.round.camps[thirdId!]!.majorBacker) {
      expect(declined.state.phase).toBe('unification');
    }
  });

  it('모든 majorBacker가 스킵하면 투표로 자동 진행한다', () => {
    let state = setupAtUnification(9, PLAYERS4);
    const majorBackers = new Set(
      state.round.candidatesRunning.map((id) => state.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null),
    );
    for (const actor of majorBackers) {
      const result = reduce(state, { type: 'skipUnification', actor }, emptyCatalog());
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state.phase).toBe('voting');
  });

  it('이미 스킵한 majorBacker는 다시 행동할 수 없다', () => {
    let state = setupAtUnification(10, PLAYERS4);
    const [leadId] = state.round.candidatesRunning;
    const actor = state.round.camps[leadId!]!.majorBacker!;
    const first = reduce(state, { type: 'skipUnification', actor }, emptyCatalog());
    if (!first.ok) throw new Error(first.reason);
    state = first.state;
    const second = reduce(state, { type: 'skipUnification', actor }, emptyCatalog());
    expect(second.ok).toBe(false);
  });
});
