// 기반 스킬: skills/engine-core/SKILL.md
// reduce(state, action) -> { ok:true, state, log } | { ok:false, reason } — 엔진의 유일한 공개 진입점.
// CLAUDE.md 아키텍처 원칙 2: 모든 룰 계산은 이 순수 reducer를 거친다.
import { PHASES, PLAYER_ACTION_PHASE } from './phases';
import { applySystemAction, type ReduceResult } from './system';
import { isPlayerAction, type GameAction, type PlayerAction } from './types/actions';
import type { GameState } from './types/state';

export type { ReduceResult } from './system';

/** GameAction을 GameState에 적용한다. 실패는 throw가 아니라 {ok:false, reason}으로 반환한다 (CLAUDE.md) */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  if (isPlayerAction(action)) {
    return applyPlayerAction(state, action);
  }
  return applySystemAction(state, action);
}

/**
 * §20 플레이어 액션 처리.
 * 좌석 존재 여부와 현재 phase 일치는 실제로 검증한다.
 * 검증을 통과한 뒤의 실제 규칙 적용은 Skill 4~7이 이 자리를 채운다 — 그 전까지는 명시적으로 미구현을 응답한다.
 */
function applyPlayerAction(state: GameState, action: PlayerAction): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor);
  if (!player) {
    return { ok: false, reason: `존재하지 않는 플레이어입니다: ${action.actor}` };
  }

  const expectedPhase = PLAYER_ACTION_PHASE[action.type];
  if (state.phase !== expectedPhase) {
    return {
      ok: false,
      reason: `지금(${PHASES[state.phase].description})은 '${action.type}'을(를) 할 수 없습니다`,
    };
  }

  // 상태 변화가 없으므로 로그를 남기지 않는다 — Skill 4~7이 여기를 실제 규칙(createLogEntry 사용)으로 교체한다
  return {
    ok: false,
    reason: `'${action.type}' 액션은 아직 구현되지 않았습니다 (Skill 4~7에서 추가 예정)`,
  };
}
