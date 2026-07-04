// 기반 스킬: skills/unification-voting/SKILL.md
// §12 단일화 — 제안/수락/거절/스킵. 이전 비율 계산은 부록 A-12 기준.
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import { computeVoteBreakdown } from './voting';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { PlayerAction } from '../types/actions';
import type { CandidateId, PlayerId } from '../types/ids';
import type { GameState, UnificationProposal } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 부록 A-12: 두 후보의 이전 비율을 계산한다. 직접 충돌이면 null(제안 불가) */
export function computeTransferRatio(state: GameState, catalog: CardCatalog, leadId: CandidateId, withdrawId: CandidateId): number | null {
  const leadCandidate = catalog.candidates[leadId];
  const withdrawCandidate = catalog.candidates[withdrawId];
  const leadPromiseId = state.round.camps[leadId]?.promiseId;
  const withdrawPromiseId = state.round.camps[withdrawId]?.promiseId;
  const leadPromise = leadPromiseId ? catalog.promises[leadPromiseId] : undefined;
  const withdrawPromise = withdrawPromiseId ? catalog.promises[withdrawPromiseId] : undefined;

  if (leadPromise && withdrawPromise && leadPromise.policyMove.track === withdrawPromise.policyMove.track) {
    if (leadPromise.policyMove.direction === withdrawPromise.policyMove.direction) return 0.7;
    return null; // 같은 트랙, 반대 방향 -> 직접 충돌
  }

  const leadGroups = new Set(leadCandidate?.supportedVoterGroups ?? []);
  const overlap = (withdrawCandidate?.supportedVoterGroups ?? []).some((g) => leadGroups.has(g));
  if (overlap) return 0.5;

  return 0.3;
}

function allMajorBackersDone(state: GameState): boolean {
  const majorBackers = new Set(
    state.round.candidatesRunning.map((id) => state.round.camps[id]?.majorBacker).filter((id): id is PlayerId => id != null),
  );
  return [...majorBackers].every((id) => state.round.unificationDone[id]);
}

/** 전원 스킵/거절로 끝났으면 투표로 넘어간다. 아직 남아있으면 unification phase에 머문다 */
function maybeAdvanceToVoting(state: GameState): GameState {
  if (state.phase === 'unification' && allMajorBackersDone(state)) {
    return { ...state, phase: getNextPhase('unification', state.round.round, state.maxRounds) };
  }
  return state;
}

export function applyProposeUnification(
  state: GameState,
  action: Extract<PlayerAction, { type: 'proposeUnification' }>,
  catalog: CardCatalog,
): ReduceResult {
  if (state.round.pendingUnificationProposal) {
    return fail('이미 대기 중인 단일화 제안이 있습니다');
  }
  if (state.round.unificationDone[action.actor]) {
    return fail('이미 이번 라운드 단일화 기회를 사용했습니다');
  }
  const { leadCandidateId, withdrawCandidateId } = action;
  if (leadCandidateId === withdrawCandidateId) return fail('같은 후보를 지정할 수 없습니다');
  if (!state.round.candidatesRunning.includes(leadCandidateId) || !state.round.candidatesRunning.includes(withdrawCandidateId)) {
    return fail('출마하지 않은 후보입니다');
  }
  const leadCamp = state.round.camps[leadCandidateId];
  if (!leadCamp || leadCamp.majorBacker !== action.actor) {
    return fail('대표로 지정한 후보의 주요 후원자만 제안할 수 있습니다');
  }

  const ratio = computeTransferRatio(state, catalog, leadCandidateId, withdrawCandidateId);
  if (ratio === null) {
    return fail('두 후보의 정책 방향이 직접 충돌해 단일화를 제안할 수 없습니다');
  }
  const withdrawTotal = computeVoteBreakdown(state, catalog)[withdrawCandidateId]?.total ?? 0;
  const transferVotes = Math.floor(withdrawTotal * ratio);

  const proposal: UnificationProposal = { proposer: action.actor, leadCandidateId, withdrawCandidateId, ratio, transferVotes };
  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(
    state,
    'unification',
    action.actor,
    'proposeUnification',
    `${player.name}이(가) 단일화를 제안했습니다 (이전 비율 ${Math.round(ratio * 100)}%, 예상 이전 표 ${transferVotes})`,
  );
  const next: GameState = { ...appendLog(state, entry), round: { ...state.round, pendingUnificationProposal: proposal } };
  return { ok: true, state: next, log: [entry] };
}

export function applyAcceptUnification(state: GameState, action: Extract<PlayerAction, { type: 'acceptUnification' }>): ReduceResult {
  const proposal = state.round.pendingUnificationProposal;
  if (!proposal) return fail('대기 중인 단일화 제안이 없습니다');
  const withdrawCamp = state.round.camps[proposal.withdrawCandidateId];
  if (!withdrawCamp || withdrawCamp.majorBacker !== action.actor) {
    return fail('사퇴 후보의 주요 후원자만 수락할 수 있습니다');
  }

  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(
    state,
    'unification',
    action.actor,
    'acceptUnification',
    `${player.name}이(가) 단일화를 수락했습니다 — 후보가 사퇴하고 표 ${proposal.transferVotes}가 이전됩니다`,
    [
      { target: proposal.withdrawCandidateId, field: 'withdrawn', after: 'withdrawn' },
      { target: proposal.leadCandidateId, field: 'unificationTransfer', delta: proposal.transferVotes },
    ],
  );

  // 단일화는 라운드당 최대 1건(부록 A-12) — 성사 즉시 투표로 진행한다
  const next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      candidatesRunning: state.round.candidatesRunning.filter((id) => id !== proposal.withdrawCandidateId),
      withdrawnCandidates: [...state.round.withdrawnCandidates, proposal.withdrawCandidateId],
      unificationTransfers: {
        ...state.round.unificationTransfers,
        [proposal.leadCandidateId]: (state.round.unificationTransfers[proposal.leadCandidateId] ?? 0) + proposal.transferVotes,
      },
      pendingUnificationProposal: null,
    },
    phase: getNextPhase('unification', state.round.round, state.maxRounds),
  };
  return { ok: true, state: next, log: [entry] };
}

export function applyDeclineUnification(state: GameState, action: Extract<PlayerAction, { type: 'declineUnification' }>): ReduceResult {
  const proposal = state.round.pendingUnificationProposal;
  if (!proposal) return fail('대기 중인 단일화 제안이 없습니다');
  const withdrawCamp = state.round.camps[proposal.withdrawCandidateId];
  if (!withdrawCamp || withdrawCamp.majorBacker !== action.actor) {
    return fail('사퇴 후보의 주요 후원자만 거절할 수 있습니다');
  }

  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(state, 'unification', action.actor, 'declineUnification', `${player.name}이(가) 단일화 제안을 거절했습니다`);
  let next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      pendingUnificationProposal: null,
      unificationDone: { ...state.round.unificationDone, [proposal.proposer]: true },
    },
  };
  next = maybeAdvanceToVoting(next);
  return { ok: true, state: next, log: [entry] };
}

export function applySkipUnification(state: GameState, action: Extract<PlayerAction, { type: 'skipUnification' }>): ReduceResult {
  const isEligible = state.round.candidatesRunning.some((id) => state.round.camps[id]?.majorBacker === action.actor);
  if (!isEligible) return fail('출마 후보의 주요 후원자만 단일화를 진행할 수 있습니다');
  if (state.round.unificationDone[action.actor]) return fail('이미 이번 라운드 단일화 기회를 사용했습니다');

  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(state, 'unification', action.actor, 'skipUnification', `${player.name}이(가) 단일화를 넘겼습니다`);
  let next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, unificationDone: { ...state.round.unificationDone, [action.actor]: true } },
  };
  next = maybeAdvanceToVoting(next);
  return { ok: true, state: next, log: [entry] };
}

/** §19 runUnificationTest — 제안 가능한 majorBacker가 아예 없는 등, 이미 종료 조건을 만족했는지 확인한다 */
export function applyRunUnificationTestAction(state: GameState): ReduceResult {
  if (state.phase !== 'unification') {
    return fail(`지금(${state.phase})은 'runUnificationTest'를 할 수 없습니다`);
  }
  const next = maybeAdvanceToVoting(state);
  const entry = createLogEntry(
    state,
    'unification',
    null,
    'runUnificationTest',
    next.phase === 'unification' ? '단일화가 아직 진행 중입니다' : '더 진행할 단일화가 없어 투표로 넘어갑니다',
  );
  return { ok: true, state: appendLog(next, entry), log: [entry] };
}
