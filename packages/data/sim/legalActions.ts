// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// AI/시뮬레이션용 합법 액션 후보 생성기. 실제 합법성 최종 판정은 항상 engine reducer에 위임한다.
import {
  POLICY_TRACKS,
  computeTransferRatio,
  getVoterController,
  reduce,
  type CardCatalog,
  type CandidateId,
  type EventId,
  type GameAction,
  type GameState,
  type PlayerId,
  type PolicyDirection,
  type VoterId,
} from '@kingmakers/engine';

const DEFAULT_MAX_BID = 6;
const POLICY_DIRECTIONS: readonly PolicyDirection[] = [-1, 1];

export interface LegalActionOptions {
  /** 경매 후보 생성 시 봇이 한 라운드에 태울 수 있는 최대 금액. 학습 탐색 폭을 제한한다. */
  maxBid?: number;
  /** true면 reducer 검증 전 후보까지 반환한다. 디버깅 외에는 false가 기본이다. */
  includeReducerRejected?: boolean;
}

/** 액션을 가상 적용해 reducer가 받아들이는 후보만 남긴다. */
function filterLegalActions(
  state: GameState,
  catalog: CardCatalog,
  actions: GameAction[],
  includeRejected: boolean,
): GameAction[] {
  if (includeRejected) return actions;
  return actions.filter((action) => reduce(state, action, catalog).ok);
}

function uniqueActors(ids: PlayerId[]): PlayerId[] {
  return [...new Set(ids)];
}

function currentPlayer(state: GameState, actor: PlayerId) {
  return state.players.find((p) => p.id === actor);
}

function controlledVoters(state: GameState, actor: PlayerId): VoterId[] {
  return state.round.votersRevealed.filter((voterId) => getVoterController(state.round.voterInfluence, voterId) === actor);
}

function campaignEventActions(state: GameState, actor: PlayerId): GameAction[] {
  const player = currentPlayer(state, actor);
  if (!player) return [];
  const eventIds: EventId[] = [...player.candidateEventHand, ...player.voterEventHand];
  const actions: GameAction[] = [];

  for (const eventId of eventIds) {
    for (const targetCandidateId of state.round.candidatesRunning) {
      actions.push({ type: 'useEvent', actor, eventId, targetCandidateId });
    }
    actions.push({ type: 'useEvent', actor, eventId });
  }

  return actions;
}

function auctionActions(state: GameState, actor: PlayerId, maxBid: number): GameAction[] {
  const player = currentPlayer(state, actor);
  if (!player || state.round.bids[actor]?.confirmed) return [];
  if (Object.keys(state.round.bids[actor]?.allocations ?? {}).length > 0) {
    return [{ type: 'confirmAuctionBids', actor }];
  }

  const bidLimit = Math.max(0, Math.min(player.money, maxBid));
  const bidAmounts = [...new Set([0, 1, 2, 3, 4, 5, bidLimit].filter((n) => n >= 0 && n <= bidLimit))].sort(
    (a, b) => a - b,
  );
  const actions: GameAction[] = [{ type: 'confirmAuctionBids', actor }];

  for (const candidateId of state.round.candidatesRevealed) {
    for (const amount of bidAmounts) {
      if (amount <= 0) continue;
      actions.push({ type: 'placeBid', actor, allocations: { [candidateId]: amount } });
    }
  }

  // 2후보 분산 입찰은 탐색 폭을 너무 키우지 않는 선에서 최소 후보쌍만 만든다.
  for (let i = 0; i < state.round.candidatesRevealed.length; i += 1) {
    for (let j = i + 1; j < state.round.candidatesRevealed.length; j += 1) {
      const first = state.round.candidatesRevealed[i];
      const second = state.round.candidatesRevealed[j];
      if (!first || !second || bidLimit < 2) continue;
      actions.push({ type: 'placeBid', actor, allocations: { [first]: Math.ceil(bidLimit / 2), [second]: Math.floor(bidLimit / 2) } });
    }
  }

  return actions;
}

function promiseActions(state: GameState, actor: PlayerId): GameAction[] {
  return state.round.candidatesRunning.flatMap((candidateId) => {
    const camp = state.round.camps[candidateId];
    if (!camp || camp.majorBacker !== actor || camp.promiseId) return [];
    return camp.promiseOptions.map((promiseId): GameAction => ({ type: 'selectPromise', actor, candidateId, promiseId }));
  });
}

function campaignActions(state: GameState, actor: PlayerId): GameAction[] {
  const activeActor = state.round.campaignTurnOrder[state.round.campaignActiveIndex];
  const turnActions: GameAction[] =
    activeActor === actor
      ? [
          ...state.round.votersRevealed.map((voterId): GameAction => ({ type: 'contactVoter', actor, voterId })),
          ...state.round.candidatesRunning.map((candidateId): GameAction => ({ type: 'runAd', actor, candidateId })),
          ...POLICY_TRACKS.flatMap((track) =>
            POLICY_DIRECTIONS.map((direction): GameAction => ({ type: 'pressurePolicy', actor, track, direction })),
          ),
          { type: 'fundraise', actor },
          ...state.round.candidatesRunning.map((candidateId): GameAction => ({ type: 'reportScandal', actor, candidateId })),
          ...state.round.candidatesRunning.map((candidateId): GameAction => ({ type: 'conditionalSupport', actor, candidateId })),
          { type: 'poll', actor },
        ]
      : [];

  // 배치는 무한 재배치 루프를 피하려고 아직 배치하지 않은 유권자만 후보로 낸다.
  const assignmentActions = controlledVoters(state, actor).flatMap((voterId) => {
    if (state.round.voterAssignments[voterId]) return [];
    return state.round.candidatesRunning.map((candidateId): GameAction => ({ type: 'assignVoterChoice', actor, voterId, candidateId }));
  });

  return [...assignmentActions, ...campaignEventActions(state, actor), ...turnActions];
}

function unificationActions(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction[] {
  const proposal = state.round.pendingUnificationProposal;
  if (proposal) {
    const withdrawBacker = state.round.camps[proposal.withdrawCandidateId]?.majorBacker;
    if (withdrawBacker !== actor) return [];
    return [
      { type: 'acceptUnification', actor },
      { type: 'declineUnification', actor },
    ];
  }

  if (state.round.unificationDone[actor]) return [];
  const leadCandidates = state.round.candidatesRunning.filter((candidateId) => state.round.camps[candidateId]?.majorBacker === actor);
  if (leadCandidates.length === 0) return [];

  const actions: GameAction[] = [{ type: 'skipUnification', actor }];
  for (const leadCandidateId of leadCandidates) {
    for (const withdrawCandidateId of state.round.candidatesRunning) {
      if (leadCandidateId === withdrawCandidateId) continue;
      if (!state.round.camps[withdrawCandidateId]?.majorBacker) continue;
      if (computeTransferRatio(state, catalog, leadCandidateId, withdrawCandidateId) === null) continue;
      actions.push({ type: 'proposeUnification', actor, leadCandidateId, withdrawCandidateId });
    }
  }
  return actions;
}

function electionEffectActions(state: GameState, catalog: CardCatalog, actor: PlayerId): GameAction[] {
  const winner = state.round.winnerCandidateId;
  if (!winner || state.round.electionEffectResolution) return [];
  if (state.round.camps[winner]?.majorBacker !== actor) return [];

  const effect = catalog.candidates[winner]?.electionEffect;
  if (!effect) return [];
  if (effect.kind === 'choosePolicyMove') {
    return effect.options.map((option): GameAction => ({ type: 'selectElectionPolicyMove', actor, ...option }));
  }
  if (effect.kind === 'flexPolicyMove') {
    return POLICY_TRACKS.flatMap((track) =>
      POLICY_DIRECTIONS.map((direction): GameAction => ({ type: 'selectElectionPolicyMove', actor, track, direction })),
    );
  }
  return [];
}

/** 현재 phase에서 의사결정권을 가진 플레이어 목록을 좌석/룰 순서대로 반환한다. */
export function getDecisionActors(state: GameState): PlayerId[] {
  if (state.phase === 'auctionBidding') {
    return state.players.filter((p) => !state.round.bids[p.id]?.confirmed).map((p) => p.id);
  }
  if (state.phase === 'promiseSelection') {
    return uniqueActors(
      state.round.candidatesRunning
        .map((candidateId) => {
          const camp = state.round.camps[candidateId];
          return camp && !camp.promiseId ? camp.majorBacker : null;
        })
        .filter((id): id is PlayerId => id != null),
    );
  }
  if (state.phase === 'campaignActions') {
    const activeActor = state.round.campaignTurnOrder[state.round.campaignActiveIndex];
    return activeActor ? [activeActor] : [];
  }
  if (state.phase === 'unification') {
    const proposal = state.round.pendingUnificationProposal;
    if (proposal) {
      const withdrawBacker = state.round.camps[proposal.withdrawCandidateId]?.majorBacker;
      return withdrawBacker ? [withdrawBacker] : [];
    }
    return uniqueActors(
      state.round.candidatesRunning
        .map((candidateId) => state.round.camps[candidateId]?.majorBacker)
        .filter((id): id is PlayerId => id != null && !state.round.unificationDone[id]),
    );
  }
  if (state.phase === 'electionEffectSelection') {
    const winner = state.round.winnerCandidateId;
    const actor = winner ? state.round.camps[winner]?.majorBacker : null;
    return actor && !state.round.electionEffectResolution ? [actor] : [];
  }
  return [];
}

/** 특정 플레이어가 지금 낼 수 있는 핵심 액션 후보를 reducer 기준으로 검증해 반환한다. */
export function legalActionsForActor(
  state: GameState,
  catalog: CardCatalog,
  actor: PlayerId,
  options: LegalActionOptions = {},
): GameAction[] {
  const maxBid = options.maxBid ?? DEFAULT_MAX_BID;
  const candidates =
    state.phase === 'auctionBidding'
      ? auctionActions(state, actor, maxBid)
      : state.phase === 'promiseSelection'
        ? promiseActions(state, actor)
        : state.phase === 'campaignActions'
          ? campaignActions(state, actor)
          : state.phase === 'unification'
            ? unificationActions(state, catalog, actor)
            : state.phase === 'electionEffectSelection'
              ? electionEffectActions(state, catalog, actor)
              : [];

  return filterLegalActions(state, catalog, candidates, options.includeReducerRejected ?? false);
}

/** 현재 상태에서 다음 의사결정자들의 합법 액션을 한 번에 조회한다. */
export function legalActionsForState(
  state: GameState,
  catalog: CardCatalog,
  options: LegalActionOptions = {},
): Array<{ actor: PlayerId; actions: GameAction[] }> {
  return getDecisionActors(state).map((actor) => ({ actor, actions: legalActionsForActor(state, catalog, actor, options) }));
}
