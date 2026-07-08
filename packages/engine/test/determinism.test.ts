// 기반 스킬: skills/engine-core/SKILL.md
// 부록 A-5: 같은 seed + 같은 액션 시퀀스 재생 = 같은 최종 상태
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import type { GameState } from '../src/types/state';
import { placeholderCatalog, setupAtAuction } from './fixtures';

const playerNames = ['A', 'B', 'C', 'D'];

/** startGame → 정당 선택 → 후보 제안(개편안 A·B)을 결정적 순서로 밟고 auctionBidding에서 멈춘다 */
function playToAuction(seed: number): { state: GameState } {
  return { state: setupAtAuction(seed, playerNames) };
}

describe('결정성 재생 (부록 A-5)', () => {
  it('같은 seed + 같은 액션 시퀀스는 완전히 동일한 최종 상태를 만든다', () => {
    const run1 = playToAuction(2026);
    const run2 = playToAuction(2026);
    expect(run1.state).toEqual(run2.state);
    expect(run1.state.actionLog).toEqual(run2.state.actionLog);
  });

  it('자동 진행은 정확히 auctionBidding(플레이어 결정 지점)에서 멈춘다', () => {
    const { state } = playToAuction(2026);
    expect(state.phase).toBe('auctionBidding');
    // income/이슈 2단계 공개/후보 제안이 실제로 처리되었는지도 함께 확인한다
    expect(state.players[0]!.money).toBeGreaterThan(0);
    expect(state.round.firstIssues).toHaveLength(2);
    expect(state.round.secondIssues).toHaveLength(2);
    expect(state.round.candidatesRevealed).toHaveLength(playerNames.length);
  });

  it('다른 seed는 공개된 이슈 구성이 달라질 수 있다', () => {
    const runA = playToAuction(1);
    const runB = playToAuction(999);
    // 후보 제안은 손패(정당 소속) 기준이라 seed와 무관할 수 있다 — 셔플의 영향은 이슈 덱에서 확인한다
    expect([...runA.state.round.firstIssues, ...runA.state.round.secondIssues]).not.toEqual([
      ...runB.state.round.firstIssues,
      ...runB.state.round.secondIssues,
    ]);
  });

  it('runUntilPlayerAction은 이미 결정 지점이어도 실패하지 않고 빈 로그로 성공한다', () => {
    const { state } = playToAuction(2026);
    const result = reduce(state, { type: 'runUntilPlayerAction' }, placeholderCatalog());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.log).toHaveLength(0);
      expect(result.state).toEqual(state);
    }
  });
});
