// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// 휴리스틱을 rollout 정책으로 쓰는 경량 몬테카를로 탐색. 학습 전 "생각하는 봇" 기준선으로 사용한다.
import { reduce, type CardCatalog, type GameAction, type GameState, type PlayerId } from '@kingmakers/engine';
import { BotRng } from './bot';
import { chooseHeuristicAction, evaluateStateForPlayer, scoreAction } from './heuristic';
import { getDecisionActors, legalActionsForActor } from './legalActions';

export interface MonteCarloOptions {
  samplesPerAction?: number;
  rolloutDepth?: number;
}

function applyOrThrow(state: GameState, action: GameAction, catalog: CardCatalog): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`몬테카를로 rollout 실패(${action.type}): ${result.reason}`);
  return result.state;
}

function fallbackSystemAction(state: GameState): GameAction {
  if (state.phase === 'promiseSelection') return { type: 'autoSelectPromises' };
  if (state.phase === 'unification') return { type: 'runUnificationTest' };
  return { type: 'runUntilPlayerAction' };
}

function rollout(state: GameState, catalog: CardCatalog, perspective: PlayerId, rng: BotRng, depth: number): number {
  let current = state;
  for (let i = 0; i < depth && current.phase !== 'gameEnd'; i += 1) {
    const actors = getDecisionActors(current);
    if (actors.length === 0) {
      current = applyOrThrow(current, fallbackSystemAction(current), catalog);
      continue;
    }

    const actor = actors[0]!;
    const actions = legalActionsForActor(current, catalog, actor);
    if (actions.length === 0) {
      current = applyOrThrow(current, fallbackSystemAction(current), catalog);
      continue;
    }
    current = applyOrThrow(current, chooseHeuristicAction(current, catalog, actor, rng), catalog);
  }
  return evaluateStateForPlayer(current, catalog, perspective);
}

/** 현재 actor의 합법 액션마다 짧은 미래를 굴려 평균 가치가 가장 높은 수를 고른다. */
export function chooseMonteCarloAction(
  state: GameState,
  catalog: CardCatalog,
  actor: PlayerId,
  rng: BotRng,
  options: MonteCarloOptions = {},
): GameAction {
  const actions = legalActionsForActor(state, catalog, actor);
  if (actions.length === 0) {
    throw new Error(`선택 가능한 합법 액션이 없습니다 (phase=${state.phase}, actor=${actor})`);
  }

  const samplesPerAction = options.samplesPerAction ?? 4;
  const rolloutDepth = options.rolloutDepth ?? 60;
  let bestAction = actions[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const action of actions) {
    const result = reduce(state, action, catalog);
    if (!result.ok) continue;

    let total = scoreAction(state, catalog, actor, action);
    for (let sample = 0; sample < samplesPerAction; sample += 1) {
      total += rollout(result.state, catalog, actor, new BotRng(rng.int(1_000_000_000)), rolloutDepth);
    }
    const average = total / (samplesPerAction + 1);
    if (average > bestScore) {
      bestScore = average;
      bestAction = action;
    }
  }

  return bestAction;
}
