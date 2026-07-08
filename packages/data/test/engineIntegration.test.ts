// 기반 스킬: skills/card-data/SKILL.md
// DEV_PLAN.md M2 완료 조건: "Phase 1의 setup.ts가 실데이터로 교체되어도 결정성 테스트 유지"
import { reduce, setupGame } from '@kingmakers/engine';
import type { CardCatalog, DrawPiles, GameAction, GameState, PartyId, PlayerId } from '@kingmakers/engine';
import { describe, expect, it } from 'vitest';
import { AGENDAS } from '../src/agendas';
import { buildCardCatalog } from '../src/catalog';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { ISSUES } from '../src/issues';
import { PROMISES } from '../src/promises';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';

// packages/data는 engine에 의존하지 않지만, buildCardCatalog()의 결과가 engine의 CardCatalog와
// 구조적으로 호환되는지는 여기서 명시적으로 타입 검증한다 (대입 자체가 컴파일 타임 증거가 된다).
const typedCatalog: CardCatalog = buildCardCatalog();

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

/**
 * 개편안 A·B 결정 지점 통과 헬퍼: 좌석 순서대로 party-01..party-04에 가입하고,
 * 각자 손패 첫 장을 제안한 뒤 auctionBidding까지 자동 진행한다 (전부 결정적).
 */
function walkPartyAndProposal(input: GameState, catalog: CardCatalog): GameState {
  let state = input;
  const step = (action: GameAction) => {
    const result = reduce(state, action, catalog);
    if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
    state = result.state;
  };
  if (state.phase === 'partySelection') {
    state.players.forEach((p, i) => step({ type: 'selectParty', actor: p.id, partyId: `party-0${i + 1}` as PartyId }));
    step({ type: 'runUntilPlayerAction' });
  }
  if (state.phase === 'candidateProposal') {
    for (const p of [...state.players]) {
      const current = state.players.find((x) => x.id === p.id)!;
      if (state.round.proposals[p.id] || current.hand.length === 0) continue;
      step({ type: 'proposeCandidate', actor: p.id, candidateId: current.hand[0]! });
    }
    step({ type: 'runUntilPlayerAction' });
  }
  return state;
}

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
    expect(state.drawPiles.issueDeck).toHaveLength(ISSUES.length);
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

  it('실카드 데이터로도 시작 시퀀스(정당 선택→후보 제안 포함)가 결정적으로 재생된다', () => {
    const run = () => {
      let state = setupGame({ seed: 2026, players, decks: realDecks() });
      for (const action of [{ type: 'startGame' } as GameAction, { type: 'runUntilPlayerAction' } as GameAction]) {
        const result = reduce(state, action, typedCatalog);
        if (!result.ok) throw new Error(`재생 실패: ${result.reason}`);
        state = result.state;
      }
      return walkPartyAndProposal(state, typedCatalog);
    };

    const run1 = run();
    const run2 = run();
    expect(run1).toEqual(run2);
    expect(run1.phase).toBe('auctionBidding');
    // 실제 이슈/후보 ID가 공개되었는지 확인 (placeholder가 아니라 진짜 카드)
    expect(run1.round.firstIssues).toHaveLength(2);
    expect(run1.round.secondIssues).toHaveLength(2);
    [...run1.round.firstIssues, ...run1.round.secondIssues].forEach((id) => expect(id).toMatch(/^issue-/));
    run1.round.candidatesRevealed.forEach((id) => expect(id).toMatch(/^candidate-/));
  });

  it('실카드 경매·공약 선택이 실제 카탈로그로 끝까지 동작한다 (Skill 4 + 실데이터)', () => {
    let state = setupGame({ seed: 77, players, decks: realDecks() });
    const start = reduce(state, { type: 'startGame' }, typedCatalog);
    if (!start.ok) throw new Error(start.reason);
    const toParty = reduce(start.state, { type: 'runUntilPlayerAction' }, typedCatalog);
    if (!toParty.ok) throw new Error('runUntilPlayerAction 실패');
    state = walkPartyAndProposal(toParty.state, typedCatalog);

    // 4명이 서로 다른 공개 후보에 명확한 순위로 입찰해 3명 출마를 확정한다
    const [c0, c1, c2, c3] = state.round.candidatesRevealed;
    const amounts: [string, string, number][] = [
      ['player-0', c0!, 6],
      ['player-1', c1!, 4],
      ['player-2', c2!, 3],
      ['player-3', c3!, 2],
    ];
    for (const [actor, candidateId, amount] of amounts) {
      const r = reduce(state, { type: 'placeBid', actor: actor as never, allocations: { [candidateId]: amount } as never }, typedCatalog);
      if (!r.ok) throw new Error(`입찰 실패: ${r.reason}`);
      state = r.state;
    }
    for (const [actor] of amounts) {
      const r = reduce(state, { type: 'confirmAuctionBids', actor: actor as never }, typedCatalog);
      if (!r.ok) throw new Error(`확정 실패: ${r.reason}`);
      state = r.state;
    }

    expect(state.phase).toBe('auctionResolved');
    expect(state.round.candidatesRunning).toHaveLength(3);

    const advanced = reduce(state, { type: 'runUntilPlayerAction' }, typedCatalog);
    if (!advanced.ok) throw new Error('promiseSelection 진입 실패');
    state = advanced.state;
    expect(state.phase).toBe('promiseSelection');

    // 실제 공약 카드 콘텐츠(이름·효과)가 캠프에 제시되어 있는지 확인 — placeholder ID가 아니라 진짜 카드
    for (const candidateId of state.round.candidatesRunning) {
      const camp = state.round.camps[candidateId]!;
      expect(camp.promiseOptions).toHaveLength(3);
      camp.promiseOptions.forEach((id) => expect(id).toMatch(/^promise-/));

      const majorBacker = state.players.find((p) => p.id === camp.majorBacker)!;
      const beforeMoney = majorBacker.money;
      const chosen = camp.promiseOptions[0]!;
      const chosenCard = PROMISES.find((p) => p.id === chosen)!;

      const picked = reduce(state, { type: 'selectPromise', actor: camp.majorBacker!, candidateId, promiseId: chosen }, typedCatalog);
      if (!picked.ok) throw new Error(`공약 선택 실패: ${picked.reason}`);
      state = picked.state;

      if (chosenCard.effect.kind === 'backerReward' && chosenCard.effect.resource === 'money') {
        const afterMoney = state.players.find((p) => p.id === camp.majorBacker)!.money;
        expect(afterMoney).toBe(beforeMoney + chosenCard.effect.amount);
      }
    }

    expect(state.phase).toBe('voterReveal');
  });

  it('실카드 데이터로 4인 5라운드 풀게임이 끝까지 완주된다 (M5 관문, 부록 A-14 실카드 검증)', () => {
    // 실카드 후보 21장/공약 30장은 5라운드 기준 딱 맞게 부족하도록 설계된 수량이라(§4),
    // 부록 A-14 카드 반환이 실카드로도 정확히 동작해야만 이 테스트가 끝까지 통과한다.
    let state = setupGame({ seed: 2026, players, decks: realDecks() });
    const step = (action: GameAction) => {
      const result = reduce(state, action, typedCatalog);
      if (!result.ok) throw new Error(`R${state.round.round} ${action.type} 실패: ${result.reason}`);
      state = result.state;
    };

    step({ type: 'startGame' });
    step({ type: 'runUntilPlayerAction' });

    while (state.phase !== 'gameEnd') {
      // 라운드 1은 정당 선택부터, 라운드 2+는 후보 제안부터 (개편안 A·B)
      state = walkPartyAndProposal(state, typedCatalog);
      expect(state.phase).toBe('auctionBidding');
      // 공개 후보 = 제안한 플레이어 수(최대 4) — 정당 후보가 모두 당선되면 줄어들 수 있다
      expect(state.round.candidatesRevealed.length).toBeGreaterThanOrEqual(1);

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

      step({ type: 'runUntilPlayerAction' });
      // 선택형 당선 효과(choose/flex)는 실카드에 실제로 존재하므로 여기서만 멈출 수 있다
      if (state.phase === 'electionEffectSelection') {
        const winner = state.round.winnerCandidateId!;
        const card = CANDIDATES.find((c) => c.id === winner)!;
        const backer = state.round.camps[winner]!.majorBacker!;
        const choice =
          card.electionEffect.kind === 'choosePolicyMove'
            ? { track: card.electionEffect.options[0]!.track, direction: card.electionEffect.options[0]!.direction }
            : { track: 'economy' as const, direction: 1 as const };
        step({ type: 'selectElectionPolicyMove', actor: backer, ...choice });
        step({ type: 'runUntilPlayerAction' }); // 정책 반영→정산→다음 라운드(또는 gameEnd)까지 자동 진행
      }
    }

    expect(state.round.round).toBe(5);
    expect(state.roundHistory).toHaveLength(5);
    expect(state.finalResult).not.toBeNull();
    expect(state.finalResult!.entries).toHaveLength(4);
  });
});
