// 기반 스킬: skills/scoring/SKILL.md
// §16 최종 점수와 승리 — 보너스 3종 + 동점 처리 v0.3
import { describe, expect, it } from 'vitest';
import { computeFinalResult } from '../src/rules/finalScoring';
import { setupGame } from '../src/setup';
import type { CardCatalog } from '../src/types/cards';
import type { AgendaId, PlayerId, VoterGroupId } from '../src/types/ids';
import type { GameState } from '../src/types/state';
import { emptyCatalog, testDecks } from './fixtures';

const PLAYERS4 = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

interface PlayerPatch {
  victoryPoints?: number;
  reputation?: number;
  money?: number;
  markers?: Partial<Record<VoterGroupId, number>>;
  agendaId?: AgendaId | null;
}

/** 최종 채점 단위 테스트용 상태 — 전원 자원을 0으로 깔고 필요한 값만 덮어쓴다 */
function mkState(patches: Partial<Record<PlayerId, PlayerPatch>> = {}): GameState {
  const base = setupGame({ seed: 1, players: PLAYERS4, decks: testDecks() });
  return {
    ...base,
    players: base.players.map((p) => {
      const patch = patches[p.id] ?? {};
      return {
        ...p,
        victoryPoints: patch.victoryPoints ?? 0,
        reputation: patch.reputation ?? 0,
        money: patch.money ?? 0,
        influenceMarkers: patch.markers ?? {},
        secretAgendaId: patch.agendaId !== undefined ? patch.agendaId : null,
      };
    }),
  };
}

function entryOf(state: GameState, catalog: CardCatalog, playerId: PlayerId) {
  return computeFinalResult(state, catalog).entries.find((e) => e.playerId === playerId)!;
}

describe('§16 최종 보너스', () => {
  it('남은 money 5마다 +1 VP (내림)', () => {
    const state = mkState({ 'player-0': { money: 12 } });
    expect(entryOf(state, emptyCatalog(), 'player-0').moneyBonusVp).toBe(2);
    expect(entryOf(state, emptyCatalog(), 'player-1').moneyBonusVp).toBe(0);
  });

  it('reputation 단독 1등만 +2 — 공동 1등이면 아무도 못 받는다', () => {
    const sole = mkState({ 'player-0': { reputation: 7 }, 'player-1': { reputation: 3 } });
    expect(entryOf(sole, emptyCatalog(), 'player-0').reputationBonusVp).toBe(2);
    expect(entryOf(sole, emptyCatalog(), 'player-1').reputationBonusVp).toBe(0);

    const tied = mkState({ 'player-0': { reputation: 7 }, 'player-1': { reputation: 7 } });
    expect(entryOf(tied, emptyCatalog(), 'player-0').reputationBonusVp).toBe(0);
    expect(entryOf(tied, emptyCatalog(), 'player-1').reputationBonusVp).toBe(0);
  });

  it('공개 계약 보너스는 Skill 12 전까지 항상 0', () => {
    const state = mkState({ 'player-0': { victoryPoints: 10 } });
    for (const entry of computeFinalResult(state, emptyCatalog()).entries) {
      expect(entry.contractBonusVp).toBe(0);
    }
  });
});

describe('§16-2 비밀 의제 점수 + 전원 공개', () => {
  it('의제 달성 시 배점이 더해지고 agendaId·agendaMet이 공개된다', () => {
    const agendaId = 'agenda-99' as AgendaId;
    const catalog: CardCatalog = {
      ...emptyCatalog(),
      agendas: {
        [agendaId]: {
          id: agendaId,
          name: '자금력 과시',
          description: '',
          condition: { kind: 'remainingMoneyAtLeast', minAmount: 10 },
          points: 9,
        },
      },
    };
    const state = mkState({
      'player-0': { agendaId, money: 10 }, // 달성
      'player-1': { agendaId, money: 4 }, // 미달성
    });
    const met = entryOf(state, catalog, 'player-0');
    expect(met.agendaId).toBe(agendaId);
    expect(met.agendaMet).toBe(true);
    expect(met.agendaVp).toBe(9);
    expect(met.total).toBe(9 + 2); // 의제 9 + money 10/5=2

    const unmet = entryOf(state, catalog, 'player-1');
    expect(unmet.agendaMet).toBe(false);
    expect(unmet.agendaVp).toBe(0);
  });

  it('total은 항목 분해의 합과 항상 일치한다', () => {
    const state = mkState({
      'player-0': { victoryPoints: 11, money: 7, reputation: 4 },
      'player-1': { victoryPoints: 8, money: 15 },
    });
    for (const entry of computeFinalResult(state, emptyCatalog()).entries) {
      expect(entry.total).toBe(entry.baseVp + entry.agendaVp + entry.moneyBonusVp + entry.reputationBonusVp + entry.contractBonusVp);
    }
  });
});

describe('§16 동점 처리 v0.3', () => {
  it('총점이 같으면 공개 VP가 높은 쪽이 이긴다', () => {
    // p0: baseVp 10 → total 10 / p1: baseVp 8 + money 10(+2) → total 10
    const state = mkState({
      'player-0': { victoryPoints: 10 },
      'player-1': { victoryPoints: 8, money: 10 },
    });
    const result = computeFinalResult(state, emptyCatalog());
    expect(result.winners).toEqual(['player-0']);
    expect(entryOf(state, emptyCatalog(), 'player-0').rank).toBe(1);
    expect(entryOf(state, emptyCatalog(), 'player-1').rank).toBe(2);
  });

  it('공개 VP까지 같으면 reputation → money → 마커 총합 순으로 가른다', () => {
    // 단독 1등 reputation 보너스가 개입하지 않도록 rep은 p2에게 최고를 준다
    const state = mkState({
      'player-0': { victoryPoints: 6, money: 3, markers: { laborers: 2 } },
      'player-1': { victoryPoints: 6, money: 3, markers: { laborers: 1 } },
      'player-2': { reputation: 9 }, // rep 단독 1등 +2 = total 2 (승부와 무관)
    });
    const result = computeFinalResult(state, emptyCatalog());
    // p0/p1: total 6, baseVp 6, rep 0, money 3 동일 → 마커 총합 2 vs 1로 p0 승
    expect(result.winners).toEqual(['player-0']);
  });

  it('모든 판정 기준이 같으면 공동 승리다', () => {
    const state = mkState({
      'player-0': { victoryPoints: 9, money: 3 },
      'player-1': { victoryPoints: 9, money: 3 },
    });
    const result = computeFinalResult(state, emptyCatalog());
    expect(result.winners.sort()).toEqual(['player-0', 'player-1']);
    expect(entryOf(state, emptyCatalog(), 'player-0').rank).toBe(1);
    expect(entryOf(state, emptyCatalog(), 'player-1').rank).toBe(1);
    // 3위(=rank 3)는 공동 1위 2명 뒤 (competition ranking)
    expect(entryOf(state, emptyCatalog(), 'player-2').rank).toBe(3);
  });
});
