// 기반 스킬: skills/unification-voting/SKILL.md
// §13 투표 — 최종 표 합산과 동점 처리
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import { resolveElectionEffectEntry } from './electionEffects';
import { computeVoterSupport, computeVoterVotes } from './voters';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { CandidateId } from '../types/ids';
import type { GameState } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 후보 1명의 표 출처 분해 (§13 ①~⑤ + UI 개표용) */
export interface VoteBreakdown {
  base: number;
  promise: number;
  campaign: number;
  voter: number;
  transfer: number;
  total: number;
}

function promiseVoteBonus(state: GameState, catalog: CardCatalog, candidateId: CandidateId): number {
  const promiseId = state.round.camps[candidateId]?.promiseId;
  const promise = promiseId ? catalog.promises[promiseId] : undefined;
  if (!promise) return 0;
  if (promise.effect.kind === 'extraVotes') return promise.effect.amount;
  if (promise.effect.kind === 'extraVotesIfGroupRevealed') {
    const effect = promise.effect; // 클로저 안에서도 좁혀진 타입을 유지하기 위해 고정한다
    const revealed = state.round.votersRevealed.some((id) => catalog.voters[id]?.group === effect.group);
    return revealed ? effect.amount : 0;
  }
  return 0;
}

/** §13 최종 표 합산 — ①기본 ②공약 ③캠페인 ④유권자 배정 ⑤단일화 이전. 순수 함수 */
export function computeVoteBreakdown(state: GameState, catalog: CardCatalog): Partial<Record<CandidateId, VoteBreakdown>> {
  const voterVotes = computeVoterVotes(state, catalog);
  const breakdown: Partial<Record<CandidateId, VoteBreakdown>> = {};

  for (const candidateId of state.round.candidatesRunning) {
    const base = catalog.candidates[candidateId]?.baseVotes ?? 0;
    const promise = promiseVoteBonus(state, catalog, candidateId);
    const campaign = state.round.campaignVotes[candidateId] ?? 0;
    const voter = voterVotes[candidateId] ?? 0;
    const transfer = state.round.unificationTransfers[candidateId] ?? 0;
    breakdown[candidateId] = { base, promise, campaign, voter, transfer, total: base + promise + campaign + voter + transfer };
  }
  return breakdown;
}

/** 후보가 표를 받은 유권자 그룹의 개수 (§13 동점 처리 ③) — computeVoterSupport와 같은 기준을 공유한다 */
function countContributingGroups(state: GameState, catalog: CardCatalog, candidateId: CandidateId): number {
  const groups = new Set<string>();
  for (const entry of Object.values(computeVoterSupport(state, catalog))) {
    if (entry && entry.candidateId === candidateId) groups.add(entry.group);
  }
  return groups.size;
}

function majorBackerReputation(state: GameState, candidateId: CandidateId): number {
  const majorBacker = state.round.camps[candidateId]?.majorBacker;
  const player = majorBacker ? state.players.find((p) => p.id === majorBacker) : undefined;
  return player?.reputation ?? -Infinity;
}

/** §13 동점 처리: ①majorBacker reputation ②총 후원금 ③유권자 그룹 수 ④id 결정적 순서 */
function compareCandidates(
  state: GameState,
  catalog: CardCatalog,
  breakdown: Partial<Record<CandidateId, VoteBreakdown>>,
  a: CandidateId,
  b: CandidateId,
): number {
  const totalDiff = (breakdown[b]?.total ?? 0) - (breakdown[a]?.total ?? 0);
  if (totalDiff !== 0) return totalDiff;

  const repDiff = majorBackerReputation(state, b) - majorBackerReputation(state, a);
  if (repDiff !== 0) return repDiff;

  const backingDiff = (state.round.camps[b]?.totalBacking ?? 0) - (state.round.camps[a]?.totalBacking ?? 0);
  if (backingDiff !== 0) return backingDiff;

  const groupDiff = countContributingGroups(state, catalog, b) - countContributingGroups(state, catalog, a);
  if (groupDiff !== 0) return groupDiff;

  return a < b ? -1 : a > b ? 1 : 0;
}

function determineWinner(
  state: GameState,
  catalog: CardCatalog,
  breakdown: Partial<Record<CandidateId, VoteBreakdown>>,
): CandidateId | null {
  const candidates = state.round.candidatesRunning;
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => compareCandidates(state, catalog, breakdown, a, b))[0]!;
}

/** §19 resolveVoting — 당선자를 정하고 당선 효과가 자동 확정되면 곧바로 policyResolution까지 넘어간다 */
export function applyResolveVotingAction(state: GameState, catalog: CardCatalog): ReduceResult {
  if (state.phase !== 'voting') {
    return fail(`지금(${state.phase})은 'resolveVoting'을(를) 할 수 없습니다`);
  }

  const breakdown = computeVoteBreakdown(state, catalog);
  const winner = determineWinner(state, catalog, breakdown);
  const candidateVotes: Partial<Record<CandidateId, number>> = Object.fromEntries(
    Object.entries(breakdown).map(([id, b]) => [id, b!.total]),
  );

  const entry = createLogEntry(
    state,
    'voting',
    null,
    'resolveVoting',
    winner ? '투표가 마감되어 당선자가 결정되었습니다' : '출마 후보가 없어 당선자가 없습니다',
    winner ? [{ target: winner, field: 'winner', after: winner }] : [],
  );

  let next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, winnerCandidateId: winner },
    lastRoundResult: { round: state.round.round, candidateVotes, winnerCandidateId: winner, vpBreakdown: {} },
    phase: getNextPhase('voting', state.round.round, state.maxRounds),
  };

  // 당선 효과가 fixed/winningPromise면 즉시 확정되므로 electionEffectSelection에 머물 필요가 없다
  next = resolveElectionEffectEntry(next, catalog);
  if (next.round.electionEffectResolution) {
    next = { ...next, phase: getNextPhase('electionEffectSelection', next.round.round, next.maxRounds) };
  }

  return { ok: true, state: next, log: [entry] };
}
