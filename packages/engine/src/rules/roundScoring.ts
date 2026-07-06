// 기반 스킬: skills/scoring/SKILL.md
// §15 라운드 점수 (scoring v1) — 모든 VP는 effects[]에 사유를 남긴다 (§28)
import {
  clampResourceFloor,
  getPlayerCountConfig,
  SCORE_CO_BACKER_WIN,
  SCORE_CONDITIONAL_SUPPORT_SUCCESS,
  SCORE_KINGMAKER_BONUS,
  SCORE_MAJOR_BACKER_WIN,
  SCORE_ORGANIZER_WIN,
  SCORE_POLICY_PRESSURE_SUCCESS,
  SCORE_PROMISE_BONUS_MAJOR_BACKER,
  SCORE_RUNNER_UP_MAJOR_BACKER,
  SCORE_VOTER_SUPPORT_WINNER,
} from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import { computeVoterSupport } from './voters';
import { computeVoteBreakdown } from './voting';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { EventId, PlayerId } from '../types/ids';
import type { EffectDescriptor, GameState, PlayerState, SecretPact } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 부록 A-16: 제안자가 약속한 후보를 실제로 지지했는지 — majorBacker/coBacker이거나, 조건부 지지를 실행했거나, 유권자를 배정했으면 이행으로 본다 */
function isSecretPactHonored(
  state: GameState,
  pact: SecretPact,
  support: Partial<Record<string, { candidateId: string; controller: string | null; }>>
): boolean {
  const camp = state.round.camps[pact.promise.candidateId];
  if (camp?.majorBacker === pact.proposer || camp?.coBacker === pact.proposer) return true;
  if (state.round.conditionalSupporters[pact.promise.candidateId]?.includes(pact.proposer)) return true;
  
  for (const entry of Object.values(support)) {
    if (entry && entry.candidateId === pact.promise.candidateId && entry.controller === pact.proposer) {
      return true;
    }
  }
  return false;
}

/**
 * 부록 A-16: 비밀 pact 이행 여부를 판정해 배신 페널티(§12: rep −2, 유권자 이벤트 2장, 플래그)를 매긴다.
 * 이행됐으면 조용히 넘어간다 — 성사 자체를 축하하는 보상은 브리프에 없다.
 */
function settleSecretPacts(
  state: GameState,
  support: Partial<Record<string, { candidateId: string; controller: string | null; }>>,
  effects: EffectDescriptor[]
): { players: PlayerState[]; voterEventDeck: EventId[]; activeSecretPacts: SecretPact[] } {
  let players = state.players;
  const deck = [...state.drawPiles.voterEventDeck];
  for (const pact of state.round.activeSecretPacts) {
    if (isSecretPactHonored(state, pact, support)) continue;
    const drawn = [deck.shift(), deck.shift()].filter((id): id is EventId => id != null);
    players = players.map((p) => {
      if (p.id === pact.proposer) return { ...p, reputation: clampResourceFloor(p.reputation - 2), betrayedSecretPact: true };
      if (p.id === pact.counterparty) return { ...p, voterEventHand: [...p.voterEventHand, ...drawn] };
      return p;
    });
    effects.push({ target: pact.proposer, field: 'betrayedSecretPact', delta: -2 });
    effects.push({ target: pact.counterparty, field: 'voterEventHand', delta: drawn.length });
  }
  // 정산이 끝난 activeSecretPacts는 비운다 (다음 라운드에 유지되지 않음)
  return { players, voterEventDeck: deck, activeSecretPacts: [] };
}

/** §19 scoreRound — scoring v1 전 항목을 정산하고 §10 영향력 마커를 누적한다 */
export function applyScoreRoundAction(state: GameState, catalog: CardCatalog): ReduceResult {
  if (state.phase !== 'roundScoring') {
    return fail(`지금(${state.phase})은 'scoreRound'를 할 수 없습니다`);
  }

  const winner = state.round.winnerCandidateId;
  const config = getPlayerCountConfig(state.players.length);
  const breakdown = computeVoteBreakdown(state, catalog);
  const support = computeVoterSupport(state, catalog);

  const vpAwards = new Map<PlayerId, number>();
  const effects: EffectDescriptor[] = [];
  const award = (playerId: PlayerId, amount: number, field: string) => {
    vpAwards.set(playerId, (vpAwards.get(playerId) ?? 0) + amount);
    effects.push({ target: playerId, field, delta: amount });
  };

  // 부록 A-16: 비밀 pact 배신 판정을 먼저 정산한다 — VP·마커 반영은 이 결과 위에 이어 붙인다
  const pactSettlement = settleSecretPacts(state, support, effects);

  // 당선/2위 순위 (§13 표 합계 기준 — 동점 처리까지 재현할 필요 없이 총합만 비교하면 된다)
  const ranked = [...state.round.candidatesRunning].sort((a, b) => (breakdown[b]?.total ?? 0) - (breakdown[a]?.total ?? 0));
  const runnerUp = ranked[1];

  if (winner) {
    const camp = state.round.camps[winner];
    if (camp?.majorBacker) {
      award(camp.majorBacker, SCORE_MAJOR_BACKER_WIN, 'majorBackerWin');
      award(camp.majorBacker, SCORE_PROMISE_BONUS_MAJOR_BACKER, 'promiseBonus');
    }
    if (camp?.coBacker) award(camp.coBacker, SCORE_CO_BACKER_WIN, 'coBackerWin');
    if (camp?.organizer) award(camp.organizer, SCORE_ORGANIZER_WIN, 'organizerWin');

    for (const supporter of state.round.conditionalSupporters[winner] ?? []) {
      award(supporter, SCORE_CONDITIONAL_SUPPORT_SUCCESS, 'conditionalSupportSuccess');
    }
  }
  if (runnerUp) {
    const runnerCamp = state.round.camps[runnerUp];
    if (runnerCamp?.majorBacker) award(runnerCamp.majorBacker, SCORE_RUNNER_UP_MAJOR_BACKER, 'runnerUpMajorBacker');
  }

  // 정책 압박 성공 — resolvePolicy가 실제로 반영한 트랙·방향에 기여한 플레이어 전원
  for (const applied of state.round.pressureAppliedTracks) {
    for (const contributor of state.round.pressureContributors[applied.track]?.[applied.direction] ?? []) {
      award(contributor, SCORE_POLICY_PRESSURE_SUCCESS, 'policyPressureSuccess');
    }
  }

  // §10 영향력 마커(승패 무관, 표를 행사한 모든 통제 유권자) + §15 통제 유권자 지지 VP(당선 후보 한정, 상한 적용)
  const markerGains = new Map<PlayerId, Map<string, number>>();
  const voterSupportUsed = new Map<PlayerId, number>();
  for (const entry of Object.values(support)) {
    if (!entry || !entry.controller) continue;
    const groups = markerGains.get(entry.controller) ?? new Map<string, number>();
    groups.set(entry.group, (groups.get(entry.group) ?? 0) + 1);
    markerGains.set(entry.controller, groups);

    if (winner && entry.candidateId === winner) {
      const used = voterSupportUsed.get(entry.controller) ?? 0;
      if (used < config.voterSupportVpCap) {
        voterSupportUsed.set(entry.controller, used + 1);
        award(entry.controller, SCORE_VOTER_SUPPORT_WINNER, 'voterSupportWinner');
      }
    }
  }

  // 킹메이커 (6-7인, 표차 ≤2, 당선 후보의 majorBacker가 아닌 플레이어 중 유권자 표 최다 기여자)
  // 동점이면 아무에게도 주지 않는다 (브리프 미명시 — 임의 결정 대신 보수적으로 처리)
  if (winner && config.kingmakerBonusEnabled && runnerUp) {
    const margin = (breakdown[winner]?.total ?? 0) - (breakdown[runnerUp]?.total ?? 0);
    if (margin <= 2) {
      const winnerMajorBacker = state.round.camps[winner]?.majorBacker;
      const contribByPlayer = new Map<PlayerId, number>();
      for (const entry of Object.values(support)) {
        if (!entry || entry.candidateId !== winner || !entry.controller || entry.controller === winnerMajorBacker) continue;
        contribByPlayer.set(entry.controller, (contribByPlayer.get(entry.controller) ?? 0) + entry.amount);
      }
      const sorted = [...contribByPlayer.entries()].sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      const secondAmount = sorted[1]?.[1];
      if (top && top[1] > 0 && top[1] !== secondAmount) {
        award(top[0], SCORE_KINGMAKER_BONUS, 'kingmaker');
      }
    }
  }

  const players: PlayerState[] = pactSettlement.players.map((p) => {
    const gained = vpAwards.get(p.id) ?? 0;
    const groupGains = markerGains.get(p.id);
    const nextMarkers = { ...p.influenceMarkers };
    if (groupGains) {
      for (const [group, count] of groupGains) {
        nextMarkers[group] = (nextMarkers[group] ?? 0) + count;
      }
    }
    return gained === 0 && !groupGains ? p : { ...p, victoryPoints: p.victoryPoints + gained, influenceMarkers: nextMarkers };
  });

  // §10 이번 라운드 마커 스냅샷 (cleanup의 RoundHistoryEntry 기록용)
  const markersAwardedThisRound = Object.fromEntries(
    [...markerGains.entries()].map(([playerId, groups]) => [playerId, Object.fromEntries(groups)]),
  );

  // §28 "라운드 점수 이유가 플레이어별로 남는다" — RoundResultSummary.vpBreakdown 채우기
  const vpBreakdown = Object.fromEntries(
    [...vpAwards.entries()].map(([playerId, total]) => [
      playerId,
      { total, reasons: effects.filter((e) => e.target === playerId) },
    ]),
  );

  const nextPhase = getNextPhase('roundScoring', state.round.round, state.maxRounds);
  const entry = createLogEntry(state, 'roundScoring', null, 'scoreRound', '라운드 점수가 정산되었습니다', effects);
  const next: GameState = {
    ...appendLog(state, entry),
    players,
    drawPiles: { ...state.drawPiles, voterEventDeck: pactSettlement.voterEventDeck },
    round: {
      ...state.round,
      vpAwardedThisRound: Object.fromEntries(vpAwards),
      markersAwardedThisRound,
      activeSecretPacts: pactSettlement.activeSecretPacts,
    },
    lastRoundResult: state.lastRoundResult ? { ...state.lastRoundResult, vpBreakdown } : state.lastRoundResult,
    phase: nextPhase,
  };
  return { ok: true, state: next, log: [entry] };
}
