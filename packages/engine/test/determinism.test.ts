// 기반 스킬: skills/engine-core/SKILL.md
// 부록 A-5: 같은 seed + 같은 액션 시퀀스 재생 = 같은 최종 상태
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { setupGame } from '../src/setup';
import type { GameAction } from '../src/types/actions';
import type { GameState } from '../src/types/state';

const players = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

/** startGame 후 자동 진행 가능한 phase(수입/이슈/후보 공개)를 끝까지 밟고 auctionBidding에서 멈춘다 */
function playToAuction(seed: number): { state: GameState; log: unknown[] } {
  let state = setupGame({ seed, players });
  const sequence: GameAction[] = [{ type: 'startGame' }, { type: 'runUntilPlayerAction' }];
  const log: unknown[] = [];
  for (const action of sequence) {
    const result = reduce(state, action);
    if (!result.ok) throw new Error(`시퀀스 재생 실패: ${result.reason}`);
    state = result.state;
    log.push(...result.log);
  }
  return { state, log };
}

describe('결정성 재생 (부록 A-5)', () => {
  it('같은 seed + 같은 액션 시퀀스는 완전히 동일한 최종 상태를 만든다', () => {
    const run1 = playToAuction(2026);
    const run2 = playToAuction(2026);
    expect(run1.state).toEqual(run2.state);
    expect(run1.log).toEqual(run2.log);
  });

  it('자동 진행은 정확히 auctionBidding(플레이어 결정 지점)에서 멈춘다', () => {
    const { state } = playToAuction(2026);
    expect(state.phase).toBe('auctionBidding');
    // income/issueReveal/candidateReveal이 실제로 처리되었는지도 함께 확인한다
    expect(state.players[0]!.money).toBeGreaterThan(0);
    expect(state.round.issueId).not.toBeNull();
    expect(state.round.candidatesRevealed.length).toBeGreaterThan(0);
  });

  it('다른 seed는 공개된 후보 구성이 달라질 수 있다', () => {
    const runA = playToAuction(1);
    const runB = playToAuction(999);
    expect(runA.state.round.candidatesRevealed).not.toEqual(runB.state.round.candidatesRevealed);
  });

  it('runUntilPlayerAction은 이미 결정 지점이어도 실패하지 않고 빈 로그로 성공한다', () => {
    const { state } = playToAuction(2026);
    const result = reduce(state, { type: 'runUntilPlayerAction' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.log).toHaveLength(0);
      expect(result.state).toEqual(state);
    }
  });
});
