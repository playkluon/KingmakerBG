// 기반 스킬: skills/engine-core/SKILL.md
// ActionLogEntry 생성 헬퍼 (부록 A-6: summary는 한국어 자연어 문장)
import type { GameAction } from './types/actions';
import type { PlayerId } from './types/ids';
import type { ActionLogEntry, EffectDescriptor, GameState } from './types/state';
import type { PhaseId } from './phases';

/** state.nextLogSeq를 기준으로 ActionLogEntry를 만든다 (seq 증가는 호출자가 반영) */
export function createLogEntry(
  state: GameState,
  phase: PhaseId,
  actor: PlayerId | null,
  action: GameAction['type'],
  summary: string,
  effects: EffectDescriptor[] = [],
): ActionLogEntry {
  return {
    seq: state.nextLogSeq,
    round: state.round.round,
    phase,
    actor,
    action,
    summary,
    effects,
  };
}

/** state.actionLog에 새 항목을 추가하고 nextLogSeq를 1 증가시킨 새 GameState를 반환한다 (불변 업데이트) */
export function appendLog(state: GameState, entry: ActionLogEntry): GameState {
  return {
    ...state,
    actionLog: [...state.actionLog, entry],
    nextLogSeq: state.nextLogSeq + 1,
  };
}
