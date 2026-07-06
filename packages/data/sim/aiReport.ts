// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// Self-play 결과를 학습 전 기준선 리포트로 집계한다.
import type { GameAction, GameState } from '@kingmakers/engine';
import type { AiSimulationResult } from './aiSimulation';
import { buildReport, type SimulationReport } from './report';

type ActionType = GameAction['type'];
type Phase = GameState['phase'];

export interface AiReportGoalOptions {
  winnerScoreMin?: number;
  winnerScoreMax?: number;
  minWinnerTargetRate?: number;
  minAgendaAchievementRate?: number;
  maxAgendaAchievementRate?: number;
  maxCoWinnerRate?: number;
}

export interface AiReportOptions extends AiReportGoalOptions {
  policyName?: string;
}

export interface AiActionDeltaStats {
  actionType: ActionType;
  count: number;
  meanScoreDelta: number;
  minScoreDelta: number;
  maxScoreDelta: number;
  positiveDeltaCount: number;
  negativeDeltaCount: number;
}

export interface AiPhaseCount {
  phase: Phase;
  count: number;
}

export interface AiObjectiveCheck {
  key: string;
  label: string;
  ok: boolean;
  value: number;
  target: string;
}

export interface AiTrainingReport {
  policyName: string;
  seedRange: { first: number; last: number };
  gamesPlayed: number;
  balance: SimulationReport;
  decisionSummary: {
    totalDecisions: number;
    meanDecisionsPerGame: number;
    actionStats: AiActionDeltaStats[];
    phaseCounts: AiPhaseCount[];
  };
  objectives: AiObjectiveCheck[];
  recommendations: string[];
}

interface MutableActionStats {
  actionType: ActionType;
  count: number;
  totalScoreDelta: number;
  minScoreDelta: number;
  maxScoreDelta: number;
  positiveDeltaCount: number;
  negativeDeltaCount: number;
}

const DEFAULT_GOALS: Required<AiReportGoalOptions> = {
  winnerScoreMin: 30,
  winnerScoreMax: 45,
  minWinnerTargetRate: 0.7,
  minAgendaAchievementRate: 0.35,
  maxAgendaAchievementRate: 0.75,
  maxCoWinnerRate: 0.1,
};

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function actionBucket(stats: Partial<Record<ActionType, MutableActionStats>>, actionType: ActionType): MutableActionStats {
  const existing = stats[actionType];
  if (existing) return existing;
  const created: MutableActionStats = {
    actionType,
    count: 0,
    totalScoreDelta: 0,
    minScoreDelta: Number.POSITIVE_INFINITY,
    maxScoreDelta: Number.NEGATIVE_INFINITY,
    positiveDeltaCount: 0,
    negativeDeltaCount: 0,
  };
  stats[actionType] = created;
  return created;
}

function buildActionStats(results: AiSimulationResult[]): AiActionDeltaStats[] {
  const byAction: Partial<Record<ActionType, MutableActionStats>> = {};

  for (const result of results) {
    for (const decision of result.decisions) {
      const delta = decision.scoreAfter - decision.scoreBefore;
      const bucket = actionBucket(byAction, decision.action.type);
      bucket.count += 1;
      bucket.totalScoreDelta += delta;
      bucket.minScoreDelta = Math.min(bucket.minScoreDelta, delta);
      bucket.maxScoreDelta = Math.max(bucket.maxScoreDelta, delta);
      if (delta > 0) bucket.positiveDeltaCount += 1;
      if (delta < 0) bucket.negativeDeltaCount += 1;
    }
  }

  return Object.values(byAction)
    .filter((entry): entry is MutableActionStats => entry != null)
    .map((entry) => ({
      actionType: entry.actionType,
      count: entry.count,
      meanScoreDelta: round(entry.totalScoreDelta / entry.count),
      minScoreDelta: round(entry.minScoreDelta),
      maxScoreDelta: round(entry.maxScoreDelta),
      positiveDeltaCount: entry.positiveDeltaCount,
      negativeDeltaCount: entry.negativeDeltaCount,
    }))
    .sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType));
}

function buildPhaseCounts(results: AiSimulationResult[]): AiPhaseCount[] {
  const counts: Partial<Record<Phase, number>> = {};
  for (const result of results) {
    for (const decision of result.decisions) {
      counts[decision.phase] = (counts[decision.phase] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([phase, count]) => ({ phase: phase as Phase, count: count ?? 0 }))
    .sort((a, b) => b.count - a.count || a.phase.localeCompare(b.phase));
}

function objective(key: string, label: string, ok: boolean, value: number, target: string): AiObjectiveCheck {
  return { key, label, ok, value: round(value), target };
}

function buildRecommendations(report: Omit<AiTrainingReport, 'recommendations'>, goals: Required<AiReportGoalOptions>): string[] {
  const recommendations: string[] = [];
  const winnerTargetRate = report.balance.winnerScoreStats.inTargetRangeCount / Math.max(1, report.gamesPlayed);
  const coWinnerRate = report.balance.coWinnerGames / Math.max(1, report.gamesPlayed);
  const topNegativeAction = report.decisionSummary.actionStats.find(
    (entry) => entry.count >= report.gamesPlayed && entry.meanScoreDelta < -0.5,
  );

  if (winnerTargetRate < goals.minWinnerTargetRate) {
    recommendations.push('승자 점수 목표대 이탈이 많습니다. 입찰 상한, 캠페인 보상, 자원 보너스 가중치를 먼저 비교하세요.');
  }
  if (report.balance.agendaAchievementRate < goals.minAgendaAchievementRate) {
    recommendations.push('비밀 의제 달성률이 낮습니다. 의제 선호를 공약 선택, 정책 압박, 유권자 접촉 점수에 더 강하게 반영하세요.');
  }
  if (report.balance.agendaAchievementRate > goals.maxAgendaAchievementRate) {
    recommendations.push('비밀 의제 달성률이 높습니다. 의제 조건 난도나 의제 보상 비중을 재검토하세요.');
  }
  if (coWinnerRate > goals.maxCoWinnerRate) {
    recommendations.push('공동 승리 비율이 높습니다. 최종 동점 처리나 단독 보너스 경로를 검토하세요.');
  }
  if (topNegativeAction) {
    recommendations.push(`${topNegativeAction.actionType} 액션의 평균 상태 변화가 낮습니다. 휴리스틱 보정 또는 합법 액션 후보 폭을 점검하세요.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('현재 기준선은 목표 범위 안에 있습니다. 다음 단계는 사람 플레이 로그와 self-play trace를 비교하는 것입니다.');
  }

  return recommendations;
}

export function buildAiTrainingReport(results: AiSimulationResult[], options: AiReportOptions = {}): AiTrainingReport {
  const goals = { ...DEFAULT_GOALS, ...options };
  const seeds = results.map((result) => result.seed);
  const gamesPlayed = results.length;
  const balance = buildReport(results);
  const totalDecisions = results.reduce((sum, result) => sum + result.decisions.length, 0);
  const winnerTargetRate = balance.winnerScoreStats.inTargetRangeCount / Math.max(1, gamesPlayed);
  const coWinnerRate = balance.coWinnerGames / Math.max(1, gamesPlayed);

  const baseReport: Omit<AiTrainingReport, 'recommendations'> = {
    policyName: options.policyName ?? 'heuristic',
    seedRange: { first: seeds.length > 0 ? Math.min(...seeds) : 0, last: seeds.length > 0 ? Math.max(...seeds) : 0 },
    gamesPlayed,
    balance,
    decisionSummary: {
      totalDecisions,
      meanDecisionsPerGame: round(totalDecisions / Math.max(1, gamesPlayed)),
      actionStats: buildActionStats(results),
      phaseCounts: buildPhaseCounts(results),
    },
    objectives: [
      objective(
        'winner-score-target-rate',
        '승자 점수 목표대 비율',
        winnerTargetRate >= goals.minWinnerTargetRate,
        winnerTargetRate,
        `${goals.winnerScoreMin}-${goals.winnerScoreMax} VP 안에 ${round(goals.minWinnerTargetRate * 100, 1)}% 이상`,
      ),
      objective(
        'agenda-achievement-rate',
        '비밀 의제 달성률',
        balance.agendaAchievementRate >= goals.minAgendaAchievementRate && balance.agendaAchievementRate <= goals.maxAgendaAchievementRate,
        balance.agendaAchievementRate,
        `${round(goals.minAgendaAchievementRate * 100, 1)}-${round(goals.maxAgendaAchievementRate * 100, 1)}%`,
      ),
      objective('co-winner-rate', '공동 승리 비율', coWinnerRate <= goals.maxCoWinnerRate, coWinnerRate, `${round(goals.maxCoWinnerRate * 100, 1)}% 이하`),
      objective('trace-volume', '판당 의사결정 trace', totalDecisions >= gamesPlayed * 20, totalDecisions / Math.max(1, gamesPlayed), '판당 20개 이상'),
    ],
  };

  return { ...baseReport, recommendations: buildRecommendations(baseReport, goals) };
}
