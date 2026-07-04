// 기반 스킬: skills/engine-core/SKILL.md
// seed 기반 초기화 — §26 1단계. 실제 카드 데이터(Phase 2)가 없는 동안은 placeholder ID로 덱을 채운다.
import { getPlayerCountConfig, STARTING_MONEY, STARTING_ORGANIZATION, STARTING_REPUTATION, STARTING_VICTORY_POINTS } from './constants';
import { createRng, shuffle, type RngState } from './rng';
import type { AgendaId, CandidateId, EventId, IssueId, PlayerId, PromiseId, VoterId } from './types/ids';
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
  /** Phase 2 실카드 데이터 도입 전까지 사용할 placeholder 덱 크기 (§4 수량이 기본값) */
  deckSizes?: Partial<Record<keyof DrawPiles, number>>;
}

const DEFAULT_DECK_SIZES: Readonly<Record<keyof DrawPiles, number>> = {
  candidateDeck: 21,
  promiseDeck: 30,
  voterDeck: 48,
  issueDeck: 15,
  candidateEventDeck: 30,
  voterEventDeck: 30,
  agendaDeck: 16,
};

function buildPlaceholderIds<T extends string>(prefix: string, count: number): T[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}` as T);
}

/** seed로부터 결정적으로 GameState를 만든다 (부록 A-5: 같은 seed → 같은 결과) */
export function setupGame(options: SetupOptions): GameState {
  const { seed, players: playerInputs, maxRounds = 5 } = options;

  // 4~7인 검증 — 범위 밖은 방 생성 단계의 프로그래머/입력 오류로 보고 throw (constants.ts 주석 참고)
  getPlayerCountConfig(playerInputs.length);

  const deckSizes = { ...DEFAULT_DECK_SIZES, ...options.deckSizes };
  let rngState: RngState = createRng(seed);

  const shuffleDeck = <T>(ids: readonly T[]): T[] => {
    const drawn = shuffle(rngState, ids);
    rngState = drawn.nextState;
    return drawn.items;
  };

  const drawPiles: DrawPiles = {
    candidateDeck: shuffleDeck(buildPlaceholderIds<CandidateId>('candidate', deckSizes.candidateDeck)),
    promiseDeck: shuffleDeck(buildPlaceholderIds<PromiseId>('promise', deckSizes.promiseDeck)),
    voterDeck: shuffleDeck(buildPlaceholderIds<VoterId>('voter', deckSizes.voterDeck)),
    issueDeck: shuffleDeck(buildPlaceholderIds<IssueId>('issue', deckSizes.issueDeck)),
    candidateEventDeck: shuffleDeck(buildPlaceholderIds<EventId>('event-c', deckSizes.candidateEventDeck)),
    voterEventDeck: shuffleDeck(buildPlaceholderIds<EventId>('event-v', deckSizes.voterEventDeck)),
    agendaDeck: shuffleDeck(buildPlaceholderIds<AgendaId>('agenda', deckSizes.agendaDeck)),
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
