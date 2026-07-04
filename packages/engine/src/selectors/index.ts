// 기반 스킬: skills/engine-core/SKILL.md
// UI용 파생값 계산 — 클라이언트가 import를 허용받는 유일한 로직 (CLAUDE.md 코딩 규칙: reducer 호출은 금지)
import { PHASES } from '../phases';
import type { GameState } from '../types/state';

/** 현재 phase가 플레이어 결정을 기다리는 중인지 (§19 runUntilPlayerAction 정지 기준) */
export function isWaitingForPlayerDecision(state: GameState): boolean {
  return PHASES[state.phase].requiresPlayerDecision;
}

/** 현재 phase의 한국어 설명 (§22 "현재 phase" UI에 사용) */
export function getPhaseDescription(state: GameState): string {
  return PHASES[state.phase].description;
}

/** 게임 종료 여부 */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'gameEnd';
}
