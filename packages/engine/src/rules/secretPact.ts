// 기반 스킬: skills/advanced-rules/SKILL.md
// §12 비밀 pact 제안/수락/거절 (부록 A-16) — assignVoterChoice와 같은 성격의 무료·차례 무관 액션.
// 이행 판정(배신 페널티)은 roundScoring.ts가 담당한다 — 결과가 나오는 시점이 라운드 채점이기 때문이다.
import { appendLog, createLogEntry } from '../log';
import type { ReduceResult } from '../result';
import type { PlayerAction } from '../types/actions';
import type { GameState, SecretPact, SecretPactProposal } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

export function applyProposeSecretPact(state: GameState, action: Extract<PlayerAction, { type: 'proposeSecretPact' }>): ReduceResult {
  const { actor, counterparty, promise } = action;
  if (actor === counterparty) return fail('자기 자신과는 pact를 맺을 수 없습니다');
  if (!state.players.some((p) => p.id === counterparty)) return fail('존재하지 않는 플레이어입니다');
  if (!state.round.candidatesRunning.includes(promise.candidateId)) return fail('출마하지 않은 후보입니다');
  if (state.round.pendingSecretPactProposals.some((p) => p.proposer === actor && p.counterparty === counterparty)) {
    return fail('이미 같은 상대에게 대기 중인 pact 제안이 있습니다');
  }

  const proposal: SecretPactProposal = { proposer: actor, counterparty, promise };
  // 비밀 제안 — summary에 상대나 내용을 담지 않는다. effects의 target은 텍스트로 노출되지 않고
  // projectView가 "당사자인지" 판정하는 용도로만 쓰인다(부록 A-16 — 액션 로그 자체도 마스킹 대상).
  const entry = createLogEntry(state, 'campaignActions', actor, 'proposeSecretPact', '누군가 비밀 제안을 보냈습니다', [
    { target: counterparty, field: 'secretPactCounterparty', after: null },
  ]);
  const next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, pendingSecretPactProposals: [...state.round.pendingSecretPactProposals, proposal] },
  };
  return { ok: true, state: next, log: [entry] };
}

function findProposal(state: GameState, proposer: string, counterparty: string): SecretPactProposal | undefined {
  return state.round.pendingSecretPactProposals.find((p) => p.proposer === proposer && p.counterparty === counterparty);
}

export function applyAcceptSecretPact(state: GameState, action: Extract<PlayerAction, { type: 'acceptSecretPact' }>): ReduceResult {
  const proposal = findProposal(state, action.proposer, action.actor);
  if (!proposal) return fail('대기 중인 pact 제안이 없습니다');

  const pact: SecretPact = { proposer: proposal.proposer, counterparty: proposal.counterparty, promise: proposal.promise };
  const entry = createLogEntry(state, 'campaignActions', action.actor, 'acceptSecretPact', '누군가 비밀 제안을 수락했습니다', [
    { target: proposal.proposer, field: 'secretPactCounterparty', after: null },
  ]);
  const next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      pendingSecretPactProposals: state.round.pendingSecretPactProposals.filter((p) => p !== proposal),
      activeSecretPacts: [...state.round.activeSecretPacts, pact],
    },
  };
  return { ok: true, state: next, log: [entry] };
}

export function applyDeclineSecretPact(state: GameState, action: Extract<PlayerAction, { type: 'declineSecretPact' }>): ReduceResult {
  const proposal = findProposal(state, action.proposer, action.actor);
  if (!proposal) return fail('대기 중인 pact 제안이 없습니다');

  const entry = createLogEntry(state, 'campaignActions', action.actor, 'declineSecretPact', '누군가 비밀 제안을 거절했습니다', [
    { target: proposal.proposer, field: 'secretPactCounterparty', after: null },
  ]);
  const next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, pendingSecretPactProposals: state.round.pendingSecretPactProposals.filter((p) => p !== proposal) },
  };
  return { ok: true, state: next, log: [entry] };
}
