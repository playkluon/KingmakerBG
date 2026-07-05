// 기반 스킬: skills/scoring/SKILL.md
// §16 최종 점수와 승리 — 공개 VP + 비밀 의제 + money/reputation/공개계약 보너스, 동점 처리 v0.3
import { SCORE_CONTRACT_LEADER_BONUS } from '../constants';
import { evaluateAgendaCondition } from './agendas';
import type { CardCatalog } from '../types/cards';
import type { PlayerId } from '../types/ids';
import type { FinalResultSummary, FinalScoreEntry, GameState, PlayerState } from '../types/state';

/** §16-4/5: 단독 1등에게만 보너스 — 공동 1등이면 아무도 받지 못한다 */
function soleLeader(players: PlayerState[], value: (p: PlayerState) => number): PlayerId | null {
  let best: PlayerState | null = null;
  let tied = false;
  for (const p of players) {
    if (!best || value(p) > value(best)) {
      best = p;
      tied = false;
    } else if (value(p) === value(best)) {
      tied = true;
    }
  }
  return best && !tied ? best.id : null;
}

/** §16 동점 처리 v0.3 비교 기준 — total → 공개 VP → reputation → money → 마커 총합 (전부 같으면 공동 승리) */
function tieBreakTuple(state: GameState, entry: FinalScoreEntry): number[] {
  const player = state.players.find((p) => p.id === entry.playerId)!;
  const markerTotal = Object.values(player.influenceMarkers).reduce((a: number, b) => a + (b ?? 0), 0);
  return [entry.total, entry.baseVp, player.reputation, player.money, markerTotal];
}

function compareTuples(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return b[i]! - a[i]!;
  }
  return 0;
}

/**
 * §16 최종 점수를 계산한다. 순수 함수 — 상태를 변경하지 않고 요약만 반환한다.
 * 게임 종료 시점(마지막 cleanup)에 system.ts가 호출해 GameState.finalResult에 저장한다.
 */
export function computeFinalResult(state: GameState, catalog: CardCatalog): FinalResultSummary {
  const reputationLeader = soleLeader(state.players, (p) => p.reputation);
  // §16-5, 부록 A-15: 공개 계약 이행 수 단독 1등 — 아무도 이행하지 않았으면(전원 0) 동률이라 아무도 못 받는다
  const contractLeader = soleLeader(state.players, (p) => p.contractsFulfilled);

  const entries: FinalScoreEntry[] = state.players.map((player) => {
    const agenda = player.secretAgendaId ? catalog.agendas[player.secretAgendaId] : undefined;
    const agendaMet = agenda ? evaluateAgendaCondition(agenda.condition, player.id, state, state.roundHistory) : false;
    const agendaVp = agendaMet && agenda ? agenda.points : 0;
    const moneyBonusVp = Math.floor(player.money / 5);
    const reputationBonusVp = reputationLeader === player.id ? 2 : 0;
    const contractBonusVp = contractLeader === player.id ? SCORE_CONTRACT_LEADER_BONUS : 0;
    return {
      playerId: player.id,
      baseVp: player.victoryPoints,
      agendaId: player.secretAgendaId,
      agendaMet,
      agendaVp,
      moneyBonusVp,
      reputationBonusVp,
      contractBonusVp,
      total: player.victoryPoints + agendaVp + moneyBonusVp + reputationBonusVp + contractBonusVp,
      rank: 0, // 아래에서 채운다
    };
  });

  // 동점 처리 v0.3 — competition ranking: 모든 판정 기준이 같은 플레이어끼리는 공동 순위
  const tuples = new Map(entries.map((e) => [e.playerId, tieBreakTuple(state, e)]));
  for (const entry of entries) {
    const mine = tuples.get(entry.playerId)!;
    entry.rank = 1 + entries.filter((other) => compareTuples(tuples.get(other.playerId)!, mine) < 0).length;
  }

  const winners = entries.filter((e) => e.rank === 1).map((e) => e.playerId);
  // 좌석 순 정렬 유지 (state.players 순서가 좌석 순)
  return { entries, winners };
}
