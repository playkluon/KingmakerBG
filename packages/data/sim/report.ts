// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// N판의 SimulationResult를 모아 밸런스 리포트로 집계한다 — 순수 함수, 부작용 없음(재현성 테스트가 그대로 재사용).
import type { SimulationResult } from './simulate';

export interface ScoreSourceTotals {
  baseVp: number;
  agendaVp: number;
  moneyBonusVp: number;
  reputationBonusVp: number;
  contractBonusVp: number;
}

export interface SimulationReport {
  gamesPlayed: number;
  /** §16 목표 점수대(30~45) 기준 승자 점수 분포 */
  winnerScoreStats: { min: number; max: number; mean: number; inTargetRangeCount: number };
  /** 전체 (게임 수 × 4명) 중 비밀 의제를 달성한 비율 */
  agendaAchievementRate: number;
  /** 전원 합산 점수 출처 비중 — 어느 점수 소스가 게임을 지배하는지 확인용 */
  scoreSourceTotals: ScoreSourceTotals;
  /** 동점 처리 v0.3까지 갔는데도 공동 승리로 끝난 게임 수 */
  coWinnerGames: number;
}

export function buildReport(results: SimulationResult[]): SimulationReport {
  const winnerScores: number[] = [];
  let agendaMetCount = 0;
  let totalPlayers = 0;
  let coWinnerGames = 0;
  const scoreSourceTotals: ScoreSourceTotals = { baseVp: 0, agendaVp: 0, moneyBonusVp: 0, reputationBonusVp: 0, contractBonusVp: 0 };

  for (const r of results) {
    const { entries, winners } = r.finalResult;
    if (winners.length > 1) coWinnerGames += 1;
    const winnerEntry = entries.find((e) => e.playerId === winners[0]);
    if (winnerEntry) winnerScores.push(winnerEntry.total);

    for (const e of entries) {
      totalPlayers += 1;
      if (e.agendaMet) agendaMetCount += 1;
      scoreSourceTotals.baseVp += e.baseVp;
      scoreSourceTotals.agendaVp += e.agendaVp;
      scoreSourceTotals.moneyBonusVp += e.moneyBonusVp;
      scoreSourceTotals.reputationBonusVp += e.reputationBonusVp;
      scoreSourceTotals.contractBonusVp += e.contractBonusVp;
    }
  }

  const mean = winnerScores.length > 0 ? winnerScores.reduce((a, b) => a + b, 0) / winnerScores.length : 0;
  const inTargetRangeCount = winnerScores.filter((s) => s >= 30 && s <= 45).length;

  return {
    gamesPlayed: results.length,
    winnerScoreStats: {
      min: winnerScores.length > 0 ? Math.min(...winnerScores) : 0,
      max: winnerScores.length > 0 ? Math.max(...winnerScores) : 0,
      mean,
      inTargetRangeCount,
    },
    agendaAchievementRate: totalPlayers > 0 ? agendaMetCount / totalPlayers : 0,
    scoreSourceTotals,
    coWinnerGames,
  };
}
