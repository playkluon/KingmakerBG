// 기반 스킬: skills/engine-core/SKILL.md
import { describe, expect, it } from 'vitest';
import { getNextPhase, PHASE_ORDER, PHASES } from '../src/phases';
import { reduce } from '../src/reducer';
import { setupGame } from '../src/setup';
import { emptyCatalog, testDecks } from './fixtures';

describe('phase 정의 (§18)', () => {
  it('phase 16종이 GAME_SPEC.md §18 순서와 정확히 일치한다', () => {
    expect(PHASE_ORDER).toEqual([
      'setup',
      'income',
      'issueReveal',
      'candidateReveal',
      'auctionBidding',
      'auctionResolved',
      'promiseSelection',
      'voterReveal',
      'campaignActions',
      'unification',
      'voting',
      'electionEffectSelection',
      'policyResolution',
      'roundScoring',
      'cleanup',
      'gameEnd',
    ]);
  });

  it('§7의 플레이어 결정 단계만 requiresPlayerDecision=true다', () => {
    const decisionPhases = PHASE_ORDER.filter((id) => PHASES[id].requiresPlayerDecision);
    expect(decisionPhases.sort()).toEqual(
      ['auctionBidding', 'campaignActions', 'electionEffectSelection', 'promiseSelection', 'unification'].sort(),
    );
  });
});

describe('getNextPhase (§7, §16 라운드 순환)', () => {
  it('cleanup은 마지막 라운드가 아니면 income으로 되돌아간다', () => {
    expect(getNextPhase('cleanup', 2, 5)).toBe('income');
  });

  it('cleanup은 마지막 라운드면 gameEnd로 간다', () => {
    expect(getNextPhase('cleanup', 5, 5)).toBe('gameEnd');
  });

  it('gameEnd는 종료 상태를 유지한다', () => {
    expect(getNextPhase('gameEnd', 5, 5)).toBe('gameEnd');
  });

  it('일반 phase는 PHASE_ORDER상 다음 항목으로 이동한다', () => {
    expect(getNextPhase('income', 1, 5)).toBe('issueReveal');
    expect(getNextPhase('auctionResolved', 1, 5)).toBe('promiseSelection');
  });
});

describe('잘못된 phase의 액션 거부 (§28)', () => {
  it('현재 phase와 맞지 않는 플레이어 액션은 한국어 사유와 함께 거부된다', () => {
    const state = setupGame({ seed: 1, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }], decks: testDecks() });
    // phase는 아직 'setup' — placeBid는 auctionBidding 전용이므로 거부되어야 한다
    const result = reduce(state, { type: 'placeBid', actor: 'player-0', allocations: {} }, emptyCatalog());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('할 수 없습니다');
    }
  });

  it('존재하지 않는 플레이어의 액션은 거부된다', () => {
    const state = setupGame({ seed: 1, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }], decks: testDecks() });
    const result = reduce(state, { type: 'fundraise', actor: 'player-99' }, emptyCatalog());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('존재하지 않는 플레이어');
    }
  });

  it("'setup' 단계에서 advancePhase는 거부되고 startGame만 허용된다", () => {
    const state = setupGame({ seed: 1, players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }], decks: testDecks() });
    const badResult = reduce(state, { type: 'advancePhase' }, emptyCatalog());
    expect(badResult.ok).toBe(false);

    const goodResult = reduce(state, { type: 'startGame' }, emptyCatalog());
    expect(goodResult.ok).toBe(true);
    if (goodResult.ok) {
      expect(goodResult.state.phase).toBe('income');
    }
  });
});
