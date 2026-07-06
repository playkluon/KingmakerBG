// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
import { describe, expect, it } from 'vitest';
import { buildAiTrainingReport } from '../sim/aiReport';
import { collectSelfPlayDataset } from '../sim/aiSimulation';
import { buildCardCatalog } from '../src/catalog';

describe('AI self-play 리포트', () => {
  it('seed 고정 self-play 결과를 학습 기준선 리포트로 집계한다', () => {
    const catalog = buildCardCatalog();
    const dataset = collectSelfPlayDataset([31, 32], catalog);
    const report = buildAiTrainingReport(dataset, { policyName: 'test-policy' });

    expect(report.policyName).toBe('test-policy');
    expect(report.gamesPlayed).toBe(2);
    expect(report.balance.gamesPlayed).toBe(2);
    expect(report.decisionSummary.totalDecisions).toBeGreaterThan(40);
    expect(report.decisionSummary.actionStats.length).toBeGreaterThan(0);
    expect(report.decisionSummary.phaseCounts.length).toBeGreaterThan(0);
    expect(report.objectives).toHaveLength(4);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report).toEqual(buildAiTrainingReport(dataset, { policyName: 'test-policy' }));
  });
});
