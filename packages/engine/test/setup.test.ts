// 기반 스킬: skills/engine-core/SKILL.md
import { describe, expect, it } from 'vitest';
import { setupGame } from '../src/setup';
import { getPlayerCountConfig, PLAYER_COUNT_CONFIGS, STARTING_MONEY } from '../src/constants';
import { testDecks } from './fixtures';

const players = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `브로커${i + 1}` }));

describe('setupGame 결정성 (§28: seed가 같으면 setup 결과가 같다)', () => {
  it('같은 seed + 같은 플레이어 입력이면 완전히 동일한 GameState를 만든다', () => {
    const a = setupGame({ seed: 12345, players: players(4), decks: testDecks() });
    const b = setupGame({ seed: 12345, players: players(4), decks: testDecks() });
    expect(a).toEqual(b);
  });

  it('다른 seed면 카드 셔플 순서가 달라진다', () => {
    const a = setupGame({ seed: 1, players: players(4), decks: testDecks() });
    const b = setupGame({ seed: 2, players: players(4), decks: testDecks() });
    expect(a.drawPiles.candidateDeck).not.toEqual(b.drawPiles.candidateDeck);
  });
});

describe('인원별 설정표 (§3)', () => {
  it('4/5/6/7인 설정이 GAME_SPEC.md §3 표와 일치한다', () => {
    expect(PLAYER_COUNT_CONFIGS[4]).toMatchObject({
      revealedCandidates: 5,
      runningCandidates: 3,
      revealedVoters: 5,
      campSlots: ['majorBacker', 'coBacker'],
      campaignActionsPerPlayer: 2,
      kingmakerBonusEnabled: false,
    });
    expect(PLAYER_COUNT_CONFIGS[5]).toMatchObject({
      revealedCandidates: 6,
      runningCandidates: 3,
      revealedVoters: 6,
      campSlots: ['majorBacker', 'coBacker'],
      kingmakerBonusEnabled: false,
    });
    expect(PLAYER_COUNT_CONFIGS[6]).toMatchObject({
      revealedCandidates: 7,
      runningCandidates: 3,
      revealedVoters: 7,
      campSlots: ['majorBacker', 'coBacker', 'organizer'],
      kingmakerBonusEnabled: true,
    });
    expect(PLAYER_COUNT_CONFIGS[7]).toMatchObject({
      revealedCandidates: 8,
      runningCandidates: 3,
      revealedVoters: 8,
      campSlots: ['majorBacker', 'coBacker', 'organizer'],
      kingmakerBonusEnabled: true,
    });
  });

  it('4~7인 밖의 인원수는 지원하지 않는다', () => {
    expect(() => getPlayerCountConfig(3)).toThrow();
    expect(() => getPlayerCountConfig(8)).toThrow();
    expect(() => setupGame({ seed: 1, players: players(3), decks: testDecks() })).toThrow();
  });
});

describe('setupGame 초기 상태', () => {
  it('좌석·시작 자원·phase가 올바르게 초기화된다', () => {
    const state = setupGame({ seed: 42, players: players(4), decks: testDecks() });
    expect(state.phase).toBe('setup');
    expect(state.schemaVersion).toBe('0.2');
    expect(state.round.round).toBe(1);
    expect(state.players).toHaveLength(4);
    state.players.forEach((p, seat) => {
      expect(p.seat).toBe(seat);
      expect(p.id).toBe(`player-${seat}`);
      expect(p.money).toBe(STARTING_MONEY);
    });
  });

  it('플레이어마다 서로 다른 비밀 의제를 1장씩 배분한다 (부록 A-7)', () => {
    const state = setupGame({ seed: 7, players: players(7), decks: testDecks() });
    const agendaIds = state.players.map((p) => p.secretAgendaId);
    expect(agendaIds.every((id) => id !== null)).toBe(true);
    expect(new Set(agendaIds).size).toBe(7);
    expect(state.drawPiles.agendaDeck).toHaveLength(16 - 7);
  });
});
