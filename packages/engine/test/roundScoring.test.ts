// 기반 스킬: skills/scoring/SKILL.md
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import {
  SCORE_CO_BACKER_WIN,
  SCORE_MAJOR_BACKER_WIN,
  SCORE_PROMISE_BONUS_MAJOR_BACKER,
  SCORE_RUNNER_UP_MAJOR_BACKER,
} from '../src/constants';
import type { CardCatalog, CandidateCard } from '../src/types/cards';
import type { CandidateId, PlayerId } from '../src/types/ids';
import type { GameAction } from '../src/types/actions';
import type { GameState } from '../src/types/state';
import { bid, confirm, emptyCatalog, setupAtAuction, setupAtCampaign } from './fixtures';

const PLAYERS4: [string, string, string, string] = ['A', 'B', 'C', 'D'];

/** reduce를 실행하고 실패 시 즉시 테스트를 실패시키는 헬퍼 */
function run(state: GameState, action: GameAction, catalog: CardCatalog = emptyCatalog()): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
  return result.state;
}

function candidate(id: CandidateId, baseVotes: number): CandidateCard {
  return {
    id,
    name: id,
    description: '',
    baseVotes,
    leaningTags: ['x'],
    supportedVoterGroups: ['laborers'],
    // economy 고정 효과 — 압박 테스트와 간섭하지 않도록 society는 피한다
    electionEffect: { kind: 'fixedPolicyMove', track: 'economy', direction: 1, amount: 1 },
    abilities: [],
  };
}

/** 출마 후보 3명에 10/5/1 기본표를 줘 승자·2위를 고정하는 카탈로그 */
function rankedCatalog(state: GameState): CardCatalog {
  const [c0, c1, c2] = state.round.candidatesRunning;
  return {
    ...emptyCatalog(),
    candidates: { [c0!]: candidate(c0!, 10), [c1!]: candidate(c1!, 5), [c2!]: candidate(c2!, 1) },
  };
}

/** promiseSelection에 멈춘 상태에서 majorBacker 전원 선택 + 자동 선택으로 통과시킨다 */
function completePromiseSelection(state: GameState): GameState {
  let next = state;
  for (const candidateId of [...next.round.candidatesRunning]) {
    if (next.phase !== 'promiseSelection') break;
    const camp = next.round.camps[candidateId]!;
    if (!camp.majorBacker) continue;
    next = run(next, { type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! });
  }
  if (next.phase === 'promiseSelection') next = run(next, { type: 'autoSelectPromises' });
  return next;
}

/** 캠페인이 끝난(unification) 상태에서 전원 스킵 → resolveVoting → resolvePolicy까지 진행해 roundScoring에 멈춘다 */
function playToScoring(state: GameState, catalog: CardCatalog): GameState {
  let next = state;
  const majorBackers = new Set(
    next.round.candidatesRunning.map((id) => next.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null),
  );
  for (const actor of majorBackers) {
    next = run(next, { type: 'skipUnification', actor });
  }
  expect(next.phase).toBe('voting');
  next = run(next, { type: 'resolveVoting' }, catalog);
  expect(next.phase).toBe('policyResolution'); // fixedPolicyMove라 선택 없이 통과
  next = run(next, { type: 'resolvePolicy' }, catalog);
  expect(next.phase).toBe('roundScoring');
  return next;
}

function vpOf(state: GameState, playerId: PlayerId): number {
  return state.players.find((p) => p.id === playerId)!.victoryPoints;
}

describe('§15 캠프 역할 VP (scoring v1)', () => {
  it('당선 majorBacker +4+1(공약 보너스), coBacker +2, 2위 majorBacker +1', () => {
    let state = setupAtAuction(1, PLAYERS4);
    const [c0, c1] = state.round.candidatesRevealed;
    // c0: p0(6, major) + p1(3, co) = 9 / c1: p2(4, major) + p3(2, co) = 6 / 3번째는 무입찰 후보
    state = bid(state, 'player-0', { [c0!]: 6 });
    state = bid(state, 'player-1', { [c0!]: 3 });
    state = bid(state, 'player-2', { [c1!]: 4 });
    state = bid(state, 'player-3', { [c1!]: 2 });
    for (const actor of ['player-0', 'player-1', 'player-2', 'player-3'] as const) state = confirm(state, actor);

    state = run(state, { type: 'runUntilPlayerAction' });
    state = completePromiseSelection(state);
    state = run(state, { type: 'runUntilPlayerAction' });
    expect(state.phase).toBe('campaignActions');

    // 표 변화 없는 모금으로 8액션 소진 (전원 rep 2 -> 0)
    for (let i = 0; i < 8; i += 1) {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      state = run(state, { type: 'fundraise', actor });
    }

    // c0=10표, c1=5표, 3번째=1표로 고정 -> 승자 c0, 2위 c1
    const catalog = (() => {
      const [r0, r1, r2] = state.round.candidatesRunning;
      // 경매 총액 순서상 r0=c0, r1=c1이지만 안전하게 재확인해 배점한다
      const votes = new Map([[c0!, 10], [c1!, 5]]);
      return {
        ...emptyCatalog(),
        candidates: Object.fromEntries(
          [r0!, r1!, r2!].map((id) => [id, candidate(id, votes.get(id) ?? 1)]),
        ),
      } as CardCatalog;
    })();

    state = playToScoring(state, catalog);
    state = run(state, { type: 'scoreRound' }, catalog);

    expect(vpOf(state, 'player-0')).toBe(SCORE_MAJOR_BACKER_WIN + SCORE_PROMISE_BONUS_MAJOR_BACKER); // 5
    expect(vpOf(state, 'player-1')).toBe(SCORE_CO_BACKER_WIN); // 2
    expect(vpOf(state, 'player-2')).toBe(SCORE_RUNNER_UP_MAJOR_BACKER); // 1
    expect(vpOf(state, 'player-3')).toBe(0);

    // §28: 라운드 점수 이유가 플레이어별로 남는다
    expect(state.round.vpAwardedThisRound['player-0']).toBe(5);
    const breakdown = state.lastRoundResult!.vpBreakdown['player-0']!;
    expect(breakdown.total).toBe(5);
    expect(breakdown.reasons.map((r) => r.field).sort()).toEqual(['majorBackerWin', 'promiseBonus']);
  });
});

describe('§15 조건지지 성공', () => {
  it('당선 후보에게 조건지지한 액션 1회당 +1, 낙선 후보 지지는 0', () => {
    let state = setupAtCampaign(2, PLAYERS4);
    const [c0, c1] = state.round.candidatesRunning;

    const actions: Array<GameAction> = [
      { type: 'conditionalSupport', actor: 'player-0', candidateId: c0! },
      { type: 'conditionalSupport', actor: 'player-1', candidateId: c1! },
      { type: 'conditionalSupport', actor: 'player-2', candidateId: c0! },
      { type: 'fundraise', actor: 'player-3' },
      { type: 'fundraise', actor: 'player-0' },
      { type: 'fundraise', actor: 'player-1' },
      { type: 'fundraise', actor: 'player-2' },
      { type: 'fundraise', actor: 'player-3' },
    ];
    for (const action of actions) state = run(state, action);

    const catalog = rankedCatalog(state);
    state = playToScoring(state, catalog);
    state = run(state, { type: 'scoreRound' }, catalog);

    const effects = state.actionLog.at(-1)!.effects;
    const csEffects = effects.filter((e) => e.field === 'conditionalSupportSuccess');
    expect(csEffects.map((e) => e.target).sort()).toEqual(['player-0', 'player-2']);
    // p1의 조건지지는 2위 후보(c1) 대상이라 성공 보너스가 없다
  });
});

describe('§15 정책 압박 성공', () => {
  it('resolvePolicy가 실제 반영한 트랙·방향에 기여한 플레이어만 +1', () => {
    let state = setupAtCampaign(3, PLAYERS4);

    const actions: Array<GameAction> = [
      { type: 'pressurePolicy', actor: 'player-0', track: 'society', direction: 1 },
      { type: 'fundraise', actor: 'player-1' },
      { type: 'fundraise', actor: 'player-2' },
      { type: 'fundraise', actor: 'player-3' },
      { type: 'fundraise', actor: 'player-0' },
      { type: 'fundraise', actor: 'player-1' },
      { type: 'fundraise', actor: 'player-2' },
      { type: 'fundraise', actor: 'player-3' },
    ];
    for (const action of actions) state = run(state, action);

    const catalog = rankedCatalog(state);
    state = playToScoring(state, catalog);
    expect(state.policyTracks.society).toBe(1); // 압박 +1 반영 확인
    state = run(state, { type: 'scoreRound' }, catalog);

    const effects = state.actionLog.at(-1)!.effects;
    expect(effects.filter((e) => e.field === 'policyPressureSuccess').map((e) => e.target)).toEqual(['player-0']);
  });
});

describe('§15 통제 유권자 지지 VP 상한 + §10 영향력 마커', () => {
  it('4인 게임은 지지 VP가 라운드 1로 상한되고, 마커는 상한 없이 전부 누적된다', () => {
    let state = setupAtCampaign(4, PLAYERS4);
    const [c0] = state.round.candidatesRunning;
    const [v0, v1] = state.round.votersRevealed;

    // p0이 유권자 2명을 통제(접촉 2액션)하고 전부 c0에 배치(무료)
    state = run(state, { type: 'contactVoter', actor: 'player-0', voterId: v0! });
    state = run(state, { type: 'fundraise', actor: 'player-1' });
    state = run(state, { type: 'fundraise', actor: 'player-2' });
    state = run(state, { type: 'fundraise', actor: 'player-3' });
    state = run(state, { type: 'contactVoter', actor: 'player-0', voterId: v1! });
    state = run(state, { type: 'assignVoterChoice', actor: 'player-0', voterId: v0!, candidateId: c0! });
    state = run(state, { type: 'assignVoterChoice', actor: 'player-0', voterId: v1!, candidateId: c0! });
    state = run(state, { type: 'fundraise', actor: 'player-1' });
    state = run(state, { type: 'fundraise', actor: 'player-2' });
    state = run(state, { type: 'fundraise', actor: 'player-3' });
    expect(state.phase).toBe('unification');

    // c0 당선 고정 + 배치 유권자의 선호가 c0 공약과 일치하도록 카탈로그 구성
    const c0PromiseId = state.round.camps[c0!]!.promiseId!;
    const catalog: CardCatalog = {
      ...rankedCatalog(state),
      promises: {
        [c0PromiseId]: {
          id: c0PromiseId,
          name: '테스트공약',
          description: '',
          policyMove: { track: 'economy', direction: 1, amount: 1 },
          reactionTag: 'X',
          effect: { kind: 'extraVotes', amount: 0 },
        },
      },
      voters: Object.fromEntries(
        [v0!, v1!].map((id) => [
          id,
          { id, name: id, description: '', group: 'laborers', voteWeight: 1, preferredTag: 'X', conflictTag: 'Y' },
        ]),
      ),
    };

    state = playToScoring(state, catalog);
    state = run(state, { type: 'scoreRound' }, catalog);

    // 지지 VP는 상한 1 (유권자 2명이 당선 후보를 지지했어도)
    const effects = state.actionLog.at(-1)!.effects;
    expect(effects.filter((e) => e.field === 'voterSupportWinner')).toHaveLength(1);

    // 마커는 상한 없이 2개 누적 (§10 "표를 행사한 통제 유권자")
    const p0 = state.players.find((p) => p.id === 'player-0')!;
    expect(p0.influenceMarkers['laborers']).toBe(2);
    expect(state.round.markersAwardedThisRound['player-0']).toEqual({ laborers: 2 });
  });
});
