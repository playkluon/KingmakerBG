// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// 학습 전 기준선 AI: 상태 평가 함수와 즉시 행동 휴리스틱. 모든 결과는 seed 기반 BotRng로 결정된다.
import {
  POLICY_TRACKS,
  computeVoteBreakdown,
  evaluateAgendaCondition,
  getVoterController,
  reduce,
  type CardCatalog,
  type CandidateId,
  type AgendaCondition,
  type GameAction,
  type GameState,
  type PlayerId,
  type PolicyDirection,
  type VoterId,
} from '@kingmakers/engine';
import { legalActionsForActor } from './legalActions';
import type { BotRng } from './bot';

interface AgendaPreference {
  track?: string;
  direction?: PolicyDirection;
  group?: string;
  candidateId?: CandidateId;
  conserveMoney?: boolean;
  preserveReputation?: boolean;
}

function actionBidTotal(action: Extract<GameAction, { type: 'placeBid' }>): number {
  let total = 0;
  for (const amount of Object.values(action.allocations)) {
    total += amount ?? 0;
  }
  return total;
}

function allocationsKey(allocations: Partial<Record<CandidateId, number>> | undefined): string {
  return Object.entries(allocations ?? {})
    .filter(([, amount]) => amount != null && amount > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, amount]) => `${id}:${amount}`)
    .join('|');
}

function agendaPreference(condition: AgendaCondition | undefined): AgendaPreference {
  if (!condition) return {};
  if (condition.kind === 'policyAtLeast') return { track: condition.track, direction: condition.direction };
  if (condition.kind === 'policyBetween') {
    const midpoint = (condition.min + condition.max) / 2;
    return midpoint > 0 ? { track: condition.track, direction: 1 } : midpoint < 0 ? { track: condition.track, direction: -1 } : { track: condition.track };
  }
  if (condition.kind === 'influenceLeader') return { group: condition.group };
  if (condition.kind === 'influenceLeaderAny') return { group: condition.groups[0] };
  if (condition.kind === 'candidateWon') return { candidateId: condition.candidateId };
  if (condition.kind === 'reputationAtLeast' || condition.kind === 'reputationRankAtMost') return { preserveReputation: true };
  if (condition.kind === 'remainingMoneyAtLeast') return { conserveMoney: true };
  return {};
}

function playerAgendaPreference(state: GameState, catalog: CardCatalog, playerId: PlayerId): AgendaPreference {
  const agendaId = state.players.find((p) => p.id === playerId)?.secretAgendaId;
  return agendaPreference(agendaId ? catalog.agendas[agendaId]?.condition : undefined);
}

function agendaProgressScore(state: GameState, catalog: CardCatalog, playerId: PlayerId): number {
  const agendaId = state.players.find((p) => p.id === playerId)?.secretAgendaId;
  const agenda = agendaId ? catalog.agendas[agendaId] : undefined;
  if (!agenda) return 0;
  if (evaluateAgendaCondition(agenda.condition, playerId, state, state.roundHistory)) return agenda.points;

  const condition = agenda.condition;
  if (condition.kind === 'policyAtLeast') {
    const value = state.policyTracks[condition.track] * condition.direction;
    return Math.max(0, value / condition.minMagnitude) * agenda.points * 0.6;
  }
  if (condition.kind === 'policyBetween') {
    const value = state.policyTracks[condition.track];
    if (value >= condition.min && value <= condition.max) return agenda.points * 0.65;
    return Math.max(0, agenda.points * 0.45 - Math.min(Math.abs(value - condition.min), Math.abs(value - condition.max)));
  }
  if (condition.kind === 'noExtremePolicies') {
    const nonExtremeCount = Object.values(state.policyTracks).filter((value) => Math.abs(value) < 2).length;
    return (nonExtremeCount / POLICY_TRACKS.length) * agenda.points * 0.7;
  }
  if (condition.kind === 'influenceLeader' || condition.kind === 'notInfluenceLeader') {
    const mine = state.players.find((p) => p.id === playerId)?.influenceMarkers[condition.group] ?? 0;
    return Math.min(agenda.points * 0.6, mine * 1.2);
  }
  if (condition.kind === 'influenceLeaderAny') {
    const mine = condition.groups.reduce((best, group) => Math.max(best, state.players.find((p) => p.id === playerId)?.influenceMarkers[group] ?? 0), 0);
    return Math.min(agenda.points * 0.6, mine * 1.1);
  }
  if (condition.kind === 'candidateWon' || condition.kind === 'candidateWonAtMost') {
    const won = state.roundHistory.some((h) => h.winnerCandidateId === condition.candidateId);
    return won ? agenda.points : 0;
  }
  if (condition.kind === 'reputationAtLeast') {
    const reputation = state.players.find((p) => p.id === playerId)?.reputation ?? 0;
    return Math.min(agenda.points * 0.65, (reputation / condition.minAmount) * agenda.points * 0.65);
  }
  if (condition.kind === 'remainingMoneyAtLeast') {
    const money = state.players.find((p) => p.id === playerId)?.money ?? 0;
    return Math.min(agenda.points * 0.65, (money / condition.minAmount) * agenda.points * 0.65);
  }
  return 0;
}

function backedCandidateScore(state: GameState, catalog: CardCatalog, playerId: PlayerId, candidateId: CandidateId): number {
  const camp = state.round.camps[candidateId];
  const candidate = catalog.candidates[candidateId];
  const preference = playerAgendaPreference(state, catalog, playerId);
  let score = (candidate?.baseVotes ?? 0) * 0.2;
  if (camp?.majorBacker === playerId) score += 5;
  if (camp?.coBacker === playerId || camp?.organizer === playerId) score += 2;
  if (preference.candidateId === candidateId) score += 6;
  if (preference.group && candidate?.supportedVoterGroups.includes(preference.group)) score += 2;
  return score;
}

function currentLeader(state: GameState, catalog: CardCatalog): CandidateId | null {
  const breakdown = computeVoteBreakdown(state, catalog);
  return (
    [...state.round.candidatesRunning].sort((a, b) => {
      const diff = (breakdown[b]?.total ?? 0) - (breakdown[a]?.total ?? 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    })[0] ?? null
  );
}

function voterScore(state: GameState, catalog: CardCatalog, playerId: PlayerId, voterId: VoterId): number {
  const voter = catalog.voters[voterId];
  const preference = playerAgendaPreference(state, catalog, playerId);
  if (!voter) return 0;
  let score = voter.voteWeight * 0.8;
  if (preference.group === voter.group) score += 3;
  if (getVoterController(state.round.voterInfluence, voterId) === playerId) score += 1;
  return score;
}

/** 특정 플레이어 관점의 상태 가치. 최종 결과 전에는 공개 VP·자원·의제 잠재력·후보 영향력을 섞어 근사한다. */
export function evaluateStateForPlayer(state: GameState, catalog: CardCatalog, playerId: PlayerId): number {
  const finalEntry = state.finalResult?.entries.find((entry) => entry.playerId === playerId);
  if (finalEntry) return finalEntry.total * 10 - (finalEntry.rank - 1) * 5;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return Number.NEGATIVE_INFINITY;

  const resources = player.money * 0.12 + player.organization * 0.2 + player.reputation * 0.5;
  const camps = state.round.candidatesRunning.reduce<number>(
    (sum, candidateId) => sum + backedCandidateScore(state, catalog, playerId, candidateId),
    0,
  );
  return player.victoryPoints * 8 + resources + camps + agendaProgressScore(state, catalog, playerId);
}

function policyAlignmentScore(state: GameState, catalog: CardCatalog, playerId: PlayerId, track: string, direction: PolicyDirection): number {
  const preference = playerAgendaPreference(state, catalog, playerId);
  if (preference.track !== track) return 0;
  if (!preference.direction) return 0.8;
  return preference.direction === direction ? 3 : -2;
}

function scoreActionBias(state: GameState, catalog: CardCatalog, playerId: PlayerId, action: GameAction): number {
  const preference = playerAgendaPreference(state, catalog, playerId);
  if (!('actor' in action) || action.actor !== playerId) return 0;

  if (action.type === 'placeBid') {
    const existingKey = allocationsKey(state.round.bids[playerId]?.allocations);
    const nextKey = allocationsKey(action.allocations);
    if (existingKey === nextKey) return -100;
    const [candidateId] = Object.keys(action.allocations) as CandidateId[];
    const total = actionBidTotal(action);
    const candidateScore = candidateId ? backedCandidateScore(state, catalog, playerId, candidateId) : 0;
    return 1 + candidateScore + total * (preference.conserveMoney ? 0.05 : 0.25);
  }

  if (action.type === 'confirmAuctionBids') {
    let total = 0;
    for (const amount of Object.values(state.round.bids[playerId]?.allocations ?? {})) {
      total += amount ?? 0;
    }
    return total > 0 ? 9 + total * 0.1 : 0.2;
  }

  if (action.type === 'selectPromise') {
    const promise = catalog.promises[action.promiseId];
    if (!promise) return 0;
    const effectBonus =
      promise.effect.kind === 'backerReward'
        ? promise.effect.amount * (promise.effect.resource === 'victoryPoints' ? 2 : 0.4)
        : promise.effect.kind === 'backerInfluence'
          ? promise.effect.amount * (preference.group === promise.effect.group ? 2 : 0.8)
          : promise.effect.kind === 'backerPressureToken'
            ? policyAlignmentScore(state, catalog, playerId, promise.effect.track, promise.effect.direction) + promise.effect.amount
            : promise.effect.amount * 0.8;
    return effectBonus + policyAlignmentScore(state, catalog, playerId, promise.policyMove.track, promise.policyMove.direction);
  }

  if (action.type === 'contactVoter') return voterScore(state, catalog, playerId, action.voterId);
  if (action.type === 'assignVoterChoice') return voterScore(state, catalog, playerId, action.voterId) + backedCandidateScore(state, catalog, playerId, action.candidateId);
  if (action.type === 'runAd') return backedCandidateScore(state, catalog, playerId, action.candidateId) + 1.5;
  if (action.type === 'conditionalSupport') return backedCandidateScore(state, catalog, playerId, action.candidateId) + 1;
  if (action.type === 'reportScandal') {
    const leader = currentLeader(state, catalog);
    const mine = state.round.camps[action.candidateId]?.majorBacker === playerId;
    return (leader === action.candidateId ? 5 : 1) - (mine ? 8 : 0);
  }
  if (action.type === 'pressurePolicy') return 1 + policyAlignmentScore(state, catalog, playerId, action.track, action.direction);
  if (action.type === 'fundraise') {
    const player = state.players.find((p) => p.id === playerId);
    return (player?.money ?? 0) <= 3 ? 4 : preference.conserveMoney ? 3 : 1;
  }
  if (action.type === 'poll') return 0.1;
  if (action.type === 'skipUnification') return 0.2;
  if (action.type === 'proposeUnification') return backedCandidateScore(state, catalog, playerId, action.leadCandidateId) + 1;
  if (action.type === 'acceptUnification') return 1.5;
  if (action.type === 'declineUnification') return 0.5;
  if (action.type === 'selectElectionPolicyMove') return 2 + policyAlignmentScore(state, catalog, playerId, action.track, action.direction);
  if (action.type === 'useEvent') return 1;
  return 0;
}

/** 액션 1개의 즉시 기대값. reducer 적용 후 상태 가치 변화와 도메인별 작은 편향을 합산한다. */
export function scoreAction(state: GameState, catalog: CardCatalog, playerId: PlayerId, action: GameAction): number {
  const result = reduce(state, action, catalog);
  if (!result.ok) return Number.NEGATIVE_INFINITY;
  const before = evaluateStateForPlayer(state, catalog, playerId);
  const after = evaluateStateForPlayer(result.state, catalog, playerId);
  return after - before + scoreActionBias(state, catalog, playerId, action);
}

function pickBestScoredAction(actions: GameAction[], scores: number[], rng: BotRng): GameAction {
  const best = Math.max(...scores);
  const winners = actions.filter((_, index) => scores[index] === best);
  return rng.pick(winners);
}

/** 합법 액션 목록에서 휴리스틱 점수가 가장 높은 액션을 고른다. */
export function chooseHeuristicAction(state: GameState, catalog: CardCatalog, actor: PlayerId, rng: BotRng): GameAction {
  const actions = legalActionsForActor(state, catalog, actor);
  if (actions.length === 0) {
    throw new Error(`선택 가능한 합법 액션이 없습니다 (phase=${state.phase}, actor=${actor})`);
  }
  const scores = actions.map((action) => scoreAction(state, catalog, actor, action));
  return pickBestScoredAction(actions, scores, rng);
}
