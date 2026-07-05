// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// 4인 5라운드 게임 1판을 봇으로 끝까지 자동 진행한다. packages/engine은 외부 의존성 0 원칙(CLAUDE.md)이라
// 실카드 데이터가 필요한 시뮬레이션은 engine이 아니라 여기(packages/data)에 둔다 — engineIntegration.test.ts와 같은 이유.
import { reduce, setupGame } from '@kingmakers/engine';
import type { CardCatalog, DrawPiles, GameAction, GameState, PlayerId } from '@kingmakers/engine';
import { AGENDAS } from '../src/agendas';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { ISSUES } from '../src/issues';
import { PROMISES } from '../src/promises';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';
import { BotRng } from './bot';

const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];
/** 라운드당 입찰 상한 — 자금을 전부 태우지 않고 캠페인 액션에도 남기도록 결정적으로 제한한다 */
const MAX_BID = 6;

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

function step(state: GameState, action: GameAction, catalog: CardCatalog): GameState {
  const result = reduce(state, action, catalog);
  if (!result.ok) throw new Error(`시뮬레이션 실패(${action.type}): ${result.reason}`);
  return result.state;
}

export interface SimulationResult {
  seed: number;
  finalResult: NonNullable<GameState['finalResult']>;
  roundHistory: GameState['roundHistory'];
}

/**
 * 봇 정책(단순 휴리스틱): 입찰은 공개 후보 중 무작위 1명에게 자금 일부를 건다.
 * 공약은 제시된 3장 중 무작위 선택. 캠페인 차례에는 내가 미는 후보가 있으면 조건부 지지, 없으면 모금.
 * 단일화는 항상 넘긴다(협상 로직은 시뮬레이션 범위 밖). 선택형 당선 효과는 첫 옵션/경제 트랙 고정 선택.
 */
export function simulateGame(seed: number, catalog: CardCatalog): SimulationResult {
  const bot = new BotRng(seed);
  let state = setupGame({ seed, players: PLAYER_NAMES.map((name) => ({ name })), decks: realDecks() });
  state = step(state, { type: 'startGame' }, catalog);
  state = step(state, { type: 'runUntilPlayerAction' }, catalog);

  // 무한 루프 방지 안전장치 — 5라운드 기준으로도 넉넉한 상한
  for (let guard = 0; guard < 2000 && state.phase !== 'gameEnd'; guard += 1) {
    if (state.phase === 'auctionBidding') {
      for (const player of state.players) {
        if (state.round.bids[player.id]?.confirmed) continue;
        const target = bot.pick(state.round.candidatesRevealed);
        const amount = bot.int(Math.min(player.money, MAX_BID) + 1);
        state = step(state, { type: 'placeBid', actor: player.id, allocations: amount > 0 ? { [target]: amount } : {} }, catalog);
        state = step(state, { type: 'confirmAuctionBids', actor: player.id }, catalog);
      }
    } else if (state.phase === 'promiseSelection') {
      for (const candidateId of [...state.round.candidatesRunning]) {
        if (state.phase !== 'promiseSelection') break;
        const camp = state.round.camps[candidateId];
        if (!camp?.majorBacker || camp.promiseId) continue;
        const promiseId = bot.pick(camp.promiseOptions);
        state = step(state, { type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId }, catalog);
      }
      if (state.phase === 'promiseSelection') state = step(state, { type: 'autoSelectPromises' }, catalog);
    } else if (state.phase === 'campaignActions') {
      const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
      const actorState = state.players.find((p) => p.id === actor)!;
      const myBackedCandidate = state.round.candidatesRunning.find((id) => state.round.camps[id]?.majorBacker === actor);
      if (myBackedCandidate) {
        // 내가 미는 후보가 있으면 조건부 지지(무료) — 자원 걱정 없이 항상 가능하다
        state = step(state, { type: 'conditionalSupport', actor, candidateId: myBackedCandidate }, catalog);
      } else if (actorState.reputation > 0) {
        // 모금은 reputation 1을 쓴다 — 바닥나면 더 이상 시도하지 않는다(그 아래 분기로)
        state = step(state, { type: 'fundraise', actor }, catalog);
      } else {
        // 미는 후보도 없고 평판도 바닥났으면 무작위 출마 후보를 조건부 지지한다(무료, 언제나 가능)
        const target = bot.pick(state.round.candidatesRunning);
        state = step(state, { type: 'conditionalSupport', actor, candidateId: target }, catalog);
      }
    } else if (state.phase === 'unification') {
      const remaining = state.round.candidatesRunning
        .map((id) => state.round.camps[id]?.majorBacker)
        .find((id): id is PlayerId => id != null && !state.round.unificationDone[id]);
      if (!remaining) break; // 이론상 도달하지 않음(전원 완료 시 자동으로 voting 진입)
      state = step(state, { type: 'skipUnification', actor: remaining }, catalog);
    } else if (state.phase === 'electionEffectSelection') {
      const winner = state.round.winnerCandidateId!;
      const backer = state.round.camps[winner]!.majorBacker!;
      const card = catalog.candidates[winner]!;
      const choice =
        card.electionEffect.kind === 'choosePolicyMove'
          ? { track: card.electionEffect.options[0]!.track, direction: card.electionEffect.options[0]!.direction }
          : { track: 'economy' as const, direction: 1 as const };
      state = step(state, { type: 'selectElectionPolicyMove', actor: backer, ...choice }, catalog);
    } else {
      // 자동 진행 phase(income/issueReveal/voterReveal/voting/policyResolution/roundScoring/cleanup)는 한 번에 넘긴다
      state = step(state, { type: 'runUntilPlayerAction' }, catalog);
    }
  }

  if (state.phase !== 'gameEnd' || !state.finalResult) {
    throw new Error(`시뮬레이션이 gameEnd에 도달하지 못했습니다 (seed=${seed}, phase=${state.phase})`);
  }

  return { seed, finalResult: state.finalResult, roundHistory: state.roundHistory };
}
