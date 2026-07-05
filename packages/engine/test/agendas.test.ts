// 기반 스킬: skills/scoring/SKILL.md
// §17 비밀 의제 조건 11유형 평가기 단위 테스트 — 히스토리 참조 필수 케이스(candidateWon류) 포함
import { describe, expect, it } from 'vitest';
import { evaluateAgendaCondition } from '../src/rules/agendas';
import { setupGame } from '../src/setup';
import type { CandidateId, PlayerId, VoterGroupId } from '../src/types/ids';
import type { GameState, RoundHistoryEntry } from '../src/types/state';
import { testDecks } from './fixtures';

const PLAYERS4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

interface StateOverrides {
  policyTracks?: Partial<GameState['policyTracks']>;
  /** 플레이어별 필드 덮어쓰기 (id 키) */
  players?: Partial<Record<PlayerId, { reputation?: number; money?: number; markers?: Partial<Record<VoterGroupId, number>> }>>;
}

/** 평가기 단위 테스트용 상태 — setupGame 기반에 필요한 필드만 덮어쓴다 */
function mkState(overrides: StateOverrides = {}): GameState {
  const base = setupGame({ seed: 1, players: PLAYERS4, decks: testDecks() });
  return {
    ...base,
    policyTracks: { ...base.policyTracks, ...overrides.policyTracks },
    players: base.players.map((p) => {
      const patch = overrides.players?.[p.id];
      if (!patch) return p;
      return {
        ...p,
        reputation: patch.reputation ?? p.reputation,
        money: patch.money ?? p.money,
        influenceMarkers: patch.markers ?? p.influenceMarkers,
      };
    }),
  };
}

function history(...winners: Array<CandidateId | null>): RoundHistoryEntry[] {
  return winners.map((winnerCandidateId, i) => ({
    round: i + 1,
    winnerCandidateId,
    candidateVotes: {},
    policyTracksAfter: { economy: 0, labor: 0, society: 0, industry: 0, foreign: 0 },
    vpAwarded: {},
    influenceMarkersAwarded: {},
  }));
}

const C5 = 'candidate-5' as CandidateId;
const C9 = 'candidate-9' as CandidateId;

describe('§17 정책 트랙 조건', () => {
  it('policyAtLeast: direction 방향으로 minMagnitude 이상 이동해야 충족', () => {
    const met = mkState({ policyTracks: { economy: -2 } });
    expect(evaluateAgendaCondition({ kind: 'policyAtLeast', track: 'economy', direction: -1, minMagnitude: 2 }, 'player-0', met, [])).toBe(true);

    const unmet = mkState({ policyTracks: { economy: -1 } });
    expect(evaluateAgendaCondition({ kind: 'policyAtLeast', track: 'economy', direction: -1, minMagnitude: 2 }, 'player-0', unmet, [])).toBe(false);

    const plus = mkState({ policyTracks: { labor: 1 } });
    expect(evaluateAgendaCondition({ kind: 'policyAtLeast', track: 'labor', direction: 1, minMagnitude: 1 }, 'player-0', plus, [])).toBe(true);
  });

  it('policyBetween: min ≤ 값 ≤ max', () => {
    const state = mkState({ policyTracks: { industry: 1 } });
    expect(evaluateAgendaCondition({ kind: 'policyBetween', track: 'industry', min: 1, max: 2 }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'policyBetween', track: 'industry', min: -1, max: 0 }, 'player-0', state, [])).toBe(false);
  });

  it('noExtremePolicies: 어떤 트랙도 ±2(클램프 경계)에 있으면 안 된다', () => {
    const met = mkState({ policyTracks: { economy: 1, labor: -1 } });
    expect(evaluateAgendaCondition({ kind: 'noExtremePolicies' }, 'player-0', met, [])).toBe(true);

    const unmet = mkState({ policyTracks: { foreign: 2 } });
    expect(evaluateAgendaCondition({ kind: 'noExtremePolicies' }, 'player-0', unmet, [])).toBe(false);
  });
});

describe('§17 영향력 순위 조건 (공동 1위 = 1위 인정, 잠정 결정)', () => {
  it('influenceLeader: 단독 1위 충족, 뒤처지면 불충족, 마커 0이면 불충족', () => {
    const state = mkState({
      players: { 'player-0': { markers: { laborers: 3 } }, 'player-1': { markers: { laborers: 2 } } },
    });
    expect(evaluateAgendaCondition({ kind: 'influenceLeader', group: 'laborers' }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'influenceLeader', group: 'laborers' }, 'player-1', state, [])).toBe(false);
    // 아무도 마커가 없는 그룹은 1위 자체가 없다
    expect(evaluateAgendaCondition({ kind: 'influenceLeader', group: 'youth' }, 'player-0', state, [])).toBe(false);
  });

  it('influenceLeader: 공동 1위도 1위로 인정된다', () => {
    const state = mkState({
      players: { 'player-0': { markers: { laborers: 3 } }, 'player-1': { markers: { laborers: 3 } } },
    });
    expect(evaluateAgendaCondition({ kind: 'influenceLeader', group: 'laborers' }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'influenceLeader', group: 'laborers' }, 'player-1', state, [])).toBe(true);
  });

  it('influenceLeaderAny: 여러 그룹 중 하나라도 1위면 충족', () => {
    const state = mkState({
      players: { 'player-0': { markers: { seniors: 1 } }, 'player-1': { markers: { laborers: 5 } } },
    });
    expect(
      evaluateAgendaCondition({ kind: 'influenceLeaderAny', groups: ['laborers', 'seniors'] }, 'player-0', state, []),
    ).toBe(true);
    expect(
      evaluateAgendaCondition({ kind: 'influenceLeaderAny', groups: ['youth', 'farmers'] }, 'player-0', state, []),
    ).toBe(false);
  });

  it('notInfluenceLeader: 공동 1위는 불충족, 뒤처지거나 1위가 없으면 충족', () => {
    const tied = mkState({
      players: { 'player-0': { markers: { laborers: 3 } }, 'player-1': { markers: { laborers: 3 } } },
    });
    expect(evaluateAgendaCondition({ kind: 'notInfluenceLeader', group: 'laborers' }, 'player-0', tied, [])).toBe(false);

    const behind = mkState({
      players: { 'player-0': { markers: { laborers: 1 } }, 'player-1': { markers: { laborers: 3 } } },
    });
    expect(evaluateAgendaCondition({ kind: 'notInfluenceLeader', group: 'laborers' }, 'player-0', behind, [])).toBe(true);

    const empty = mkState();
    expect(evaluateAgendaCondition({ kind: 'notInfluenceLeader', group: 'laborers' }, 'player-0', empty, [])).toBe(true);
  });
});

describe('§17 후보 당선 이력 조건 — 라운드 히스토리 참조 (§28)', () => {
  it('candidateWon: 히스토리에 해당 후보 당선 기록이 있어야 충족', () => {
    const state = mkState();
    expect(evaluateAgendaCondition({ kind: 'candidateWon', candidateId: C5 }, 'player-0', state, history(C5, C9))).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'candidateWon', candidateId: C5 }, 'player-0', state, history(C9, null))).toBe(false);
  });

  it('candidateWonAtMost: 당선 횟수가 상한 이하여야 충족 (0회 포함)', () => {
    const state = mkState();
    const twice = history(C5, C5, C9);
    expect(evaluateAgendaCondition({ kind: 'candidateWonAtMost', candidateId: C5, maxTimes: 1 }, 'player-0', state, twice)).toBe(false);
    expect(evaluateAgendaCondition({ kind: 'candidateWonAtMost', candidateId: C5, maxTimes: 2 }, 'player-0', state, twice)).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'candidateWonAtMost', candidateId: C5, maxTimes: 1 }, 'player-0', state, history(C9))).toBe(true);
  });
});

describe('§17 자원 조건', () => {
  it('reputationAtLeast / remainingMoneyAtLeast', () => {
    const state = mkState({ players: { 'player-0': { reputation: 5, money: 14 } } });
    expect(evaluateAgendaCondition({ kind: 'reputationAtLeast', minAmount: 5 }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'reputationAtLeast', minAmount: 6 }, 'player-0', state, [])).toBe(false);
    expect(evaluateAgendaCondition({ kind: 'remainingMoneyAtLeast', minAmount: 14 }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'remainingMoneyAtLeast', minAmount: 15 }, 'player-0', state, [])).toBe(false);
  });

  it('reputationRankAtMost: 공동 1위는 둘 다 rank 1 (competition ranking)', () => {
    const state = mkState({
      players: {
        'player-0': { reputation: 5 },
        'player-1': { reputation: 5 },
        'player-2': { reputation: 3 },
        'player-3': { reputation: 1 },
      },
    });
    expect(evaluateAgendaCondition({ kind: 'reputationRankAtMost', maxRank: 1 }, 'player-0', state, [])).toBe(true);
    expect(evaluateAgendaCondition({ kind: 'reputationRankAtMost', maxRank: 1 }, 'player-1', state, [])).toBe(true);
    // p2는 공동 1위 2명 뒤라 rank 3
    expect(evaluateAgendaCondition({ kind: 'reputationRankAtMost', maxRank: 2 }, 'player-2', state, [])).toBe(false);
    expect(evaluateAgendaCondition({ kind: 'reputationRankAtMost', maxRank: 3 }, 'player-2', state, [])).toBe(true);
  });
});
