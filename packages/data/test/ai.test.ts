// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// AI self-play 기반 테스트 — 합법 액션 생성, 휴리스틱 봇, 몬테카를로 봇의 결정성과 완주성을 검증한다.
import { reduce, setupGame, type DrawPiles } from '@kingmakers/engine';
import { describe, expect, it } from 'vitest';
import { AGENDAS } from '../src/agendas';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { buildCardCatalog } from '../src/catalog';
import { ISSUES } from '../src/issues';
import { PROMISES } from '../src/promises';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';
import { simulateGameWithPolicy, collectSelfPlayDataset } from '../sim/aiSimulation';
import { BotRng } from '../sim/bot';
import { chooseMonteCarloAction } from '../sim/monteCarlo';
import { getDecisionActors, legalActionsForActor } from '../sim/legalActions';

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

describe('AI self-play 기반', () => {
  it('현재 의사결정자의 합법 액션 후보는 모두 reducer가 받아들인다', () => {
    const catalog = buildCardCatalog();
    let state = setupGame({ seed: 7, players: ['P1', 'P2', 'P3', 'P4'].map((name) => ({ name })), decks: realDecks() });
    const started = reduce(state, { type: 'startGame' }, catalog);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const advanced = reduce(started.state, { type: 'runUntilPlayerAction' }, catalog);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    state = advanced.state;

    const [actor] = getDecisionActors(state);
    expect(actor).toBeDefined();
    const actions = legalActionsForActor(state, catalog, actor!);
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(reduce(state, action, catalog).ok).toBe(true);
    }
  });

  it('휴리스틱 self-play가 4인 5라운드를 끝까지 완주하고 decision trace를 남긴다', () => {
    const catalog = buildCardCatalog();
    const result = simulateGameWithPolicy(11, catalog);
    expect(result.finalResult.entries).toHaveLength(4);
    expect(result.roundHistory).toHaveLength(5);
    expect(result.decisions.length).toBeGreaterThan(20);
  });

  it('같은 seed의 휴리스틱 self-play는 완전히 재현된다', () => {
    const catalog = buildCardCatalog();
    expect(simulateGameWithPolicy(12, catalog)).toEqual(simulateGameWithPolicy(12, catalog));
  });

  it('몬테카를로 정책은 현재 합법 액션 중 하나를 고른다', () => {
    const catalog = buildCardCatalog();
    let state = setupGame({ seed: 13, players: ['P1', 'P2', 'P3', 'P4'].map((name) => ({ name })), decks: realDecks() });
    const started = reduce(state, { type: 'startGame' }, catalog);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const advanced = reduce(started.state, { type: 'runUntilPlayerAction' }, catalog);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    state = advanced.state;

    const actor = getDecisionActors(state)[0]!;
    const legalActions = legalActionsForActor(state, catalog, actor);
    const action = chooseMonteCarloAction(state, catalog, actor, new BotRng(13), { samplesPerAction: 1, rolloutDepth: 8 });
    expect(legalActions).toContainEqual(action);
  });

  it('self-play dataset은 seed별 최종 결과와 decision trace를 함께 모은다', () => {
    const catalog = buildCardCatalog();
    const dataset = collectSelfPlayDataset([21, 22], catalog);
    expect(dataset).toHaveLength(2);
    expect(dataset.every((entry) => entry.finalResult.entries.length === 4 && entry.decisions.length > 0)).toBe(true);
  });
});
