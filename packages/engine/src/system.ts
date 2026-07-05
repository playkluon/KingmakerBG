// 기반 스킬: skills/engine-core/SKILL.md
// 시스템 액션(§19) 처리 — runSystemStep, runUntilPlayerAction, advancePhase 및 나머지 시스템 액션.
// resolveAuction/autoSelectPromises는 Skill 4가, revealVoters는 Skill 5가,
// resolveVoting/resolvePolicy/runUnificationTest는 Skill 6이, scoreRound는 Skill 7이 실제 규칙을 제공한다.
// generateRandomBids만 스텁으로 남는다 (디버그 전용 — Phase 7 밸런스 시뮬레이션에서 필요 시 구현).
// catalog: resolveVoting/resolvePolicy/scoreRound처럼 카드 "내용"이 필요한 액션을 위해 체인 전체로 관통시킨다.
import { getPlayerCountConfig, INCOME_MONEY, INCOME_ORGANIZATION } from './constants';
import { appendLog, createLogEntry } from './log';
import { AUTO_PHASE_ACTION, getNextPhase, PHASES, SYSTEM_ACTION_PHASE } from './phases';
import type { AutoActionType } from './phases';
import { createInitialRoundState } from './roundState';
import { applyResolveAuctionAction } from './rules/auction';
import { computeFinalResult } from './rules/finalScoring';
import { applyResolvePolicyAction } from './rules/policy';
import { applyAutoSelectPromisesAction } from './rules/promise';
import { applyScoreRoundAction } from './rules/roundScoring';
import { applyRunUnificationTestAction } from './rules/unification';
import { applyRevealVotersAction } from './rules/voters';
import { applyResolveVotingAction } from './rules/voting';
import type { ReduceResult } from './result';
import type { CardCatalog } from './types/cards';
import type { AuctionMode, SystemAction } from './types/actions';
import type { ActionLogEntry, EffectDescriptor, GameState, RoundHistoryEntry } from './types/state';

const ok = (state: GameState, entry: ActionLogEntry): ReduceResult => ({ ok: true, state, log: [entry] });
const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** phase가 SYSTEM_ACTION_PHASE 표와 일치하는지 검증한다 (표에 없으면 통과) */
function checkExpectedPhase(state: GameState, type: SystemAction['type']): string | null {
  const expected = SYSTEM_ACTION_PHASE[type];
  if (expected && state.phase !== expected) {
    return `지금(${PHASES[state.phase].description})은 '${type}'을(를) 할 수 없습니다`;
  }
  return null;
}

/** §19 시스템 액션 16종의 단일 진입점 */
export function applySystemAction(state: GameState, action: SystemAction, catalog: CardCatalog): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return applyStartGame(state);
    case 'setAuctionMode':
      return applySetAuctionMode(state, action.mode);
    case 'advancePhase':
      return applyAdvancePhase(state);
    case 'revealIssue':
      return applyRevealIssue(state);
    case 'revealCandidates':
      return applyRevealCandidates(state);
    case 'nextRound':
      return applyNextRound(state, catalog);
    case 'runSystemStep':
      return applyRunSystemStep(state, catalog);
    case 'runUntilPlayerAction':
      return applyRunUntilPlayerAction(state, catalog);
    case 'resolveAuction':
      return applyResolveAuctionAction(state);
    case 'autoSelectPromises':
      return applyAutoSelectPromisesAction(state);
    case 'revealVoters':
      return applyRevealVotersAction(state);
    case 'runUnificationTest':
      return applyRunUnificationTestAction(state);
    case 'resolveVoting':
      return applyResolveVotingAction(state, catalog);
    case 'resolvePolicy':
      return applyResolvePolicyAction(state, catalog);
    case 'scoreRound':
      return applyScoreRoundAction(state, catalog);
    case 'generateRandomBids':
      return applyStubSystemAction(state, action.type);
    default: {
      const exhaustiveCheck: never = action;
      return fail(`알 수 없는 시스템 액션입니다: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

function applyStartGame(state: GameState): ReduceResult {
  const phaseError = checkExpectedPhase(state, 'startGame');
  if (phaseError) return fail(phaseError);
  const entry = createLogEntry(state, 'setup', null, 'startGame', '게임을 시작합니다');
  const next: GameState = { ...appendLog(state, entry), phase: 'income' };
  return ok(next, entry);
}

function applySetAuctionMode(state: GameState, mode: AuctionMode): ReduceResult {
  if (state.phase === 'gameEnd') return fail('게임이 이미 종료되었습니다');
  const label = mode === 'simultaneousBlind' ? '동시 비공개' : '공개 순차';
  const entry = createLogEntry(state, state.phase, null, 'setAuctionMode', `경매 방식을 ${label}(으)로 설정했습니다`);
  const next: GameState = { ...appendLog(state, entry), auctionMode: mode };
  return ok(next, entry);
}

/**
 * 전용 시스템 액션이 없는 자동 phase(income, auctionResolved)를 처리한다.
 * income은 §5 수입 지급을 실제로 수행하고, 그 외는 다음 phase로 통과시킨다.
 */
function applyAdvancePhase(state: GameState): ReduceResult {
  if (state.phase === 'setup') return fail("'setup' 단계는 'startGame'으로 시작해야 합니다");
  if (state.phase === 'cleanup') return fail("'cleanup' 단계는 'nextRound'로 진행해야 합니다");
  if (state.phase === 'gameEnd') return fail('게임이 이미 종료되었습니다');
  if (PHASES[state.phase].requiresPlayerDecision) {
    return fail(`'${PHASES[state.phase].description}' 단계는 플레이어 결정을 기다리는 중입니다`);
  }
  if (state.phase === 'income') {
    return applyIncome(state);
  }
  const nextPhase = getNextPhase(state.phase, state.round.round, state.maxRounds);
  const entry = createLogEntry(state, state.phase, null, 'advancePhase', `${PHASES[nextPhase].description} 단계로 넘어갑니다`);
  const next: GameState = { ...appendLog(state, entry), phase: nextPhase };
  return ok(next, entry);
}

/** §5 라운드 수입: money +5, organization +2, 후보 이벤트 1장 */
function applyIncome(state: GameState): ReduceResult {
  const deck = [...state.drawPiles.candidateEventDeck];
  const effects: EffectDescriptor[] = [];
  const players = state.players.map((p) => {
    const drawnEvent = deck.shift();
    effects.push({ target: p.id, field: 'money', delta: INCOME_MONEY });
    effects.push({ target: p.id, field: 'organization', delta: INCOME_ORGANIZATION });
    return {
      ...p,
      money: p.money + INCOME_MONEY,
      organization: p.organization + INCOME_ORGANIZATION,
      candidateEventHand: drawnEvent ? [...p.candidateEventHand, drawnEvent] : p.candidateEventHand,
    };
  });
  const nextPhase = getNextPhase('income', state.round.round, state.maxRounds);
  const entry = createLogEntry(
    state,
    'income',
    null,
    'advancePhase',
    `수입을 지급했습니다 (money +${INCOME_MONEY}, organization +${INCOME_ORGANIZATION})`,
    effects,
  );
  const next: GameState = {
    ...appendLog(state, entry),
    players,
    drawPiles: { ...state.drawPiles, candidateEventDeck: deck },
    phase: nextPhase,
  };
  return ok(next, entry);
}

function applyRevealIssue(state: GameState): ReduceResult {
  const phaseError = checkExpectedPhase(state, 'revealIssue');
  if (phaseError) return fail(phaseError);
  const deck = [...state.drawPiles.issueDeck];
  const issueId = deck.shift() ?? null;
  const nextPhase = getNextPhase('issueReveal', state.round.round, state.maxRounds);
  const entry = createLogEntry(
    state,
    'issueReveal',
    null,
    'revealIssue',
    issueId ? '이슈가 공개되었습니다' : '공개할 이슈가 남아있지 않습니다',
    issueId ? [{ target: 'game', field: 'issueId', after: issueId }] : [],
  );
  const next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, issueId },
    drawPiles: { ...state.drawPiles, issueDeck: deck },
    phase: nextPhase,
  };
  return ok(next, entry);
}

function applyRevealCandidates(state: GameState): ReduceResult {
  const phaseError = checkExpectedPhase(state, 'revealCandidates');
  if (phaseError) return fail(phaseError);
  const config = getPlayerCountConfig(state.players.length);
  const deck = [...state.drawPiles.candidateDeck];
  const revealed = deck.splice(0, config.revealedCandidates);
  const nextPhase = getNextPhase('candidateReveal', state.round.round, state.maxRounds);
  const entry = createLogEntry(
    state,
    'candidateReveal',
    null,
    'revealCandidates',
    `후보 ${revealed.length}명이 공개되었습니다`,
    [{ target: 'game', field: 'candidatesRevealed', after: revealed.length }],
  );
  const next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, candidatesRevealed: revealed },
    drawPiles: { ...state.drawPiles, candidateDeck: deck },
    phase: nextPhase,
  };
  return ok(next, entry);
}

/**
 * cleanup -> (income | gameEnd).
 * ① RoundHistoryEntry 영구 기록 (§17 비밀 의제 평가의 유일한 근거 데이터 — skills/scoring)
 * ② 마지막 라운드면 §16 최종 점수를 계산해 finalResult에 저장
 * ③ 아니면 라운드 번호 증가 + RoundState 리셋
 */
function applyNextRound(state: GameState, catalog: CardCatalog): ReduceResult {
  const phaseError = checkExpectedPhase(state, 'nextRound');
  if (phaseError) return fail(phaseError);

  const isLastRound = state.round.round >= state.maxRounds;
  const nextPhase = isLastRound ? 'gameEnd' : 'income';
  const nextRoundNumber = state.round.round + 1;

  const historyEntry: RoundHistoryEntry = {
    round: state.round.round,
    winnerCandidateId: state.round.winnerCandidateId,
    candidateVotes: state.lastRoundResult?.candidateVotes ?? {},
    policyTracksAfter: { ...state.policyTracks },
    vpAwarded: state.round.vpAwardedThisRound,
    influenceMarkersAwarded: state.round.markersAwardedThisRound,
  };

  const entry = createLogEntry(
    state,
    'cleanup',
    null,
    'nextRound',
    isLastRound ? '게임이 종료되었습니다 — 최종 점수를 공개합니다' : `${nextRoundNumber}라운드를 시작합니다`,
  );

  let next: GameState = {
    ...appendLog(state, entry),
    phase: nextPhase,
    roundHistory: [...state.roundHistory, historyEntry],
    round: isLastRound ? state.round : createInitialRoundState(nextRoundNumber),
  };

  if (isLastRound) {
    // finalResult는 히스토리가 확정된 다음 상태를 기준으로 계산한다 (candidateWon류가 마지막 라운드도 봐야 하므로)
    next = { ...next, finalResult: computeFinalResult(next, catalog) };
  }

  return ok(next, entry);
}

/**
 * Skill 7이 실제 규칙으로 교체할 스텁.
 * 검증(phase 일치)은 실제로 수행하되, 내용은 TODO 로그만 남기고 다음 phase로 통과시킨다
 * — 그래야 phase 머신 전체가 콘텐츠 없이도 끝까지 걸을 수 있다 (Phase 1의 목적).
 */
function applyStubSystemAction(state: GameState, type: SystemAction['type']): ReduceResult {
  const phaseError = checkExpectedPhase(state, type);
  if (phaseError) return fail(phaseError);
  const nextPhase = getNextPhase(state.phase, state.round.round, state.maxRounds);
  const entry = createLogEntry(state, state.phase, null, type, `'${type}' 처리는 아직 구현되지 않았습니다 (스텁)`);
  const next: GameState = { ...appendLog(state, entry), phase: nextPhase };
  return ok(next, entry);
}

/** 자동 phase 하나를 진행한다. 대기가 필요하면 ok:false로 그 사유를 알린다 */
function applyRunSystemStep(state: GameState, catalog: CardCatalog): ReduceResult {
  if (state.phase === 'setup') return fail("'setup' 단계는 'startGame'으로 시작해야 합니다");
  if (state.phase === 'gameEnd') return fail('게임이 이미 종료되어 더 진행할 단계가 없습니다');
  if (PHASES[state.phase].requiresPlayerDecision) {
    return fail(`'${PHASES[state.phase].description}' 단계는 플레이어 결정을 기다리는 중입니다`);
  }
  const actionType: AutoActionType | undefined = AUTO_PHASE_ACTION[state.phase];
  if (!actionType) return fail(`'${state.phase}' 단계는 자동 진행할 수 없습니다`);
  // AUTO_PHASE_ACTION의 모든 값은 페이로드 없는 시스템 액션이다 (setAuctionMode 제외 대상)
  return applySystemAction(state, { type: actionType } as SystemAction, catalog);
}

/**
 * 자동 처리 가능한 phase를 연쇄 진행하고 플레이어 결정 지점에서 멈춘다 (§19).
 * confirmAuctionBids·selectPromise 등 개별 액션은 자기 몫만 처리하고 멈춘다 —
 * 그다음 자동 phase까지 이어서 진행하고 싶을 때 호출자가 이 함수(또는 runUntilPlayerAction 액션)를 별도로 호출한다.
 */
export function runAutoPhases(state: GameState, catalog: CardCatalog): { state: GameState; log: ActionLogEntry[] } {
  let current = state;
  const log: ActionLogEntry[] = [];
  // 무한 루프 방지 안전장치. 라운드당 자동 phase는 최대 9개 남짓이라 5라운드 기준으로도 충분히 크다.
  const SAFETY_LIMIT = 200;

  for (let i = 0; i < SAFETY_LIMIT; i += 1) {
    if (current.phase === 'setup' || current.phase === 'gameEnd') break;
    if (PHASES[current.phase].requiresPlayerDecision) break;
    const actionType = AUTO_PHASE_ACTION[current.phase];
    if (!actionType) break;
    const result = applySystemAction(current, { type: actionType } as SystemAction, catalog);
    if (!result.ok) break;
    current = result.state;
    log.push(...result.log);
  }

  return { state: current, log };
}

/** 이미 결정 지점이거나 종료 상태여도 실패가 아니라 빈 로그로 성공 처리한다 — "진행" 버튼은 언제 눌러도 안전해야 한다. */
function applyRunUntilPlayerAction(state: GameState, catalog: CardCatalog): ReduceResult {
  const { state: nextState, log } = runAutoPhases(state, catalog);
  return { ok: true, state: nextState, log };
}
