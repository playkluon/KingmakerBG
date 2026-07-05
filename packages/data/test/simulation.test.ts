// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// M7 완료 조건: "시뮬레이션 리포트가 CI에서 재현 가능 (seed 고정)"
import { describe, expect, it } from 'vitest';
import { buildCardCatalog } from '../src/catalog';
import { buildReport } from '../sim/report';
import { simulateGame } from '../sim/simulate';

// seed 고정 — 매 CI 실행마다 동일한 20판을 재생한다 (Math.random 등 비결정 요소 없음)
const SEEDS = Array.from({ length: 20 }, (_, i) => i * 1000 + 1);

describe('부록 A-19 밸런스 시뮬레이션 (4인 5라운드, 봇 자동 대전)', () => {
  it('20판 전부 크래시 없이 gameEnd까지 완주되고 최종 결과가 4인분 채워진다', () => {
    const catalog = buildCardCatalog();
    const results = SEEDS.map((seed) => simulateGame(seed, catalog));
    expect(results).toHaveLength(SEEDS.length);
    for (const r of results) {
      expect(r.finalResult.entries).toHaveLength(4);
      expect(r.finalResult.winners.length).toBeGreaterThanOrEqual(1);
      expect(r.roundHistory).toHaveLength(5);
    }
  });

  it('같은 seed 목록을 재생하면 리포트가 완전히 동일하다 (재현성 — M7 완료 조건)', () => {
    const catalog = buildCardCatalog();
    const runOnce = () => buildReport(SEEDS.map((seed) => simulateGame(seed, catalog)));
    expect(runOnce()).toEqual(runOnce());
  });

  it('리포트: 승자 점수 분포·의제 달성률·점수 소스 비중 (콘솔에 남기고, 목표대 이탈은 경고만)', () => {
    const catalog = buildCardCatalog();
    const results = SEEDS.map((seed) => simulateGame(seed, catalog));
    const report = buildReport(results);

    console.log('[밸런스 시뮬레이션 리포트]', JSON.stringify(report, null, 2));

    expect(report.gamesPlayed).toBe(SEEDS.length);
    // 밸런스 수치 자체는 아직 확정이 아니라(GAME_SPEC §23) 하드 실패시키지 않고 리포트만 남긴다 — DEV_PLAN Phase 5와 동일한 방침
    if (report.winnerScoreStats.inTargetRangeCount < SEEDS.length) {
      console.warn(
        `[밸런스 리포트] 승자 총점이 목표대(30~45 VP)를 벗어난 판: ${SEEDS.length - report.winnerScoreStats.inTargetRangeCount}/${SEEDS.length} ` +
          `(min=${report.winnerScoreStats.min}, max=${report.winnerScoreStats.max}, mean=${report.winnerScoreStats.mean.toFixed(1)})`,
      );
    }
  });
});
