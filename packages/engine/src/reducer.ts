// 기반 스킬: skills/engine-core/SKILL.md
// reduce(state, action, catalog) -> { ok:true, state, log } | { ok:false, reason } — 엔진의 유일한 공개 진입점.
// CLAUDE.md 아키텍처 원칙 2: 모든 룰 계산은 이 순수 reducer를 거친다.
// catalog: 카드 "내용"이 필요한 액션(예: selectPromise의 즉시 보상)을 위한 조회 테이블 — packages/data가 채워 주입한다.
// 카드 내용이 필요 없는 액션(대부분의 시스템 액션, placeBid 등)은 catalog를 사용하지 않는다.
import { applyConfirmAuctionBids, applyPlaceBid } from './rules/auction';
import { applySelectPromise } from './rules/promise';
import { PHASES, PLAYER_ACTION_PHASE } from './phases';
import { applySystemAction } from './system';
import type { CardCatalog } from './types/cards';
import { isPlayerAction, type GameAction, type PlayerAction } from './types/actions';
import type { GameState } from './types/state';
import type { ReduceResult } from './result';

export type { ReduceResult } from './result';

/** GameAction을 GameState에 적용한다. 실패는 throw가 아니라 {ok:false, reason}으로 반환한다 (CLAUDE.md) */
export function reduce(state: GameState, action: GameAction, catalog: CardCatalog): ReduceResult {
  if (isPlayerAction(action)) {
    return applyPlayerAction(state, action, catalog);
  }
  return applySystemAction(state, action);
}

/**
 * §20 플레이어 액션 처리.
 * 좌석 존재 여부와 현재 phase 일치는 여기서 공통으로 검증한 뒤, 실제 규칙은 rules/*.ts에 위임한다.
 */
function applyPlayerAction(state: GameState, action: PlayerAction, catalog: CardCatalog): ReduceResult {
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

  switch (action.type) {
    case 'placeBid':
      return applyPlaceBid(state, action);
    case 'confirmAuctionBids':
      return applyConfirmAuctionBids(state, action);
    case 'selectPromise':
      return applySelectPromise(state, action, catalog);
    default:
      // Skill 5~7이 이 자리를 실제 규칙으로 교체한다
      return {
        ok: false,
        reason: `'${action.type}' 액션은 아직 구현되지 않았습니다 (Skill 5~7에서 추가 예정)`,
      };
  }
}
