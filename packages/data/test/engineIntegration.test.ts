// 기반 스킬: skills/card-data/SKILL.md
// DEV_PLAN.md M2 완료 조건: "Phase 1의 setup.ts가 실데이터로 교체되어도 결정성 테스트 유지"
import { reduce, setupGame } from '@kingmakers/engine';
import type { DrawPiles, GameAction } from '@kingmakers/engine';
import { describe, expect, it } from 'vitest';
import { AGENDAS } from '../src/agendas';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { ISSUES } from '../src/issues';
import { PROMISES } from '../src/promises';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';

/** 실제 카드 데이터로 엔진의 DrawPiles를 구성한다 — apps/server가 실제로 하게 될 일과 동일하다 */
function realDecks(): DrawPiles {
  return {
    candidateDeck: CANDIDATES.map((c) => c.id),
    promiseDeck: PROMISES.map((p) => p.id),
    voterDeck: VOTERS.map((v) => v.id),
    issueDeck: ISSUES.map((i) => i.id),
    candidateEventDeck: CANDIDATE_EVENTS.map((e) => e.id),
    voterEventDeck: VOTER_EVENTS.map((e) => e.id),
    agendaDeck: AGENDAS.map((a) => a.id),
  };
}

const players = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];

describe('실카드 데이터 + 엔진 setupGame 통합', () => {
  it('실카드 ID로 초기화해도 같은 seed는 같은 결과를 만든다', () => {
    const a = setupGame({ seed: 555, players, decks: realDecks() });
    const b = setupGame({ seed: 555, players, decks: realDecks() });
    expect(a).toEqual(b);
  });

  it('셔플만 할 뿐 카드를 소실하지 않는다 (의제 덱만 플레이어 수만큼 배분되어 줄어든다)', () => {
    const state = setupGame({ seed: 1, players, decks: realDecks() });
    expect(state.drawPiles.candidateDeck).toHaveLength(21);
    expect(state.drawPiles.promiseDeck).toHaveLength(30);
    expect(state.drawPiles.voterDeck).toHaveLength(48);
    expect(state.drawPiles.issueDeck).toHaveLength(15);
    expect(state.drawPiles.candidateEventDeck).toHaveLength(30);
    expect(state.drawPiles.voterEventDeck).toHaveLength(30);
    expect(state.drawPiles.agendaDeck).toHaveLength(16 - players.length);
  });

  it('플레이어에게 배분된 비밀 의제 ID는 실제 AGENDAS에 존재하는 카드다', () => {
    const state = setupGame({ seed: 2, players, decks: realDecks() });
    const agendaIds = new Set(AGENDAS.map((a) => a.id));
    state.players.forEach((p) => {
      expect(p.secretAgendaId).not.toBeNull();
      expect(agendaIds.has(p.secretAgendaId!)).toBe(true);
    });
  });

  it('실카드 데이터로도 startGame → runUntilPlayerAction 시퀀스가 결정적으로 재생된다', () => {
    const sequence: GameAction[] = [{ type: 'startGame' }, { type: 'runUntilPlayerAction' }];

    const run = () => {
      let state = setupGame({ seed: 2026, players, decks: realDecks() });
      for (const action of sequence) {
        const result = reduce(state, action);
        if (!result.ok) throw new Error(`재생 실패: ${result.reason}`);
        state = result.state;
      }
      return state;
    };

    const run1 = run();
    const run2 = run();
    expect(run1).toEqual(run2);
    expect(run1.phase).toBe('auctionBidding');
    // 실제 후보/이슈 ID가 공개되었는지 확인 (placeholder가 아니라 진짜 카드)
    expect(run1.round.issueId).toMatch(/^issue-/);
    run1.round.candidatesRevealed.forEach((id) => expect(id).toMatch(/^candidate-/));
  });
});
