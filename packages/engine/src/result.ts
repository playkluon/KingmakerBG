// 기반 스킬: skills/engine-core/SKILL.md
// reduce()와 모든 rules/* 모듈이 공유하는 결과 타입. CLAUDE.md: 실패는 throw가 아니라 {ok:false, reason}.
import type { ActionLogEntry, GameState } from './types/state';

export type ReduceResult =
  | { ok: true; state: GameState; log: ActionLogEntry[] }
  | { ok: false; reason: string };
