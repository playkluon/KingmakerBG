// 기반 스킬: skills/scoring/SKILL.md
// M5 관문 통합 테스트 (DEV_PLAN Phase 5 완료 조건):
// seed 고정 4인 5라운드(기본 maxRounds)가 액션 시퀀스로 끝까지 완주되고, 부록 A-14 카드 반환으로
// 후보/공약 덱이 소진되지 않는다는 것을 확인한다.
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { setupGame } from '../src/setup';
import type { GameAction } from '../src/types/actions';
import type { PlayerId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { placeholderCatalog, testDecks, walkThroughPartyAndProposal } from './fixtures';

const PLAYERS4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

/**
 * 4인 maxRounds라운드를 결정적 액션 시퀀스로 끝까지 완주한다.
 * 매 라운드 입찰→공약→캠페인(8회 조건지지)→단일화 스킵을 반복하고,
 * 라운드가 넘어갈 때마다 후보 공개 수·공약 제시 수가 항상 가득 차 있는지(부록 A-14) 기록한다.
 */
function playFullGame(seed: number, maxRounds = 5): { state: GameState; revealedCountsPerRound: number[] } {
  const catalog = placeholderCatalog();
  let state = setupGame({ seed, players: PLAYERS4, decks: testDecks(), maxRounds });
  const revealedCountsPerRound: number[] = [];

  const step = (action: GameAction) => {
    const result = reduce(state, action, catalog);
    if (!result.ok) throw new Error(`R${state.round.round} ${action.type} 실패: ${result.reason}`);
    state = result.state;
  };

  step({ type: 'startGame' });
  step({ type: 'runUntilPlayerAction' });

  while (state.phase !== 'gameEnd') {
    // 라운드 1은 정당 선택부터, 라운드 2+는 후보 제안부터 — 개편안 A·B의 결정 지점을 통과시킨다
    state = walkThroughPartyAndProposal(state, catalog);
    expect(state.phase).toBe('auctionBidding');
    revealedCountsPerRound.push(state.round.candidatesRevealed.length);

    const revealed = state.round.candidatesRevealed;
    const amounts = [6, 4, 3, 2] as const;
    (['player-0', 'player-1', 'player-2', 'player-3'] as const).forEach((actor, i) => {
      step({ type: 'placeBid', actor, allocations: { [revealed[i % revealed.length]!]: amounts[i]! } });
    });
    for (const actor of ['player-0', 'player-1', 'player-2', 'player-3'] as const) {
      step({ type: 'confirmAuctionBids', actor });
    }
    step({ type: 'runUntilPlayerAction' });
    expect(state.phase).toBe('promiseSelection');

    // 부록 A-14 검증: 출마 후보 3명 전원에게 공약 3장이 온전히 제시된다 (덱 고갈 없음)
    for (const candidateId of state.round.candidatesRunning) {
      expect(state.round.camps[candidateId]!.promiseOptions).toHaveLength(3);
    }

    for (const candidateId of [...state.round.candidatesRunning]) {
      if (state.phase !== 'promiseSelection') break;
      const camp = state.round.camps[candidateId]!;
      if (!camp.majorBacker) continue;
      step({ type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! });
    }
    if (state.phase === 'promiseSelection') step({ type: 'autoSelectPromises' });
    step({ type: 'runUntilPlayerAction' });
    expect(state.phase).toBe('campaignActions');

    const supportTarget = state.round.candidatesRunning[0]!;
    for (let i = 0; i < 8; i += 1) {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      step({ type: 'conditionalSupport', actor, candidateId: supportTarget });
    }
    expect(state.phase).toBe('unification');

    const majorBackers = new Set(
      state.round.candidatesRunning.map((id) => state.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null),
    );
    for (const actor of majorBackers) {
      step({ type: 'skipUnification', actor });
    }

    // voting→policy→scoring→cleanup까지, 마지막 라운드면 gameEnd까지, 아니면 다음 라운드 auctionBidding까지 자동 진행
    step({ type: 'runUntilPlayerAction' });
  }

  return { state, revealedCountsPerRound };
}

describe('M5 관문: 4인 5라운드(기본 maxRounds) 완주', () => {
  it('income부터 gameEnd까지 5라운드 전부 액션 시퀀스로 완주된다', () => {
    const { state, revealedCountsPerRound } = playFullGame(2026);
    expect(state.phase).toBe('gameEnd');
    expect(state.round.round).toBe(5);
    expect(state.roundHistory).toHaveLength(5);

    // 개편안 B: 공개 후보 수 = 제안한 플레이어 수. 정당 후보가 전부 당선되어 손패가 마른 플레이어는
    // 제안을 건너뛸 수 있으므로(진행 불가 방지) 라운드가 갈수록 줄어들 수는 있지만, 0이 되어 멈추지는 않는다.
    expect(revealedCountsPerRound).toHaveLength(5);
    expect(revealedCountsPerRound[0]).toBe(PLAYERS4.length);
    expect(revealedCountsPerRound.every((n) => n >= 1)).toBe(true);

    // 라운드 히스토리 전부 당선자·표가 기록된다
    for (const entry of state.roundHistory) {
      expect(entry.winnerCandidateId).not.toBeNull();
      expect(Object.keys(entry.candidateVotes).length).toBeGreaterThan(0);
    }
  });

  it('§16 최종 결과가 5라운드 누적 기준으로 확정된다', () => {
    const { state } = playFullGame(2026);
    const final = state.finalResult;
    expect(final).not.toBeNull();
    expect(final!.entries).toHaveLength(4);
    expect(final!.winners.length).toBeGreaterThanOrEqual(1);

    const maxTotal = Math.max(...final!.entries.map((e) => e.total));
    for (const winnerId of final!.winners) {
      const winnerEntry = final!.entries.find((e) => e.playerId === winnerId)!;
      expect(winnerEntry.rank).toBe(1);
      expect(winnerEntry.total).toBe(maxTotal);
    }

    // 목표대 리포트 — 30~45 VP 밖이어도 실패시키지 않고 기록만 남긴다 (DEV_PLAN M5 완료 조건)
    if (maxTotal < 30 || maxTotal > 45) {
      console.warn(`[M5 밸런스 리포트] 승자 총점 ${maxTotal}VP가 목표대(30~45)를 벗어남 — seed=2026, placeholder 카탈로그 기준`);
    }
  });

  it('같은 seed + 같은 액션 시퀀스 재생 = 완전히 동일한 최종 상태 (부록 A-5)', () => {
    const run1 = playFullGame(777);
    const run2 = playFullGame(777);
    expect(run1.state).toEqual(run2.state);
  });

  it('부록 A-14: 낙선/미출마 후보가 덱으로 되돌아가 이후 라운드에 재등장할 수 있다', () => {
    const { state } = playFullGame(2026, 7);
    // maxRounds=7 > 5라운드분 순수 소모(당선자만 5장)이므로, 순수 신규 카드만으로는 21장을 채 못 써도
    // 되돌아간 후보가 재순환되어 매 라운드 정상적으로 5장이 채워져야 한다.
    expect(state.phase).toBe('gameEnd');
    expect(state.roundHistory).toHaveLength(7);
  });
});
