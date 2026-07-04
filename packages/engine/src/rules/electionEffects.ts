// 기반 스킬: skills/unification-voting/SKILL.md
// §14 당선 효과 4유형 확정 — fixed/winningPromise는 즉시 확정, choose/flex는 majorBacker 선택 대기
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { PlayerAction } from '../types/actions';
import type { ElectionEffectResolution, GameState } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/**
 * 투표 직후 진입 시점에 호출된다. fixedPolicyMove/winningPromisePolicyMove는 선택이 필요 없으므로
 * 즉시 electionEffectResolution을 채운다. choose/flex는 majorBacker가 있으면 선택을 기다리고(그대로 반환),
 * majorBacker가 없으면 엔진이 결정적 fallback으로 채운다.
 */
export function resolveElectionEffectEntry(state: GameState, catalog: CardCatalog): GameState {
  const winner = state.round.winnerCandidateId;
  if (!winner) return state;
  const card = catalog.candidates[winner];
  if (!card) return state;

  const effect = card.electionEffect;
  let resolution: ElectionEffectResolution | null = null;

  if (effect.kind === 'fixedPolicyMove') {
    resolution = { kind: 'move', track: effect.track, direction: effect.direction, amount: effect.amount };
  } else if (effect.kind === 'winningPromisePolicyMove') {
    resolution = { kind: 'repeatPromise', repeat: effect.repeat };
  } else {
    const majorBacker = state.round.camps[winner]?.majorBacker;
    if (!majorBacker) {
      // majorBacker 없는 당선 후보 — 엔진 fallback으로 결정적 확정
      resolution =
        effect.kind === 'choosePolicyMove'
          ? { kind: 'move', ...effect.options[0]! }
          : { kind: 'move', track: 'economy', direction: 1, amount: effect.amount };
    }
    // majorBacker가 있으면 resolution은 null로 남기고 selectElectionPolicyMove를 기다린다
  }

  if (!resolution) return state;
  return { ...state, round: { ...state.round, electionEffectResolution: resolution } };
}

/** §20 selectElectionPolicyMove — choose/flex 당선 효과를 가진 당선 후보의 majorBacker만 사용한다 */
export function applySelectElectionPolicyMove(
  state: GameState,
  action: Extract<PlayerAction, { type: 'selectElectionPolicyMove' }>,
  catalog: CardCatalog,
): ReduceResult {
  const winner = state.round.winnerCandidateId;
  if (!winner) return fail('당선 후보가 없습니다');
  const camp = state.round.camps[winner];
  if (!camp || camp.majorBacker !== action.actor) {
    return fail('당선 후보의 주요 후원자만 당선 효과를 선택할 수 있습니다');
  }
  if (state.round.electionEffectResolution) {
    return fail('이미 당선 효과가 확정되었습니다');
  }
  const card = catalog.candidates[winner];
  if (!card) return fail('후보 정보를 찾을 수 없습니다');

  let resolution: ElectionEffectResolution;
  if (card.electionEffect.kind === 'choosePolicyMove') {
    const match = card.electionEffect.options.find((o) => o.track === action.track && o.direction === action.direction);
    if (!match) return fail('제시된 선택지가 아닙니다');
    resolution = { kind: 'move', ...match };
  } else if (card.electionEffect.kind === 'flexPolicyMove') {
    resolution = { kind: 'move', track: action.track, direction: action.direction, amount: card.electionEffect.amount };
  } else {
    return fail('이 당선 효과는 선택이 필요하지 않습니다');
  }

  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(
    state,
    'electionEffectSelection',
    action.actor,
    'selectElectionPolicyMove',
    `${player.name}이(가) 당선 효과를 선택했습니다`,
    [{ target: resolution.track, field: 'electionEffect', after: resolution.direction }],
  );
  const next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, electionEffectResolution: resolution },
    phase: getNextPhase('electionEffectSelection', state.round.round, state.maxRounds),
  };
  return { ok: true, state: next, log: [entry] };
}
