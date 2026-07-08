// 기반 스킬: skills/advanced-rules/SKILL.md (코어 루프 개편안 B — 후보 제안·어필)
// 사전 이슈 2장을 본 뒤, 각 플레이어가 손패에서 후보 1명을 골라 탁자에 내놓는다.
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { PlayerAction } from '../types/actions';
import type { CardCatalog } from '../types/cards';
import type { GameState } from '../types/state';
import { createLogEntry, appendLog } from '../log';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/**
 * candidateProposal phase가 끝났는지 — 손패가 있는 플레이어 전원이 1명씩 제안했으면 끝.
 * 손패가 빈 플레이어(정당 후보가 모두 소모된 극단 케이스)는 제안 의무에서 자동으로 제외한다 —
 * 그러지 않으면 그 플레이어 때문에 phase가 영원히 끝나지 않는 진행 불가가 생긴다.
 */
export function isProposalPhaseComplete(state: GameState): boolean {
  return state.players.every((p) => state.round.proposals[p.id] != null || p.hand.length === 0);
}

export function applyProposeCandidate(
  state: GameState,
  action: Extract<PlayerAction, { type: 'proposeCandidate' }>,
  catalog: CardCatalog,
): ReduceResult {
  const { actor, candidateId } = action;
  const player = state.players.find((p) => p.id === actor)!;

  if (state.round.proposals[actor]) return fail('이미 이번 라운드에 후보를 제안했습니다');
  if (!player.hand.includes(candidateId)) return fail('해당 후보 카드를 손패에 들고 있지 않습니다');
  if (state.round.candidatesRevealed.includes(candidateId)) return fail('이미 다른 플레이어가 제안한 후보입니다');

  // 같은 정당 2인은 손패를 공유하므로(개편안 A), 제안된 카드는 "모든" 플레이어의 손패에서 제거해야
  // 동료가 같은 후보를 중복 제안하는 일이 없다.
  const players = state.players.map((p) => (p.hand.includes(candidateId) ? { ...p, hand: p.hand.filter((id) => id !== candidateId) } : p));

  const candidatesRevealed = [...state.round.candidatesRevealed, candidateId];
  const proposals = { ...state.round.proposals, [actor]: candidateId };

  const entry = createLogEntry(
    state,
    state.phase,
    actor,
    'proposeCandidate',
    `${player.name}이(가) 후보 ${catalog.candidates[candidateId]?.name ?? candidateId}을(를) 제안했습니다`,
    [{ target: candidateId, field: 'candidatesRevealed', after: candidateId }],
  );

  let next: GameState = {
    ...appendLog(state, entry),
    players,
    round: { ...state.round, candidatesRevealed, proposals },
  };

  // 손패 있는 전원이 제안을 마치면 사후 반전 이슈 공개(secondIssueReveal)로 넘어간다
  if (isProposalPhaseComplete(next)) {
    next = { ...next, phase: getNextPhase(state.phase, state.round.round, state.maxRounds) };
  }

  return { ok: true, state: next, log: [entry] };
}
