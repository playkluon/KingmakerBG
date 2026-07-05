// 기반 스킬: skills/advanced-rules/SKILL.md
// 부록 A-15 공개 조건 계약 — 대표 후보 당선 시에만 자동 이행되고, 낙선하면 그냥 무효가 된다(불이행 경로 없음)
import { describe, expect, it } from 'vitest';
import { SCORE_CONTRACT_LEADER_BONUS, STARTING_MONEY } from '../src/constants';
import { computeFinalResult } from '../src/rules/finalScoring';
import { reduce } from '../src/reducer';
import type { CandidateCard, CardCatalog, PromiseCard } from '../src/types/cards';
import type { GameAction } from '../src/types/actions';
import type { CandidateId, PromiseId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { setupAtUnification } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

function candidate(id: CandidateId, baseVotes: number): CandidateCard {
  return {
    id,
    name: id,
    description: '',
    baseVotes,
    leaningTags: [],
    supportedVoterGroups: [],
    electionEffect: { kind: 'flexPolicyMove', amount: 1 },
    abilities: [],
  };
}

function promise(id: PromiseId): PromiseCard {
  return { id, name: id, description: '', policyMove: { track: 'economy', direction: 1, amount: 1 }, reactionTag: 'economy-1', effect: { kind: 'extraVotes', amount: 0 } };
}

/** candidatesRunning 3명 전원과 각자의 확정 공약을 채운 카탈로그 — 단일화 이후 실제 투표까지 끝까지 진행하기 위함 */
function fullCatalog(state: GameState): CardCatalog {
  const catalog: CardCatalog = { candidates: {}, promises: {}, voters: {}, issues: {}, candidateEvents: {}, voterEvents: {}, agendas: {} };
  for (const id of state.round.candidatesRunning) {
    catalog.candidates[id] = candidate(id, 1);
    const promiseId = state.round.camps[id]!.promiseId!;
    catalog.promises[promiseId] = promise(promiseId);
  }
  return catalog;
}

function step(state: GameState, action: GameAction, catalog: CardCatalog): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
  return result.state;
}

/** flexPolicyMove 당선 효과는 majorBacker가 있으면 선택을 기다리므로, 도달했다면 대신 선택해 policyResolution까지 넘어간다 */
function resolveElectionEffectIfNeeded(state: GameState, catalog: CardCatalog): GameState {
  if (state.phase !== 'electionEffectSelection') return state;
  const winner = state.round.winnerCandidateId!;
  const backer = state.round.camps[winner]!.majorBacker!;
  return step(state, { type: 'selectElectionPolicyMove', actor: backer, track: 'economy', direction: 1 }, catalog);
}

describe('부록 A-15 공개 조건 계약', () => {
  it('제안 시 약속한 자금이 보유 자금보다 많으면 거부된다', () => {
    const state = setupAtUnification(1, PLAYERS4);
    const catalog = fullCatalog(state);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const result = reduce(
      state,
      {
        type: 'proposeUnification',
        actor: proposer,
        leadCandidateId: leadId!,
        withdrawCandidateId: withdrawId!,
        terms: [{ kind: 'moneyTransfer', amount: STARTING_MONEY * 100 }],
      },
      catalog,
    );
    expect(result.ok).toBe(false);
  });

  it('조건 없이 제안하면 기존과 동일하게 동작한다(terms: [])', () => {
    const state = setupAtUnification(2, PLAYERS4);
    const catalog = fullCatalog(state);
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const result = reduce(state, { type: 'proposeUnification', actor: proposer, leadCandidateId: leadId!, withdrawCandidateId: withdrawId! }, catalog);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.round.pendingUnificationProposal!.terms).toEqual([]);
  });

  it('대표 후보가 실제로 당선되면 계약이 이행되고 contractsFulfilled가 오른다', () => {
    let state = setupAtUnification(3, PLAYERS4);
    const catalog = fullCatalog(state);
    // candidatesRunning[0]은 fixture가 이미 8회 조건지지로 몰아준 강세 후보 — 대표로 지정해 당선을 보장한다
    const [leadId, withdrawId] = state.round.candidatesRunning;
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const beneficiary = state.round.camps[withdrawId!]!.majorBacker!;
    const beneficiaryBefore = state.players.find((p) => p.id === beneficiary)!.money;
    const proposerBefore = state.players.find((p) => p.id === proposer)!.money;

    state = step(
      state,
      {
        type: 'proposeUnification',
        actor: proposer,
        leadCandidateId: leadId!,
        withdrawCandidateId: withdrawId!,
        terms: [
          { kind: 'moneyTransfer', amount: 3 },
          { kind: 'victoryPointGrant', amount: 2 },
          { kind: 'policyConcession', track: 'labor', direction: 1, amount: 1 },
        ],
      },
      catalog,
    );
    state = step(state, { type: 'acceptUnification', actor: beneficiary }, catalog);
    expect(state.round.unificationContract).not.toBeNull();
    expect(state.round.unificationContract!.fulfilled).toBe(false); // 아직 투표 전

    // voting → policyResolution까지: 남은 majorBacker가 있으면 스킵시켜 단일화를 마저 끝낸다
    while (state.phase === 'unification') {
      const remaining = state.round.candidatesRunning
        .map((id) => state.round.camps[id]!.majorBacker)
        .find((id) => id && !state.round.unificationDone[id]);
      if (!remaining) break;
      state = step(state, { type: 'skipUnification', actor: remaining }, catalog);
    }
    state = step(state, { type: 'resolveVoting' }, catalog);
    expect(state.round.winnerCandidateId).toBe(leadId); // 강세 후보가 실제로 당선됨을 전제로 한 테스트
    state = resolveElectionEffectIfNeeded(state, catalog);
    state = step(state, { type: 'resolvePolicy' }, catalog);

    expect(state.round.unificationContract!.fulfilled).toBe(true);
    const proposerAfter = state.players.find((p) => p.id === proposer)!;
    const beneficiaryAfter = state.players.find((p) => p.id === beneficiary)!;
    expect(proposerAfter.money).toBe(proposerBefore - 3);
    expect(beneficiaryAfter.money).toBe(beneficiaryBefore + 3);
    expect(beneficiaryAfter.victoryPoints).toBe(2);
    expect(proposerAfter.contractsFulfilled).toBe(1);
    expect(state.policyTracks.labor).toBeGreaterThanOrEqual(1);
  });

  it('대표 후보가 낙선하면 계약은 무효가 되고 이행되지 않는다', () => {
    let state = setupAtUnification(3, PLAYERS4);
    const catalog = fullCatalog(state);
    // 일부러 약세 후보(candidatesRunning[1])를 대표로 세운다 — candidatesRunning[0]의 8회 조건지지 보너스에 밀려 낙선한다
    const [strongId, leadId, withdrawId] = state.round.candidatesRunning;
    const proposer = state.round.camps[leadId!]!.majorBacker!;
    const beneficiary = state.round.camps[withdrawId!]!.majorBacker!;
    const proposerMoneyBefore = state.players.find((p) => p.id === proposer)!.money;

    state = step(
      state,
      {
        type: 'proposeUnification',
        actor: proposer,
        leadCandidateId: leadId!,
        withdrawCandidateId: withdrawId!,
        terms: [{ kind: 'moneyTransfer', amount: 3 }],
      },
      catalog,
    );
    state = step(state, { type: 'acceptUnification', actor: beneficiary }, catalog);

    while (state.phase === 'unification') {
      const remaining = state.round.candidatesRunning
        .map((id) => state.round.camps[id]!.majorBacker)
        .find((id) => id && !state.round.unificationDone[id]);
      if (!remaining) break;
      state = step(state, { type: 'skipUnification', actor: remaining }, catalog);
    }
    state = step(state, { type: 'resolveVoting' }, catalog);
    expect(state.round.winnerCandidateId).toBe(strongId); // 대표 후보가 아니라 강세 후보가 당선됨을 전제로 한 테스트
    state = resolveElectionEffectIfNeeded(state, catalog);
    state = step(state, { type: 'resolvePolicy' }, catalog);

    expect(state.round.unificationContract!.fulfilled).toBe(false);
    expect(state.players.find((p) => p.id === proposer)!.money).toBe(proposerMoneyBefore); // 이전되지 않음
    expect(state.players.find((p) => p.id === proposer)!.contractsFulfilled).toBe(0);
  });

  it('§16-5 최종 점수: 공개 계약 이행 수 단독 1등에게 +2 VP', () => {
    const state = setupAtUnification(4, PLAYERS4);
    const catalog = { candidates: {}, promises: {}, voters: {}, issues: {}, candidateEvents: {}, voterEvents: {}, agendas: {} } as CardCatalog;
    const withFulfilled: GameState = {
      ...state,
      players: state.players.map((p, i) => (i === 0 ? { ...p, contractsFulfilled: 2 } : { ...p, contractsFulfilled: 0 })),
    };
    const result = computeFinalResult(withFulfilled, catalog);
    const leader = result.entries.find((e) => e.playerId === 'player-0')!;
    const others = result.entries.filter((e) => e.playerId !== 'player-0');
    expect(leader.contractBonusVp).toBe(SCORE_CONTRACT_LEADER_BONUS);
    others.forEach((e) => expect(e.contractBonusVp).toBe(0));
  });

  it('전원 이행 수가 0이면(공동 동률) 아무도 계약 보너스를 받지 않는다', () => {
    const state = setupAtUnification(5, PLAYERS4);
    const catalog = { candidates: {}, promises: {}, voters: {}, issues: {}, candidateEvents: {}, voterEvents: {}, agendas: {} } as CardCatalog;
    const result = computeFinalResult(state, catalog);
    result.entries.forEach((e) => expect(e.contractBonusVp).toBe(0));
  });
});
