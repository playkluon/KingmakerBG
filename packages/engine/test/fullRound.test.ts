// 기반 스킬: skills/scoring/SKILL.md
// M3 관문 통합 테스트 (DEV_PLAN Phase 3 완료 조건):
// seed 고정 4인 1라운드가 income→cleanup(→gameEnd)까지 액션 시퀀스로 완주하고, 재생 시 동일 상태가 나온다.
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { setupGame } from '../src/setup';
import type { GameAction } from '../src/types/actions';
import type { PlayerId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { placeholderCatalog, testDecks, walkThroughPartyAndProposal } from './fixtures';

const PLAYERS4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

/**
 * 4인 1라운드(maxRounds=1)를 결정적 액션 시퀀스로 완주한다.
 * 모든 결정 지점(입찰→공약→캠페인→단일화)을 지나 gameEnd까지 도달한 최종 상태를 반환한다.
 */
function playFullRound(seed: number): GameState {
  const catalog = placeholderCatalog();
  let state = setupGame({ seed, players: PLAYERS4, decks: testDecks(), maxRounds: 1 });

  const step = (action: GameAction) => {
    const result = reduce(state, action, catalog);
    if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
    state = result.state;
  };

  step({ type: 'startGame' });
  step({ type: 'runUntilPlayerAction' });
  expect(state.phase).toBe('partySelection'); // 결정 지점 0: 정당 선택 (개편안 A)
  state = walkThroughPartyAndProposal(state, catalog); // 정당 선택 → income → 사전 이슈 → 후보 제안 → 반전 이슈
  expect(state.phase).toBe('auctionBidding'); // 결정 지점 1: 입찰

  const [c0, c1, c2, c3] = state.round.candidatesRevealed;
  step({ type: 'placeBid', actor: 'player-0', allocations: { [c0!]: 6 } });
  step({ type: 'placeBid', actor: 'player-1', allocations: { [c1!]: 4 } });
  step({ type: 'placeBid', actor: 'player-2', allocations: { [c2!]: 3 } });
  step({ type: 'placeBid', actor: 'player-3', allocations: { [c3!]: 2 } });
  for (const actor of ['player-0', 'player-1', 'player-2', 'player-3'] as const) {
    step({ type: 'confirmAuctionBids', actor });
  }
  step({ type: 'runUntilPlayerAction' });
  expect(state.phase).toBe('promiseSelection'); // 결정 지점 2: 공약

  for (const candidateId of [...state.round.candidatesRunning]) {
    if (state.phase !== 'promiseSelection') break;
    const camp = state.round.camps[candidateId]!;
    if (!camp.majorBacker) continue;
    step({ type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! });
  }
  if (state.phase === 'promiseSelection') step({ type: 'autoSelectPromises' });
  step({ type: 'runUntilPlayerAction' });
  expect(state.phase).toBe('campaignActions'); // 결정 지점 3: 캠페인

  const supportTarget = state.round.candidatesRunning[0]!;
  for (let i = 0; i < 8; i += 1) {
    const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
    step({ type: 'conditionalSupport', actor, candidateId: supportTarget });
  }
  expect(state.phase).toBe('unification'); // 결정 지점 4: 단일화

  const majorBackers = new Set(
    state.round.candidatesRunning.map((id) => state.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null),
  );
  for (const actor of majorBackers) {
    step({ type: 'skipUnification', actor });
  }
  expect(state.phase).toBe('voting');

  // voting → (당선 효과 fixed 자동 확정) → policyResolution → roundScoring → cleanup → gameEnd
  step({ type: 'runUntilPlayerAction' });
  return state;
}

describe('M3 관문: 4인 1라운드 완주', () => {
  it('income부터 gameEnd까지 액션 시퀀스로 완주된다', () => {
    const state = playFullRound(2026);
    expect(state.phase).toBe('gameEnd');

    // 라운드 히스토리가 정확히 1건 기록되고 당선자·표가 남는다 (§17 의제 평가의 근거)
    expect(state.roundHistory).toHaveLength(1);
    const entry = state.roundHistory[0]!;
    expect(entry.round).toBe(1);
    expect(entry.winnerCandidateId).not.toBeNull();
    expect(Object.keys(entry.candidateVotes).length).toBeGreaterThan(0);
    expect(entry.winnerCandidateId).toBe(state.round.winnerCandidateId);

    // 당선 캠프 majorBacker의 VP 사유가 히스토리에 남는다 (§28)
    const winnerCamp = state.round.camps[entry.winnerCandidateId!]!;
    expect(entry.vpAwarded[winnerCamp.majorBacker!]).toBeGreaterThanOrEqual(5); // major 4 + 공약 보너스 1
  });

  it('§16 최종 결과가 항목 분해와 함께 확정된다', () => {
    const state = playFullRound(2026);
    const final = state.finalResult;
    expect(final).not.toBeNull();
    expect(final!.entries).toHaveLength(4);
    expect(final!.winners.length).toBeGreaterThanOrEqual(1);

    for (const entry of final!.entries) {
      // 전원 비밀 의제 공개 (§16)
      expect(entry.agendaId).not.toBeNull();
      // 항목 분해 합계 일치
      expect(entry.total).toBe(entry.baseVp + entry.agendaVp + entry.moneyBonusVp + entry.reputationBonusVp + entry.contractBonusVp);
    }

    // 승자는 rank 1이고, 최고 총점 보유자다
    const maxTotal = Math.max(...final!.entries.map((e) => e.total));
    for (const winnerId of final!.winners) {
      const winnerEntry = final!.entries.find((e) => e.playerId === winnerId)!;
      expect(winnerEntry.rank).toBe(1);
      expect(winnerEntry.total).toBe(maxTotal);
    }
  });

  it('같은 seed + 같은 액션 시퀀스 재생 = 완전히 동일한 최종 상태 (부록 A-5)', () => {
    const run1 = playFullRound(777);
    const run2 = playFullRound(777);
    expect(run1).toEqual(run2);
  });

  it('다른 seed는 다른 전개를 만들 수 있다 (카드 셔플 확인)', () => {
    const runA = playFullRound(1);
    const runB = playFullRound(999);
    // 후보 제안은 손패(정당 소속) 기준이라 seed 무관 — 셔플 영향은 이슈·유권자 덱에서 확인한다
    const dealA = [...runA.round.firstIssues, ...runA.round.secondIssues, ...runA.round.votersRevealed];
    const dealB = [...runB.round.firstIssues, ...runB.round.secondIssues, ...runB.round.votersRevealed];
    expect(dealA).not.toEqual(dealB);
  });
});
