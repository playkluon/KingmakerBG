// 기반 스킬: skills/engine-core/SKILL.md
// seed 기반 초기화 — §26 1단계.
// 엔진은 외부 의존성 0 원칙(CLAUDE.md)에 따라 packages/data를 import할 수 없으므로,
// 카드 ID 목록은 호출자가 주입한다 — 실카드는 packages/data가, 엔진 자체 테스트는 buildPlaceholderIds가 공급한다.
import { getPlayerCountConfig, STARTING_MONEY, STARTING_ORGANIZATION, STARTING_REPUTATION, STARTING_VICTORY_POINTS } from './constants';
import { createRng, shuffle, type RngState } from './rng';
import type { PlayerId } from './types/ids';
import type { DrawPiles, GameState, PlayerState } from './types/state';

export interface SetupPlayerInput {
  name: string;
}

export interface SetupOptions {
  /** 결정적 셔플/배분에 쓰이는 시드 (부록 A-5) */
  seed: number;
  /** 4~7명, 좌석 순서는 입력 순서를 그대로 따른다 (무작위 좌석 배정은 Skill 8/서버 담당 — §21) */
  players: SetupPlayerInput[];
  /** 풀게임 5(기본), 튜토리얼/디버그는 1 (§3) */
  maxRounds?: number;
  /** 각 덱을 채울 카드 ID 전체 목록 (셔플 전 순서 무관). §4 수량은 packages/data가 보장한다 */
  decks: DrawPiles;
}

/** 엔진 자체 테스트·데모용 placeholder ID 생성기. 실제 카드 데이터는 packages/data가 공급한다 */
export function buildPlaceholderIds<T extends string>(prefix: string, count: number): T[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}` as T);
}

/** seed로부터 결정적으로 GameState를 만든다 (부록 A-5: 같은 seed → 같은 결과) */
export function setupGame(options: SetupOptions): GameState {
  const { seed, players: playerInputs, maxRounds = 5, decks } = options;

  // 4~7인 검증 — 범위 밖은 방 생성 단계의 프로그래머/입력 오류로 보고 throw (constants.ts 주석 참고)
  getPlayerCountConfig(playerInputs.length);

  let rngState: RngState = createRng(seed);

  const shuffleDeck = <T>(ids: readonly T[]): T[] => {
    const drawn = shuffle(rngState, ids);
    rngState = drawn.nextState;
    return drawn.items;
  };

  const drawPiles: DrawPiles = {
    candidateDeck: shuffleDeck(decks.candidateDeck),
    promiseDeck: shuffleDeck(decks.promiseDeck),
    voterDeck: shuffleDeck(decks.voterDeck),
    issueDeck: shuffleDeck(decks.issueDeck),
    candidateEventDeck: shuffleDeck(decks.candidateEventDeck),
    voterEventDeck: shuffleDeck(decks.voterEventDeck),
    agendaDeck: shuffleDeck(decks.agendaDeck),
  };

  // 부록 A-7: 비밀 의제는 플레이어당 1장을 무작위로 배분한다 (선택권 없음 — 브리프 §17 미명시 사항의 보완 결정)
  const assignedAgendas = drawPiles.agendaDeck.splice(0, playerInputs.length);

  const players: PlayerState[] = playerInputs.map((input, seat) => ({
    id: `player-${seat}` as PlayerId,
    seat,
    name: input.name,
    money: STARTING_MONEY,
    organization: STARTING_ORGANIZATION,
    reputation: STARTING_REPUTATION,
    victoryPoints: STARTING_VICTORY_POINTS,
    secretAgendaId: assignedAgendas[seat] ?? null,
    influenceMarkers: {},
    candidateEventHand: [],
  }));

  return {
    schemaVersion: '0.2',
    seed,
    rngState,
    phase: 'setup',
    maxRounds,
    round: {
      round: 1,
      issueId: null,
      candidatesRevealed: [],
      candidatesRunning: [],
      votersRevealed: [],
      bids: {},
      camps: {},
    },
    players,
    drawPiles,
    auctionMode: 'simultaneousBlind',
    policyTracks: { economy: 0, labor: 0, society: 0, industry: 0, foreign: 0 },
    actionLog: [],
    roundHistory: [],
    lastRoundResult: null,
    nextLogSeq: 1,
  };
}
