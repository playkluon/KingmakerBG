// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// AI 정책을 주입해 self-play를 끝까지 굴리고, 나중에 학습 데이터로 쓸 decision trace를 남긴다.
import { reduce, setupGame, type CardCatalog, type DrawPiles, type GameAction, type GameState, type PlayerId } from '@kingmakers/engine';
import { AGENDAS } from '../src/agendas';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { ISSUES } from '../src/issues';
import { PROMISES } from '../src/promises';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';
import { BotRng } from './bot';
import { chooseHeuristicAction, evaluateStateForPlayer } from './heuristic';
import { getDecisionActors, legalActionsForActor } from './legalActions';
import type { SimulationResult } from './simulate';

const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

export interface BotDecisionContext {
  state: GameState;
  catalog: CardCatalog;
  actor: PlayerId;
  legalActions: GameAction[];
  rng: BotRng;
  step: number;
}

export type BotPolicy = (context: BotDecisionContext) => GameAction;

export interface AiDecisionTrace {
  step: number;
  phase: GameState['phase'];
  actor: PlayerId;
  legalActionCount: number;
  action: GameAction;
  scoreBefore: number;
  scoreAfter: number;
}

export interface AiSimulationResult extends SimulationResult {
  decisions: AiDecisionTrace[];
}

function realDecks(): DrawPiles {
  return {
    candidateDeck: CANDIDATES.map((c) => c.id),
    promiseDeck: PROMISES.map((p) => p.id),
    voterDeck: VOTERS.map((v) => v.id),
    issueDeck: ISSUES.map((i) => i.id),
    candidateEventDeck: CANDIDATE_EVENTS.map((e) => e.id),
    voterEventDeck: VOTER_EVENTS.map((e) => e.id),
    agendaDeck: AGENDAS.map((a) => a.id),
  };
}

function step(state: GameState, action: GameAction, catalog: CardCatalog): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`AI 시뮬레이션 실패(${action.type}): ${result.reason}`);
  return result.state;
}

function fallbackSystemAction(state: GameState): GameAction {
  if (state.phase === 'promiseSelection') return { type: 'autoSelectPromises' };
  if (state.phase === 'unification') return { type: 'runUnificationTest' };
  return { type: 'runUntilPlayerAction' };
}

/** 휴리스틱 정책을 BotPolicy 형태로 감싼 기본 정책. */
export const heuristicBotPolicy: BotPolicy = ({ state, catalog, actor, rng }) => chooseHeuristicAction(state, catalog, actor, rng);

/** 4인 5라운드 self-play를 지정한 AI 정책으로 완주한다. */
export function simulateGameWithPolicy(seed: number, catalog: CardCatalog, policy: BotPolicy = heuristicBotPolicy): AiSimulationResult {
  const rng = new BotRng(seed * 97 + 13);
  const decisions: AiDecisionTrace[] = [];
  let state = setupGame({ seed, players: PLAYER_NAMES.map((name) => ({ name })), decks: realDecks() });
  state = step(state, { type: 'startGame' }, catalog);
  state = step(state, { type: 'runUntilPlayerAction' }, catalog);

  for (let guard = 0; guard < 2500 && state.phase !== 'gameEnd'; guard += 1) {
    const actors = getDecisionActors(state);
    if (actors.length === 0) {
      state = step(state, fallbackSystemAction(state), catalog);
      continue;
    }

    const actor = actors[0]!;
    const legalActions = legalActionsForActor(state, catalog, actor);
    if (legalActions.length === 0) {
      state = step(state, fallbackSystemAction(state), catalog);
      continue;
    }

    const scoreBefore = evaluateStateForPlayer(state, catalog, actor);
    const action = policy({ state, catalog, actor, legalActions, rng, step: decisions.length });
    if (!legalActions.some((candidate) => JSON.stringify(candidate) === JSON.stringify(action))) {
      throw new Error(`AI 정책이 합법 액션 목록 밖의 액션을 반환했습니다: ${action.type}`);
    }
    state = step(state, action, catalog);
    decisions.push({
      step: decisions.length,
      phase: state.actionLog[state.actionLog.length - 1]?.phase ?? state.phase,
      actor,
      legalActionCount: legalActions.length,
      action,
      scoreBefore,
      scoreAfter: evaluateStateForPlayer(state, catalog, actor),
    });
  }

  if (state.phase !== 'gameEnd' || !state.finalResult) {
    throw new Error(`AI 시뮬레이션이 gameEnd에 도달하지 못했습니다 (seed=${seed}, phase=${state.phase})`);
  }

  return { seed, finalResult: state.finalResult, roundHistory: state.roundHistory, decisions };
}

/** 여러 seed의 self-play decision trace를 모아 학습 데이터셋 초안을 만든다. */
export function collectSelfPlayDataset(seeds: readonly number[], catalog: CardCatalog, policy: BotPolicy = heuristicBotPolicy): AiSimulationResult[] {
  return seeds.map((seed) => simulateGameWithPolicy(seed, catalog, policy));
}
