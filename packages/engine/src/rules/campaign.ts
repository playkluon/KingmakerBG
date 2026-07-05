// 기반 스킬: skills/voters-campaign/SKILL.md
// §11 캠페인 액션 7종 — 좌석 순 라운드로빈, 자원 검증, MVP 활성 후보 능력 3종 반영
import { CAMPAIGN_ACTION_COSTS, CAMPAIGN_ACTIONS_PER_PLAYER, clampResourceFloor, POLL_ENABLED } from '../constants';
import type { CampaignActionCost } from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import { computeVoteBreakdown } from './voting';
import type { ReduceResult } from '../result';
import type { CandidateAbility, CardCatalog } from '../types/cards';
import type { GameAction, PlayerAction } from '../types/actions';
import type { PlayerId } from '../types/ids';
import type { EffectDescriptor, GameState } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 지금이 이 플레이어의 캠페인 액션 차례인지 확인한다 (§11 라운드로빈) */
function checkTurn(state: GameState, actor: PlayerId): string | null {
  const current = state.round.campaignTurnOrder[state.round.campaignActiveIndex];
  return current === actor ? null : '지금은 당신의 차례가 아닙니다';
}

/** actor가 majorBacker인 출마 후보들의 활성 능력만 모은다 (§11) */
function myActiveAbilities(state: GameState, catalog: CardCatalog, actor: PlayerId): CandidateAbility[] {
  return state.round.candidatesRunning
    .filter((id) => state.round.camps[id]?.majorBacker === actor)
    .map((id) => catalog.candidates[id])
    .filter((c): c is NonNullable<typeof c> => c != null)
    .flatMap((c) => c.abilities)
    .filter((a) => a.active);
}

function fundraiseBonusFor(state: GameState, catalog: CardCatalog, actor: PlayerId): number {
  const ability = myActiveAbilities(state, catalog, actor).find((a) => a.kind === 'fundraiseBonus');
  return ability && ability.kind === 'fundraiseBonus' ? ability.amount : 0;
}

function voterContactDiscountFor(state: GameState, catalog: CardCatalog, actor: PlayerId, group: string): number {
  const ability = myActiveAbilities(state, catalog, actor).find((a) => a.kind === 'voterContactDiscount' && a.group === group);
  return ability && ability.kind === 'voterContactDiscount' ? ability.amount : 0;
}

function policyPressureDiscountFor(state: GameState, catalog: CardCatalog, actor: PlayerId): number {
  const ability = myActiveAbilities(state, catalog, actor).find((a) => a.kind === 'policyPressureDiscount');
  return ability && ability.kind === 'policyPressureDiscount' ? ability.amount : 0;
}

/**
 * 턴을 소모하는 6개 캠페인 액션이 공유하는 처리 골격.
 * 차례 검증 -> 자원 검증·차감 -> 효과 적용(mutate) -> 로그 -> 라운드로빈 전진 -> 전원 소진 시 단일화로.
 */
function runTurnAction(
  state: GameState,
  actor: PlayerId,
  cost: CampaignActionCost,
  actionType: GameAction['type'],
  summary: string,
  effects: EffectDescriptor[],
  mutate: (state: GameState) => GameState,
): ReduceResult {
  const turnError = checkTurn(state, actor);
  if (turnError) return fail(turnError);

  const player = state.players.find((p) => p.id === actor)!;
  if ((cost.money ?? 0) > player.money) return fail('자금이 부족합니다');
  if ((cost.organization ?? 0) > player.organization) return fail('조직력이 부족합니다');
  if ((cost.reputation ?? 0) > player.reputation) return fail('평판이 부족합니다');

  const deducted: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === actor
        ? {
            ...p,
            money: clampResourceFloor(p.money - (cost.money ?? 0)),
            organization: clampResourceFloor(p.organization - (cost.organization ?? 0)),
            reputation: clampResourceFloor(p.reputation - (cost.reputation ?? 0)),
          }
        : p,
    ),
  };

  const mutated = mutate(deducted);
  const usedCount = (mutated.round.campaignActionsUsed[actor] ?? 0) + 1;
  const nextIndex = (mutated.round.campaignActiveIndex + 1) % mutated.round.campaignTurnOrder.length;

  const entry = createLogEntry(state, 'campaignActions', actor, actionType, summary, effects);
  let next: GameState = {
    ...appendLog(mutated, entry),
    round: {
      ...mutated.round,
      campaignActionsUsed: { ...mutated.round.campaignActionsUsed, [actor]: usedCount },
      campaignActiveIndex: nextIndex,
    },
  };

  const allDone = next.players.every((p) => (next.round.campaignActionsUsed[p.id] ?? 0) >= CAMPAIGN_ACTIONS_PER_PLAYER);
  if (allDone) {
    next = { ...next, phase: getNextPhase('campaignActions', next.round.round, next.maxRounds) };
  }

  return { ok: true, state: next, log: [entry] };
}

export function applyContactVoter(
  state: GameState,
  action: Extract<PlayerAction, { type: 'contactVoter' }>,
  catalog: CardCatalog,
): ReduceResult {
  if (!state.round.votersRevealed.includes(action.voterId)) return fail('공개되지 않은 유권자입니다');
  const player = state.players.find((p) => p.id === action.actor)!;
  const voterCard = catalog.voters[action.voterId];
  const discount = voterCard ? voterContactDiscountFor(state, catalog, action.actor, voterCard.group) : 0;
  const cost: CampaignActionCost = { organization: Math.max(0, (CAMPAIGN_ACTION_COSTS.contactVoter.organization ?? 0) - discount) };
  const effects: EffectDescriptor[] = [{ target: action.voterId, field: 'influence', delta: 2 }];

  return runTurnAction(state, action.actor, cost, 'contactVoter', `${player.name}이(가) 유권자에게 접촉했습니다`, effects, (s) => ({
    ...s,
    round: {
      ...s.round,
      voterInfluence: {
        ...s.round.voterInfluence,
        [action.voterId]: {
          ...s.round.voterInfluence[action.voterId],
          [action.actor]: (s.round.voterInfluence[action.voterId]?.[action.actor] ?? 0) + 2,
        },
      },
    },
  }));
}

export function applyRunAd(state: GameState, action: Extract<PlayerAction, { type: 'runAd' }>): ReduceResult {
  if (!state.round.candidatesRunning.includes(action.candidateId)) return fail('출마하지 않은 후보입니다');
  const player = state.players.find((p) => p.id === action.actor)!;
  const effects: EffectDescriptor[] = [{ target: action.candidateId, field: 'campaignVotes', delta: 2 }];

  return runTurnAction(state, action.actor, CAMPAIGN_ACTION_COSTS.runAd, 'runAd', `${player.name}이(가) 광고를 집행했습니다`, effects, (s) => ({
    ...s,
    round: {
      ...s.round,
      campaignVotes: { ...s.round.campaignVotes, [action.candidateId]: (s.round.campaignVotes[action.candidateId] ?? 0) + 2 },
    },
  }));
}

export function applyPressurePolicy(
  state: GameState,
  action: Extract<PlayerAction, { type: 'pressurePolicy' }>,
  catalog: CardCatalog,
): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor)!;
  const discount = policyPressureDiscountFor(state, catalog, action.actor);
  const cost: CampaignActionCost = { organization: Math.max(0, (CAMPAIGN_ACTION_COSTS.pressurePolicy.organization ?? 0) - discount) };
  const key = action.direction === 1 ? 'plus' : 'minus';
  const effects: EffectDescriptor[] = [{ target: action.track, field: `pressure-${key}`, delta: 1 }];

  return runTurnAction(state, action.actor, cost, 'pressurePolicy', `${player.name}이(가) 정책 압박을 가했습니다`, effects, (s) => ({
    ...s,
    round: {
      ...s.round,
      policyPressure: {
        ...s.round.policyPressure,
        [action.track]: { ...s.round.policyPressure[action.track], [key]: s.round.policyPressure[action.track][key] + 1 },
      },
      pressureContributors: {
        ...s.round.pressureContributors,
        [action.track]: {
          ...s.round.pressureContributors[action.track],
          [action.direction]: [...(s.round.pressureContributors[action.track]?.[action.direction] ?? []), action.actor],
        },
      },
    },
  }));
}

export function applyFundraise(
  state: GameState,
  action: Extract<PlayerAction, { type: 'fundraise' }>,
  catalog: CardCatalog,
): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor)!;
  const grant = 4 + fundraiseBonusFor(state, catalog, action.actor);
  const effects: EffectDescriptor[] = [{ target: action.actor, field: 'money', delta: grant }];

  return runTurnAction(state, action.actor, CAMPAIGN_ACTION_COSTS.fundraise, 'fundraise', `${player.name}이(가) 모금했습니다`, effects, (s) => ({
    ...s,
    players: s.players.map((p) => (p.id === action.actor ? { ...p, money: p.money + grant } : p)),
  }));
}

export function applyReportScandal(state: GameState, action: Extract<PlayerAction, { type: 'reportScandal' }>): ReduceResult {
  if (!state.round.candidatesRunning.includes(action.candidateId)) return fail('출마하지 않은 후보입니다');
  const player = state.players.find((p) => p.id === action.actor)!;
  const effects: EffectDescriptor[] = [{ target: action.candidateId, field: 'campaignVotes', delta: -2 }];

  return runTurnAction(
    state,
    action.actor,
    CAMPAIGN_ACTION_COSTS.reportScandal,
    'reportScandal',
    `${player.name}이(가) 스캔들을 폭로했습니다`,
    effects,
    (s) => ({
      ...s,
      round: {
        ...s.round,
        campaignVotes: { ...s.round.campaignVotes, [action.candidateId]: (s.round.campaignVotes[action.candidateId] ?? 0) - 2 },
      },
    }),
  );
}

export function applyConditionalSupport(
  state: GameState,
  action: Extract<PlayerAction, { type: 'conditionalSupport' }>,
): ReduceResult {
  if (!state.round.candidatesRunning.includes(action.candidateId)) return fail('출마하지 않은 후보입니다');
  const player = state.players.find((p) => p.id === action.actor)!;
  const effects: EffectDescriptor[] = [{ target: action.candidateId, field: 'campaignVotes', delta: 1 }];

  return runTurnAction(
    state,
    action.actor,
    CAMPAIGN_ACTION_COSTS.conditionalSupport,
    'conditionalSupport',
    `${player.name}이(가) 조건부 지지를 선언했습니다`,
    effects,
    (s) => ({
      ...s,
      round: {
        ...s.round,
        campaignVotes: { ...s.round.campaignVotes, [action.candidateId]: (s.round.campaignVotes[action.candidateId] ?? 0) + 1 },
        conditionalSupporters: {
          ...s.round.conditionalSupporters,
          [action.candidateId]: [...(s.round.conditionalSupporters[action.candidateId] ?? []), action.actor],
        },
      },
    }),
  );
}

/**
 * 부록 A-18: 여론조사 — 현재 출마 후보들의 예상 득표(computeVoteBreakdown 총합)를 공개 로그로 발표한다.
 * "여론조사 발표"는 실제 정치에서도 결과가 공개되므로 요청자만 보는 게 아니라 summary로 전원에게 공개한다.
 */
export function applyPoll(state: GameState, action: Extract<PlayerAction, { type: 'poll' }>, catalog: CardCatalog): ReduceResult {
  if (!POLL_ENABLED) {
    return fail('poll(여론조사) 기능은 아직 비활성화되어 있습니다 (부록 A-4)');
  }
  const player = state.players.find((p) => p.id === action.actor)!;
  const breakdown = computeVoteBreakdown(state, catalog);
  const results = state.round.candidatesRunning
    .map((id) => `${catalog.candidates[id]?.name ?? id} ${breakdown[id]?.total ?? 0}표`)
    .join(', ');
  const summary = `${player.name}이(가) 여론조사를 실시했습니다 — ${results}`;

  return runTurnAction(state, action.actor, CAMPAIGN_ACTION_COSTS.poll, 'poll', summary, [], (s) => s);
}

/**
 * 부록 A-17: 이벤트 카드 사용 — assignVoterChoice/비밀 pact와 같은 성격으로 campaignActions 중 무료·차례 무관.
 * 후보/유권자 이벤트 손패 어느 쪽이든 eventId로 찾아 소모하고, 카드에 인쇄된 효과 3유형 중 하나를 적용한다.
 */
export function applyUseEvent(state: GameState, action: Extract<PlayerAction, { type: 'useEvent' }>, catalog: CardCatalog): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor)!;
  const fromCandidateHand = player.candidateEventHand.includes(action.eventId);
  const fromVoterHand = player.voterEventHand.includes(action.eventId);
  if (!fromCandidateHand && !fromVoterHand) {
    return fail('보유하지 않은 이벤트 카드입니다');
  }
  const card = fromCandidateHand ? catalog.candidateEvents[action.eventId] : catalog.voterEvents[action.eventId];
  if (!card) return fail('카드 정보를 찾을 수 없습니다');

  const effect = card.effect;
  const effects: EffectDescriptor[] = [];
  let round = state.round;
  let players = state.players;

  if (effect.kind === 'resourceDelta') {
    const resource = effect.resource;
    players = players.map((p) => (p.id === action.actor ? { ...p, [resource]: clampResourceFloor(p[resource] + effect.amount) } : p));
    effects.push({ target: action.actor, field: resource, delta: effect.amount });
  } else if (effect.kind === 'candidateVotesDelta') {
    const candidateId = action.targetCandidateId;
    if (!candidateId || !state.round.candidatesRunning.includes(candidateId)) {
      return fail('출마 중인 후보를 지정해야 합니다');
    }
    round = { ...round, campaignVotes: { ...round.campaignVotes, [candidateId]: (round.campaignVotes[candidateId] ?? 0) + effect.amount } };
    effects.push({ target: candidateId, field: 'campaignVotes', delta: effect.amount });
  } else if (effect.kind === 'groupInfluence') {
    const affectedVoters = state.round.votersRevealed.filter((id) => catalog.voters[id]?.group === effect.group);
    const voterInfluence = { ...round.voterInfluence };
    for (const voterId of affectedVoters) {
      const current = voterInfluence[voterId] ?? {};
      voterInfluence[voterId] = { ...current, [action.actor]: (current[action.actor] ?? 0) + effect.amount };
    }
    round = { ...round, voterInfluence };
    effects.push({ target: 'game', field: 'groupInfluence', delta: effect.amount, after: effect.group });
  }

  players = players.map((p) =>
    p.id === action.actor
      ? {
          ...p,
          candidateEventHand: p.candidateEventHand.filter((id) => id !== action.eventId),
          voterEventHand: p.voterEventHand.filter((id) => id !== action.eventId),
        }
      : p,
  );

  const entry = createLogEntry(
    state,
    'campaignActions',
    action.actor,
    'useEvent',
    `${player.name}이(가) 이벤트 카드 '${card.name}'을(를) 사용했습니다`,
    effects,
  );
  const next: GameState = { ...appendLog(state, entry), players, round };
  return { ok: true, state: next, log: [entry] };
}
