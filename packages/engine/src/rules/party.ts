// 기반 스킬: skills/advanced-rules/SKILL.md (코어 루프 개편안 A·D)
// 정당 가입(selectParty)·탈당(changeParty)과 정당 손패 계산.
// 손패는 "내 정당 후보 전체 - 이미 소모된 후보"로 항상 재계산한다 — 같은 정당 2인이 손패를 공유하므로
// 저장된 배열만 신뢰하면 중복 제안·유령 카드 문제가 생긴다.
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { PlayerAction } from '../types/actions';
import type { CardCatalog } from '../types/cards';
import type { CandidateId, PartyId } from '../types/ids';
import type { GameState } from '../types/state';
import { createLogEntry, appendLog } from '../log';
import { runTurnAction } from './campaign';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** 한 정당의 최대 가입 인원 (개편안 A) */
export const PARTY_MAX_MEMBERS = 2;

/**
 * 더 이상 손패로 들어올 수 없는 후보 집합.
 * ① 역대 당선자(영구 소모 — 부록 A-14의 "라운드당 실소모는 당선자뿐" 원칙과 동일)
 * ② 이번 라운드에 이미 제안(공개)된 후보 — 같은 정당 동료가 이미 냈으면 나는 못 낸다
 */
function consumedCandidateIds(state: GameState): Set<CandidateId> {
  const consumed = new Set<CandidateId>();
  for (const entry of state.roundHistory) {
    if (entry.winnerCandidateId) consumed.add(entry.winnerCandidateId);
  }
  if (state.round.winnerCandidateId) consumed.add(state.round.winnerCandidateId);
  for (const id of state.round.candidatesRevealed) consumed.add(id);
  return consumed;
}

/** partyId 소속 후보 중 아직 소모되지 않은 카드 목록 — catalog 정의 순서 그대로(결정적, 부록 A-5) */
export function computePartyHand(state: GameState, catalog: CardCatalog, partyId: PartyId): CandidateId[] {
  const consumed = consumedCandidateIds(state);
  return Object.values(catalog.candidates)
    .filter((c) => c.party === partyId && !consumed.has(c.id))
    .map((c) => c.id);
}

/** 현재 정당별 가입 인원 */
function partyMemberCount(state: GameState, partyId: PartyId): number {
  return state.players.filter((p) => p.party === partyId).length;
}

/** 개편안 A: 게임 시작 시 1회, 정당을 골라 그 당 후보들을 손패로 받는다 */
export function applySelectParty(
  state: GameState,
  action: Extract<PlayerAction, { type: 'selectParty' }>,
  catalog: CardCatalog,
): ReduceResult {
  const { actor, partyId } = action;

  const player = state.players.find((p) => p.id === actor)!;
  if (player.party) return fail('이미 정당을 선택했습니다');
  if (!catalog.parties?.[partyId]) return fail('존재하지 않는 정당입니다');
  if (partyMemberCount(state, partyId) >= PARTY_MAX_MEMBERS) {
    return fail(`해당 정당은 이미 가입 인원이 꽉 찼습니다 (최대 ${PARTY_MAX_MEMBERS}명)`);
  }

  const hand = computePartyHand(state, catalog, partyId);
  const players = state.players.map((p) => (p.id === actor ? { ...p, party: partyId, hand } : p));

  const entry = createLogEntry(
    state,
    state.phase,
    actor,
    'selectParty',
    `${player.name}이(가) ${catalog.parties[partyId]?.name ?? partyId}에 가입했습니다`,
    [{ target: actor, field: 'party', after: partyId }],
  );

  let next: GameState = { ...appendLog(state, entry), players };

  // 전원 선택 완료 시 다음 phase로 — partySelection은 라운드 1에만 존재한다
  if (next.players.every((p) => p.party !== null)) {
    next = { ...next, phase: getNextPhase(state.phase, state.round.round, state.maxRounds) };
  }

  return { ok: true, state: next, log: [entry] };
}

/**
 * 개편안 D: 탈당 — 캠페인 액션 1회를 소모해 다른 정당으로 옮긴다.
 * 평판 1은 clamp되는 페널티가 아니라 "비용"이다 — 평판 0이면 탈당할 수 없다
 * (clamp 방식은 평판 0 플레이어가 아무 대가 없이 갈아탈 수 있는 구멍이 된다).
 * 차례 검증·비용 차감·라운드로빈 전진은 campaign.ts의 runTurnAction 골격을 그대로 쓴다 —
 * 예전 구현은 이 골격을 우회해 액션 수만 올리고 차례를 넘기지 않아 진행이 꼬였다.
 */
export function applyChangeParty(
  state: GameState,
  action: Extract<PlayerAction, { type: 'changeParty' }>,
  catalog: CardCatalog,
): ReduceResult {
  const { actor, partyId } = action;
  const player = state.players.find((p) => p.id === actor)!;

  if (!catalog.parties?.[partyId]) return fail('존재하지 않는 정당입니다');
  if (player.party === partyId) return fail('이미 해당 정당에 소속되어 있습니다');
  if (partyMemberCount(state, partyId) >= PARTY_MAX_MEMBERS) {
    return fail(`해당 정당은 이미 가입 인원이 꽉 찼습니다 (최대 ${PARTY_MAX_MEMBERS}명)`);
  }

  const newHand = computePartyHand(state, catalog, partyId);
  const partyName = catalog.parties[partyId]?.name ?? partyId;

  return runTurnAction(
    state,
    actor,
    { reputation: 1 },
    'changeParty',
    `${player.name}이(가) ${partyName}(으)로 당적을 변경했습니다 (평판 -1, 기존 손패 폐기)`,
    [
      { target: actor, field: 'party', after: partyId },
      { target: actor, field: 'reputation', delta: -1 },
    ],
    (s) => ({
      ...s,
      players: s.players.map((p) => (p.id === actor ? { ...p, party: partyId, hand: newHand } : p)),
    }),
  );
}
