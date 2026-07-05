// 기반 스킬: skills/advanced-rules/SKILL.md
// 부록 A-16 비밀 pact — 제안/수락/거절 + 배신 판정(§12: rep -2, 유권자 이벤트 2장, betrayedSecretPact 플래그)
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { applyScoreRoundAction } from '../src/rules/roundScoring';
import type { GameAction } from '../src/types/actions';
import type { CandidateId, PlayerId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { emptyCatalog, setupAtCampaign } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

function step(state: GameState, action: GameAction): GameState {
  const result = reduce(state, action, emptyCatalog());
  if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
  return result.state;
}

describe('부록 A-16 비밀 pact 제안/수락/거절', () => {
  it('자기 자신에게는 제안할 수 없다', () => {
    const state = setupAtCampaign(1, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    const result = reduce(
      state,
      { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-0', promise: { kind: 'supportCandidate', candidateId } },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('출마하지 않은 후보로는 제안할 수 없다', () => {
    const state = setupAtCampaign(2, PLAYERS4);
    const result = reduce(
      state,
      { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-1', promise: { kind: 'supportCandidate', candidateId: 'candidate-999' as CandidateId } },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('수락하면 대기 목록에서 빠지고 활성 pact가 된다', () => {
    let state = setupAtCampaign(3, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    state = step(state, { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-1', promise: { kind: 'supportCandidate', candidateId } });
    expect(state.round.pendingSecretPactProposals).toHaveLength(1);

    state = step(state, { type: 'acceptSecretPact', actor: 'player-1', proposer: 'player-0' });
    expect(state.round.pendingSecretPactProposals).toHaveLength(0);
    expect(state.round.activeSecretPacts).toHaveLength(1);
    expect(state.round.activeSecretPacts[0]).toMatchObject({ proposer: 'player-0', counterparty: 'player-1' });
  });

  it('거절하면 활성 pact가 되지 않고 조용히 사라진다', () => {
    let state = setupAtCampaign(4, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    state = step(state, { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-1', promise: { kind: 'supportCandidate', candidateId } });
    state = step(state, { type: 'declineSecretPact', actor: 'player-1', proposer: 'player-0' });
    expect(state.round.pendingSecretPactProposals).toHaveLength(0);
    expect(state.round.activeSecretPacts).toHaveLength(0);
  });

  it('같은 상대에게 이미 대기 중인 제안이 있으면 중복 제안할 수 없다', () => {
    let state = setupAtCampaign(5, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    state = step(state, { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-1', promise: { kind: 'supportCandidate', candidateId } });
    const result = reduce(
      state,
      { type: 'proposeSecretPact', actor: 'player-0', counterparty: 'player-1', promise: { kind: 'supportCandidate', candidateId } },
      emptyCatalog(),
    );
    expect(result.ok).toBe(false);
  });

  it('proposeSecretPact/acceptSecretPact는 차례·비용과 무관하게 언제든 가능하다', () => {
    const state = setupAtCampaign(6, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    // campaignTurnOrder[0]이 아닌 플레이어가 제안해도 성공해야 한다(assignVoterChoice와 동일한 성격)
    const notCurrent = state.players.find((p) => p.id !== state.round.campaignTurnOrder[state.round.campaignActiveIndex])!.id;
    const result = reduce(
      state,
      { type: 'proposeSecretPact', actor: notCurrent, counterparty: 'player-3', promise: { kind: 'supportCandidate', candidateId } },
      emptyCatalog(),
    );
    expect(result.ok).toBe(true);
  });
});

describe('부록 A-16 비밀 pact 이행/배신 판정 (roundScoring)', () => {
  it('제안자가 실제로 후보를 지지하면(조건부 지지) 배신 페널티가 없다', () => {
    let state = setupAtCampaign(7, PLAYERS4);
    const candidateId = state.round.candidatesRunning[0]!;
    state = step(state, { type: 'proposeSecretPact', actor: 'player-1', counterparty: 'player-2', promise: { kind: 'supportCandidate', candidateId } });
    state = step(state, { type: 'acceptSecretPact', actor: 'player-2', proposer: 'player-1' });

    // player-1이 약속대로 candidateId를 조건부 지지한다
    for (let i = 0; i < 8; i += 1) {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      const target = actor === 'player-1' ? candidateId : state.round.candidatesRunning[1]!;
      state = step(state, { type: 'conditionalSupport', actor, candidateId: target });
    }
    expect(state.phase).toBe('unification');
    // roundScoring 직전까지 갈 필요 없이, scoreRound가 요구하는 phase만 맞춰 직접 호출한다
    const forcedToScoring: GameState = { ...state, phase: 'roundScoring' };
    const result = applyScoreRoundAction(forcedToScoring, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);

    const proposer = result.state.players.find((p) => p.id === 'player-1')!;
    const counterparty = result.state.players.find((p) => p.id === 'player-2')!;
    expect(proposer.betrayedSecretPact).toBe(false);
    expect(proposer.reputation).toBe(2); // STARTING_REPUTATION 그대로
    expect(counterparty.voterEventHand).toHaveLength(0);
  });

  it('제안자가 약속을 지키지 않으면 배신 페널티(rep -2, 유권자 이벤트 2장, 플래그)가 적용된다', () => {
    let state = setupAtCampaign(8, PLAYERS4);
    const promisedCandidate = state.round.candidatesRunning[0]!;
    const otherCandidate = state.round.candidatesRunning[1]!;
    state = step(state, {
      type: 'proposeSecretPact',
      actor: 'player-1',
      counterparty: 'player-2',
      promise: { kind: 'supportCandidate', candidateId: promisedCandidate },
    });
    state = step(state, { type: 'acceptSecretPact', actor: 'player-2', proposer: 'player-1' });

    // player-1이 약속과 다른 후보를 지지한다(배신)
    for (let i = 0; i < 8; i += 1) {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      state = step(state, { type: 'conditionalSupport', actor, candidateId: otherCandidate });
    }

    const proposerReputationBefore = state.players.find((p) => p.id === 'player-1')!.reputation;
    const forcedToScoring: GameState = { ...state, phase: 'roundScoring' };
    const result = applyScoreRoundAction(forcedToScoring, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);

    const proposer = result.state.players.find((p) => p.id === 'player-1')!;
    const counterparty = result.state.players.find((p) => p.id === 'player-2')!;
    expect(proposer.betrayedSecretPact).toBe(true);
    expect(proposer.reputation).toBe(proposerReputationBefore - 2);
    expect(counterparty.voterEventHand.length).toBeGreaterThan(0);
    expect(counterparty.voterEventHand).toHaveLength(2);
  });

  it('제안자가 대표 후보의 majorBacker/coBacker 본인이면 별도 행동 없이도 이행으로 인정된다', () => {
    let state = setupAtCampaign(9, PLAYERS4);
    const ownCandidate = state.round.candidatesRunning.find((id) => state.round.camps[id]!.majorBacker === 'player-1')!;
    state = step(state, {
      type: 'proposeSecretPact',
      actor: 'player-1',
      counterparty: 'player-2',
      promise: { kind: 'supportCandidate', candidateId: ownCandidate },
    });
    state = step(state, { type: 'acceptSecretPact', actor: 'player-2', proposer: 'player-1' });
    // 캠페인 액션은 전부 무관한 후보에게: 그래도 자기 후보이므로 이행 인정
    for (let i = 0; i < 8; i += 1) {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      state = step(state, { type: 'conditionalSupport', actor, candidateId: state.round.candidatesRunning[2]! });
    }
    const forcedToScoring: GameState = { ...state, phase: 'roundScoring' };
    const result = applyScoreRoundAction(forcedToScoring, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.players.find((p) => p.id === 'player-1')!.betrayedSecretPact).toBe(false);
  });
});
