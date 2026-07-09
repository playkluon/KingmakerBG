// 기반 스킬: skills/scoring/SKILL.md
// 부록 A-25 회귀 테스트: 4인이 정당 2개(party-01/02)에 2명씩 몰리면 각 정당의 후보 3장을
// 두 사람이 나눠 써야 해서 몇 라운드 만에 손패가 완전히 고갈된다. candidatesRevealed가 0이 되면
// promiseSelection·unification·electionEffectSelection이 "결정할 사람이 아무도 없는" 상태로
// 진입하는데, 예전에는 requiresPlayerDecision=true라는 이유만으로 여기서 영구 정지했다.
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { setupGame } from '../src/setup';
import type { GameAction } from '../src/types/actions';
import type { PlayerId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { placeholderCatalog, testDecks } from './fixtures';

const PLAYERS4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

/** 정당 2개에 2명씩 강제로 몰아 손패 공유 최악 케이스를 만든다 (실서버 AI 그리디 가입과 동일 결과) */
function playWorstCaseClustering(maxRounds: number): GameState {
  const catalog = placeholderCatalog();
  let state = setupGame({ seed: 2026, players: PLAYERS4, decks: testDecks(), maxRounds });

  const step = (action: GameAction) => {
    const result = reduce(state, action, catalog);
    if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
    state = result.state;
  };

  step({ type: 'startGame' });
  step({ type: 'runUntilPlayerAction' });

  const forcedParty: Record<string, string> = {
    'player-0': 'party-01',
    'player-1': 'party-01',
    'player-2': 'party-02',
    'player-3': 'party-02',
  };
  for (const p of state.players) {
    step({ type: 'selectParty', actor: p.id, partyId: forcedParty[p.id] as any });
  }
  step({ type: 'runUntilPlayerAction' });

  for (let guard = 0; guard < 3000 && state.phase !== 'gameEnd'; guard += 1) {
    if (state.phase === 'candidateProposal') {
      for (const player of state.players) {
        if (state.phase !== 'candidateProposal') break;
        const current = state.players.find((p) => p.id === player.id)!;
        if (state.round.proposals[player.id] || current.hand.length === 0) continue;
        step({ type: 'proposeCandidate', actor: player.id, candidateId: current.hand[0]! });
      }
      step({ type: 'runUntilPlayerAction' });
    } else if (state.phase === 'auctionBidding') {
      for (const player of state.players) {
        if (state.round.bids[player.id]?.confirmed) continue;
        const revealed = state.round.candidatesRevealed;
        const seatIndex = Math.max(0, state.players.findIndex((p) => p.id === player.id));
        const target = revealed[seatIndex % Math.max(1, revealed.length)];
        const allocations = target && player.money > 0 ? { [target]: Math.min(player.money, 4) } : {};
        step({ type: 'placeBid', actor: player.id, allocations });
        step({ type: 'confirmAuctionBids', actor: player.id });
      }
      step({ type: 'runUntilPlayerAction' });
    } else if (state.phase === 'promiseSelection') {
      for (const candidateId of [...state.round.candidatesRunning]) {
        if (state.phase !== 'promiseSelection') break;
        const camp = state.round.camps[candidateId];
        if (!camp?.majorBacker || camp.promiseId) continue;
        step({ type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! });
      }
      if (state.phase === 'promiseSelection') step({ type: 'autoSelectPromises' });
      step({ type: 'runUntilPlayerAction' });
    } else if (state.phase === 'campaignActions') {
      let campGuard = 0;
      while (state.phase === 'campaignActions' && campGuard < 50) {
        campGuard += 1;
        const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
        const myBackedCandidate = state.round.candidatesRunning.find((id) => state.round.camps[id]?.majorBacker === actor);
        if (myBackedCandidate) {
          step({ type: 'conditionalSupport', actor, candidateId: myBackedCandidate });
        } else if (state.round.candidatesRunning.length > 0) {
          step({ type: 'conditionalSupport', actor, candidateId: state.round.candidatesRunning[0]! });
        } else {
          // 출마 후보가 아예 없는 라운드 — 자원 상황과 무관하게 항상 성립하는 액션을 골라 쓴다
          const fallbacks: GameAction[] = [
            { type: 'fundraise', actor },
            { type: 'pressurePolicy', actor, track: 'economy', direction: 1 },
            { type: 'contactVoter', actor, voterId: state.round.votersRevealed[0] as never },
          ];
          const legal = fallbacks.find((a) => reduce(state, a, catalog).ok) ?? fallbacks[0]!;
          step(legal);
        }
        step({ type: 'runUntilPlayerAction' });
      }
    } else if (state.phase === 'unification') {
      step({ type: 'runUntilPlayerAction' });
      let uniGuard = 0;
      while (state.phase === 'unification' && uniGuard < 10) {
        uniGuard += 1;
        const remaining = state.round.candidatesRunning
          .map((id) => state.round.camps[id]?.majorBacker)
          .find((id): id is PlayerId => id != null && !state.round.unificationDone[id]);
        if (!remaining) break;
        step({ type: 'skipUnification', actor: remaining });
        step({ type: 'runUntilPlayerAction' });
      }
    } else if (state.phase === 'electionEffectSelection') {
      step({ type: 'runUntilPlayerAction' });
      if (state.phase === 'electionEffectSelection') {
        const winner = state.round.winnerCandidateId!;
        const backer = state.round.camps[winner]!.majorBacker!;
        step({ type: 'selectElectionPolicyMove', actor: backer, track: 'economy', direction: 1 });
      }
    } else {
      step({ type: 'runUntilPlayerAction' });
    }
  }

  return state;
}

describe('부록 A-25: 결정할 사람이 없는 phase의 자동 해소', () => {
  it('정당 2개에 4인이 몰려 손패가 완전히 고갈돼도(candidatesRevealed=0) gameEnd까지 진행된다', () => {
    const state = playWorstCaseClustering(12);
    expect(state.phase).toBe('gameEnd');
    expect(state.roundHistory).toHaveLength(12);

    // 후반 라운드는 출마 후보가 아예 없어야 이 회귀 테스트가 실제로 A-25 경로를 검증한 것이다
    const emptyRounds = state.roundHistory.filter((h) => h.winnerCandidateId === null);
    expect(emptyRounds.length).toBeGreaterThan(0);
  });
});
