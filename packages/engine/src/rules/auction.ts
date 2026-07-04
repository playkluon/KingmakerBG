// 기반 스킬: skills/auction-promise/SKILL.md
// §8 후보 경매 — 동시 비공개 입찰, 출마 후보 확정, 캠프 슬롯 배정
import { getPlayerCountConfig } from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { PlayerAction } from '../types/actions';
import type { CandidateId, PlayerId } from '../types/ids';
import type { ActionLogEntry, CampState, EffectDescriptor, GameState } from '../types/state';

const ok = (state: GameState, log: ActionLogEntry[]): ReduceResult => ({ ok: true, state, log });
const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** §8: 여러 후보에 money를 나눠 비공개 입찰한다. 확정 전까지 재제출하면 이전 배분을 통째로 대체한다 */
export function applyPlaceBid(state: GameState, action: Extract<PlayerAction, { type: 'placeBid' }>): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor)!;
  if (state.round.bids[action.actor]?.confirmed) {
    return fail('이미 입찰을 확정했습니다');
  }

  const revealedSet = new Set(state.round.candidatesRevealed);
  let total = 0;
  for (const [candidateId, amount] of Object.entries(action.allocations) as Array<[CandidateId, number | undefined]>) {
    if (!revealedSet.has(candidateId)) {
      return fail(`공개되지 않은 후보에는 입찰할 수 없습니다: ${candidateId}`);
    }
    if (amount == null || amount < 0 || !Number.isInteger(amount)) {
      return fail('입찰액은 0 이상의 정수여야 합니다');
    }
    total += amount;
  }
  if (total > player.money) {
    return fail(`보유 자금(${player.money})보다 많이 입찰할 수 없습니다`);
  }

  const entry = createLogEntry(state, 'auctionBidding', action.actor, 'placeBid', `${player.name}이(가) 입찰을 제출했습니다`);
  const next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      bids: { ...state.round.bids, [action.actor]: { allocations: action.allocations, confirmed: false } },
    },
  };
  return ok(next, [entry]);
}

/** §7: 전원 확정 시 경매 정산이 시스템 자동으로 실행된다 */
export function applyConfirmAuctionBids(
  state: GameState,
  action: Extract<PlayerAction, { type: 'confirmAuctionBids' }>,
): ReduceResult {
  const player = state.players.find((p) => p.id === action.actor)!;
  if (state.round.bids[action.actor]?.confirmed) {
    return fail('이미 입찰을 확정했습니다');
  }

  const existing = state.round.bids[action.actor] ?? { allocations: {}, confirmed: false };
  const entry = createLogEntry(state, 'auctionBidding', action.actor, 'confirmAuctionBids', `${player.name}이(가) 입찰을 확정했습니다`);
  let next: GameState = {
    ...appendLog(state, entry),
    round: { ...state.round, bids: { ...state.round.bids, [action.actor]: { ...existing, confirmed: true } } },
  };
  let log = [entry];

  const allConfirmed = next.players.every((p) => next.round.bids[p.id]?.confirmed);
  if (allConfirmed) {
    const resolved = resolveAuction(next);
    next = resolved.state;
    log = [...log, ...resolved.log];
  }

  return ok(next, log);
}

/** §19 명시적 resolveAuction 시스템 액션 — 전원 확정 상태에서만 허용 (일반적으로는 confirmAuctionBids가 자동 실행) */
export function applyResolveAuctionAction(state: GameState): ReduceResult {
  if (state.phase !== 'auctionBidding') {
    return fail(`지금(${state.phase})은 'resolveAuction'을(를) 할 수 없습니다`);
  }
  const allConfirmed = state.players.every((p) => state.round.bids[p.id]?.confirmed);
  if (!allConfirmed) {
    return fail('아직 입찰을 확정하지 않은 플레이어가 있습니다');
  }
  const { state: next, log } = resolveAuction(state);
  return ok(next, log);
}

interface CandidateTotal {
  candidateId: CandidateId;
  total: number;
  /** 입찰액 내림차순 → reputation 내림차순 → seat 오름차순으로 정렬된 후원자 목록 */
  backers: Array<{ playerId: PlayerId; amount: number }>;
}

function compareBackers(state: GameState, a: PlayerId, b: PlayerId, amountA: number, amountB: number): number {
  if (amountB !== amountA) return amountB - amountA;
  const playerA = state.players.find((p) => p.id === a)!;
  const playerB = state.players.find((p) => p.id === b)!;
  if (playerB.reputation !== playerA.reputation) return playerB.reputation - playerA.reputation;
  return playerA.seat - playerB.seat;
}

function computeCandidateTotals(state: GameState): CandidateTotal[] {
  return state.round.candidatesRevealed.map((candidateId) => {
    const backers = state.players
      .map((p) => ({ playerId: p.id, amount: state.round.bids[p.id]?.allocations[candidateId] ?? 0 }))
      .filter((b) => b.amount > 0)
      .sort((a, b) => compareBackers(state, a.playerId, b.playerId, a.amount, b.amount));
    const total = backers.reduce((sum, b) => sum + b.amount, 0);
    return { candidateId, total, backers };
  });
}

/** §8 출마 후보 동점 처리: ①후원자 수 ②최고 입찰자 reputation ③후보 id 결정적 순서 */
function determineRunning(state: GameState, totals: CandidateTotal[]): CandidateId[] {
  const config = getPlayerCountConfig(state.players.length);
  const sorted = [...totals].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.backers.length !== a.backers.length) return b.backers.length - a.backers.length;
    const topReputation = (t: CandidateTotal) =>
      t.backers[0] ? state.players.find((p) => p.id === t.backers[0]!.playerId)!.reputation : -Infinity;
    const repDiff = topReputation(b) - topReputation(a);
    if (repDiff !== 0) return repDiff;
    return a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0;
  });
  return sorted.slice(0, config.runningCandidates).map((t) => t.candidateId);
}

/** 경매 정산 본체 — confirmAuctionBids(전원 확정)와 명시적 resolveAuction 액션이 공유한다 */
function resolveAuction(state: GameState): { state: GameState; log: ActionLogEntry[] } {
  const totals = computeCandidateTotals(state);
  const runningOrder = determineRunning(state, totals);
  const runningSet = new Set(runningOrder);
  const config = getPlayerCountConfig(state.players.length);

  const effects: EffectDescriptor[] = [];
  const moneyDelta = new Map<PlayerId, number>();
  const addDelta = (playerId: PlayerId, amount: number) => moneyDelta.set(playerId, (moneyDelta.get(playerId) ?? 0) + amount);

  const camps: Partial<Record<CandidateId, CampState>> = {};
  let promiseDeck = [...state.drawPiles.promiseDeck];

  for (const t of totals) {
    // §8: 출마 여부와 무관하게 입찰액은 일단 전액 차감한다. 낙선 후보는 아래에서 절반을 되돌려준다.
    for (const b of t.backers) addDelta(b.playerId, -b.amount);

    if (runningSet.has(t.candidateId)) {
      const majorBacker = t.backers[0]?.playerId ?? null;
      const qualifyingRest = t.backers.slice(1).filter((b) => b.amount >= 2);
      const coBacker = qualifyingRest[0]?.playerId ?? null;
      const organizer = config.campSlots.includes('organizer') ? (qualifyingRest[1]?.playerId ?? null) : null;

      const promiseOptions = promiseDeck.slice(0, 3);
      promiseDeck = promiseDeck.slice(promiseOptions.length);

      camps[t.candidateId] = { majorBacker, coBacker, organizer, promiseOptions, promiseId: null };
    } else {
      for (const b of t.backers) {
        const refund = Math.floor(b.amount / 2);
        addDelta(b.playerId, refund);
        effects.push({ target: b.playerId, field: 'money', delta: refund });
      }
    }
  }

  const players = state.players.map((p) => ({ ...p, money: p.money + (moneyDelta.get(p.id) ?? 0) }));
  runningOrder.forEach((id) => effects.push({ target: id, field: 'candidatesRunning', after: id }));

  const nextPhase = getNextPhase('auctionBidding', state.round.round, state.maxRounds);
  const entry = createLogEntry(
    state,
    'auctionBidding',
    null,
    'resolveAuction',
    `경매가 정산되었습니다 (출마 확정: ${runningOrder.length}명)`,
    effects,
  );

  const next: GameState = {
    ...appendLog(state, entry),
    players,
    phase: nextPhase,
    drawPiles: { ...state.drawPiles, promiseDeck },
    round: { ...state.round, candidatesRunning: runningOrder, camps },
  };
  return { state: next, log: [entry] };
}
