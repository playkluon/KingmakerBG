// 서버 권위 방식의 AI 참가자: AI 좌석 차례가 오면 서버가 합법 액션을 선택해 자동 진행한다.
import {
  POLICY_TRACKS,
  getPendingDecision,
  getVoterController,
  reduce,
  type ActionLogEntry,
  type CandidateId,
  type CardCatalog,
  type GameAction,
  type GameState,
  type PlayerId,
  type PolicyDirection,
} from '@kingmakers/engine';
import type { Room } from './rooms';

const POLICY_DIRECTIONS: readonly PolicyDirection[] = [-1, 1];
const MAX_AI_TURNS_PER_TICK = 500;

function aiActor(room: Room, actor: PlayerId): boolean {
  return room.players.some((p) => p.isAi && p.playerId === actor);
}

function nextAiActor(room: Room, state: GameState): PlayerId | null {
  const decision = getPendingDecision(state);
  if (!decision) return null;
  return decision.actors.find((actor) => aiActor(room, actor)) ?? null;
}

function legalAction(state: GameState, catalog: CardCatalog, actions: GameAction[]): GameAction | null {
  for (const action of actions) {
    if (reduce(state, action, catalog).ok) return action;
  }
  return null;
}

function playerState(state: GameState, actor: PlayerId) {
  return state.players.find((p) => p.id === actor);
}

function primaryCandidate(state: GameState, actor: PlayerId): CandidateId | null {
  return (
    state.round.candidatesRunning.find((candidateId) => state.round.camps[candidateId]?.majorBacker === actor) ??
    state.round.candidatesRunning.find((candidateId) => state.round.camps[candidateId]?.coBacker === actor) ??
    state.round.candidatesRunning[0] ??
    null
  );
}

function auctionAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const bid = state.round.bids[actor];
  if (bid?.confirmed) return null;
  if (Object.keys(bid?.allocations ?? {}).length > 0) return legalAction(state, catalog, [{ type: 'confirmAuctionBids', actor }]);

  const player = playerState(state, actor);
  const seatIndex = Math.max(0, state.players.findIndex((p) => p.id === actor));
  const target = state.round.candidatesRevealed[seatIndex % state.round.candidatesRevealed.length];
  if (!player || !target || player.money <= 0) return legalAction(state, catalog, [{ type: 'confirmAuctionBids', actor }]);
  const amount = Math.max(1, Math.min(player.money, 6, 3 + (seatIndex % 3)));
  return legalAction(state, catalog, [
    { type: 'placeBid', actor, allocations: { [target]: amount } },
    { type: 'confirmAuctionBids', actor },
  ]);
}

function promiseAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const actions: GameAction[] = [];
  for (const candidateId of state.round.candidatesRunning) {
    const camp = state.round.camps[candidateId];
    if (camp?.majorBacker !== actor || camp.promiseId) continue;
    for (const promiseId of camp.promiseOptions) {
      actions.push({ type: 'selectPromise', actor, candidateId, promiseId });
    }
  }
  return legalAction(state, catalog, actions);
}

function campaignAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const target = primaryCandidate(state, actor);
  const actions: GameAction[] = [];

  if (target) {
    for (const voterId of state.round.votersRevealed) {
      if (state.round.voterAssignments[voterId]) continue;
      if (getVoterController(state.round.voterInfluence, voterId) === actor) {
        actions.push({ type: 'assignVoterChoice', actor, voterId, candidateId: target });
      }
    }
    actions.push({ type: 'conditionalSupport', actor, candidateId: target });
    actions.push({ type: 'runAd', actor, candidateId: target });
  }

  actions.push({ type: 'fundraise', actor });
  for (const voterId of state.round.votersRevealed) {
    actions.push({ type: 'contactVoter', actor, voterId });
  }
  for (const track of POLICY_TRACKS) {
    for (const direction of POLICY_DIRECTIONS) {
      actions.push({ type: 'pressurePolicy', actor, track, direction });
    }
  }
  if (target) actions.push({ type: 'poll', actor });
  return legalAction(state, catalog, actions);
}

function unificationAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  if (state.round.pendingUnificationProposal) {
    return legalAction(state, catalog, [
      { type: 'declineUnification', actor },
      { type: 'acceptUnification', actor },
    ]);
  }
  return legalAction(state, catalog, [{ type: 'skipUnification', actor }]);
}

function electionEffectAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const winner = state.round.winnerCandidateId;
  if (!winner || state.round.camps[winner]?.majorBacker !== actor) return null;
  const effect = catalog.candidates[winner]?.electionEffect;
  const firstOption = effect?.kind === 'choosePolicyMove' ? effect.options[0] : null;
  return legalAction(state, catalog, [
    firstOption
      ? { type: 'selectElectionPolicyMove', actor, track: firstOption.track, direction: firstOption.direction }
      : { type: 'selectElectionPolicyMove', actor, track: POLICY_TRACKS[0]!, direction: 1 },
  ]);
}

function partySelectionAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const counts = new Map<string, number>();
  for (const p of state.players) {
    if (p.party) counts.set(p.party, (counts.get(p.party) ?? 0) + 1);
  }
  for (const party of Object.values(catalog.parties ?? {})) {
    if ((counts.get(party.id) ?? 0) < 2) {
      return legalAction(state, catalog, [{ type: 'selectParty', actor, partyId: party.id }]);
    }
  }
  return null;
}

function candidateProposalAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  const player = state.players.find((p) => p.id === actor);
  if (!player || player.hand.length === 0) return null;
  return legalAction(state, catalog, [{ type: 'proposeCandidate', actor, candidateId: player.hand[0]! }]);
}

function chooseAiAction(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction | null {
  if (state.phase === 'partySelection') return partySelectionAction(state, catalog, actor);
  if (state.phase === 'candidateProposal') return candidateProposalAction(state, catalog, actor);
  if (state.phase === 'auctionBidding') return auctionAction(state, catalog, actor);
  if (state.phase === 'promiseSelection') return promiseAction(state, catalog, actor);
  if (state.phase === 'campaignActions') return campaignAction(state, catalog, actor);
  if (state.phase === 'unification') return unificationAction(state, catalog, actor);
  if (state.phase === 'electionEffectSelection') return electionEffectAction(state, catalog, actor);
  return null;
}

export function runAiTurns(room: Room, catalog: CardCatalog): ActionLogEntry[] {
  const logs: ActionLogEntry[] = [];
  for (let guard = 0; guard < MAX_AI_TURNS_PER_TICK; guard += 1) {
    if (!room.game || room.game.phase === 'gameEnd') break;
    const actor = nextAiActor(room, room.game);
    if (!actor) break;

    const action = chooseAiAction(room.game, catalog, actor);
    if (!action) break;
    const result = reduce(room.game, action, catalog);
    if (!result.ok) break;

    const chained = reduce(result.state, { type: 'runUntilPlayerAction' }, catalog);
    room.game = chained.ok ? chained.state : result.state;
    logs.push(...result.log, ...(chained.ok ? chained.log : []));
  }
  return logs;
}
