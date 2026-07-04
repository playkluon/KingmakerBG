// 기반 스킬: skills/auction-promise/SKILL.md
// §9 공약 선택 — majorBacker의 selectPromise, majorBacker 없는 후보의 autoSelectPromises
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { PlayerAction } from '../types/actions';
import type { PlayerId, PromiseId } from '../types/ids';
import type { CampState, EffectDescriptor, GameState } from '../types/state';

const ok = (state: GameState, log: ReturnType<typeof createLogEntry>[]): ReduceResult => ({ ok: true, state, log });
const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 출마 후보 전원의 공약이 확정됐는지 (majorBacker 없는 후보는 autoSelectPromises가 채운다) */
function allPromisesSelected(state: GameState): boolean {
  return state.round.candidatesRunning.every((id) => state.round.camps[id]?.promiseId != null);
}

/** promiseSelection의 모든 공약이 확정되면 다음 phase(voterReveal)로 넘어간다 (§9, §7) */
function maybeLeavePromiseSelection(state: GameState): GameState {
  if (state.phase === 'promiseSelection' && allPromisesSelected(state)) {
    return { ...state, phase: getNextPhase('promiseSelection', state.round.round, state.maxRounds) };
  }
  return state;
}

/**
 * 공약의 즉시 보상 중 majorBacker에게 즉시 적용 가능한 것만 지금 처리한다(§9의 backerReward).
 * 나머지(extraVotes류는 Skill 6 투표 집계, backerInfluence/backerPressureToken은 Skill 5 캠페인 집계)는
 * camps[candidateId].promiseId로 남겨 두고 해당 스킬이 카탈로그를 조회해 소비한다.
 * 한 후보/공약 조합당 promiseId는 한 번만 설정되므로(§9) 이 보상도 자연히 한 번만 적용된다.
 */
function applyImmediatePromiseReward(
  state: GameState,
  backerId: PlayerId | null,
  catalog: CardCatalog,
  promiseId: PromiseId,
): { state: GameState; effects: EffectDescriptor[] } {
  const promise = catalog.promises[promiseId];
  if (!promise || promise.effect.kind !== 'backerReward' || !backerId) {
    return { state, effects: [] };
  }
  const { resource, amount } = promise.effect;
  const players = state.players.map((p) => {
    if (p.id !== backerId) return p;
    return resource === 'money' ? { ...p, money: p.money + amount } : { ...p, victoryPoints: p.victoryPoints + amount };
  });
  return { state: { ...state, players }, effects: [{ target: backerId, field: resource, delta: amount }] };
}

export function applySelectPromise(
  state: GameState,
  action: Extract<PlayerAction, { type: 'selectPromise' }>,
  catalog: CardCatalog,
): ReduceResult {
  const camp = state.round.camps[action.candidateId];
  if (!camp) return fail('출마하지 않은 후보입니다');
  if (camp.majorBacker !== action.actor) return fail('주요 후원자만 공약을 선택할 수 있습니다');
  if (camp.promiseId) return fail('이미 공약을 선택했습니다');
  if (!camp.promiseOptions.includes(action.promiseId)) return fail('제시된 공약 후보가 아닙니다');

  const player = state.players.find((p) => p.id === action.actor)!;
  const updatedCamp: CampState = { ...camp, promiseId: action.promiseId };
  let next: GameState = {
    ...state,
    round: { ...state.round, camps: { ...state.round.camps, [action.candidateId]: updatedCamp } },
  };

  const reward = applyImmediatePromiseReward(next, camp.majorBacker, catalog, action.promiseId);
  next = reward.state;

  const entry = createLogEntry(
    state,
    'promiseSelection',
    action.actor,
    'selectPromise',
    `${player.name}이(가) 공약을 선택했습니다`,
    reward.effects,
  );
  next = appendLog(next, entry);
  next = maybeLeavePromiseSelection(next);

  return ok(next, [entry]);
}

/** §9: majorBacker가 없는 후보는 시스템이 자동으로 공약을 고른다 (제시된 첫 번째 옵션, 결정적) */
export function applyAutoSelectPromisesAction(state: GameState): ReduceResult {
  if (state.phase !== 'promiseSelection') {
    return fail(`지금(${state.phase})은 'autoSelectPromises'를 할 수 없습니다`);
  }

  let camps = { ...state.round.camps };
  let changed = false;
  const effects: EffectDescriptor[] = [];

  for (const candidateId of state.round.candidatesRunning) {
    const camp = camps[candidateId];
    if (!camp || camp.promiseId != null || camp.majorBacker != null) continue;
    if (camp.promiseOptions.length === 0) continue; // 덱 소진 시 fallback은 Phase 5(다회차) 범위 — 단일 라운드에서는 발생하지 않는다
    const chosen = camp.promiseOptions[0]!;
    camps = { ...camps, [candidateId]: { ...camp, promiseId: chosen } };
    effects.push({ target: candidateId, field: 'promiseId', after: chosen });
    changed = true;
    // majorBacker가 없으므로 backerReward를 받을 대상이 없다 — 즉시 보상 적용 생략
  }

  const entry = createLogEntry(
    state,
    'promiseSelection',
    null,
    'autoSelectPromises',
    changed ? '주요 후원자가 없는 후보의 공약을 자동으로 선택했습니다' : '자동 선택이 필요한 후보가 없습니다',
    effects,
  );
  let next: GameState = appendLog({ ...state, round: { ...state.round, camps } }, entry);
  next = maybeLeavePromiseSelection(next);

  return ok(next, [entry]);
}
