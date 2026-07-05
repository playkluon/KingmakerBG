// 기반 스킬: skills/voters-campaign/SKILL.md
// §10 유권자와 영향력 — 공개, 통제 판정, 배치, 자동 투표 집계
import { getPlayerCountConfig } from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { CardCatalog, VoterCard } from '../types/cards';
import type { PlayerAction } from '../types/actions';
import type { CandidateId, PlayerId, VoterId } from '../types/ids';
import type { GameState } from '../types/state';

const ok = (state: GameState, log: ReturnType<typeof createLogEntry>[]): ReduceResult => ({ ok: true, state, log });
const fail = (reason: string): ReduceResult => ({ ok: false, reason });

/** §10: 영향력이 단독 최고인 플레이어만 controller. 공동 1위·전원 0이면 없음 */
export function getVoterController(
  voterInfluence: GameState['round']['voterInfluence'],
  voterId: VoterId,
): PlayerId | null {
  const influence = voterInfluence[voterId];
  if (!influence) return null;
  let bestPlayer: PlayerId | null = null;
  let bestAmount = 0;
  let tied = false;
  for (const [playerId, amount] of Object.entries(influence) as Array<[PlayerId, number]>) {
    if (amount <= 0) continue;
    if (amount > bestAmount) {
      bestAmount = amount;
      bestPlayer = playerId;
      tied = false;
    } else if (amount === bestAmount) {
      tied = true;
    }
  }
  return tied ? null : bestPlayer;
}

/** §7: 인원별 공개 수(§3)만큼 유권자를 공개하고, 캠페인 액션 라운드로빈을 초기화한다 */
export function applyRevealVotersAction(state: GameState): ReduceResult {
  if (state.phase !== 'voterReveal') {
    return fail(`지금(${state.phase})은 'revealVoters'를 할 수 없습니다`);
  }
  const config = getPlayerCountConfig(state.players.length);
  const deck = [...state.drawPiles.voterDeck];
  const revealed = deck.splice(0, config.revealedVoters);
  const nextPhase = getNextPhase('voterReveal', state.round.round, state.maxRounds);
  const turnOrder = [...state.players].sort((a, b) => a.seat - b.seat).map((p) => p.id);

  const entry = createLogEntry(
    state,
    'voterReveal',
    null,
    'revealVoters',
    `유권자 ${revealed.length}명이 공개되었습니다`,
    [{ target: 'game', field: 'votersRevealed', after: revealed.length }],
  );
  const next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      votersRevealed: revealed,
      campaignTurnOrder: turnOrder,
      campaignActiveIndex: 0,
      campaignActionsUsed: {},
    },
    drawPiles: { ...state.drawPiles, voterDeck: deck },
    phase: nextPhase,
  };
  return ok(next, [entry]);
}

/**
 * §10 배치: 단독 controller만, 캠페인 액션을 소모하지 않는 무료 보조 권한.
 * 투표 전까지 재배치 가능하며 마지막 배치가 적용된다(그냥 덮어쓰면 된다).
 */
export function applyAssignVoterChoice(
  state: GameState,
  action: Extract<PlayerAction, { type: 'assignVoterChoice' }>,
): ReduceResult {
  if (!state.round.votersRevealed.includes(action.voterId)) {
    return fail('공개되지 않은 유권자입니다');
  }
  if (!state.round.candidatesRunning.includes(action.candidateId)) {
    return fail('출마하지 않은 후보입니다');
  }
  const controller = getVoterController(state.round.voterInfluence, action.voterId);
  if (controller !== action.actor) {
    return fail('이 유권자를 단독으로 통제하고 있지 않습니다');
  }

  const player = state.players.find((p) => p.id === action.actor)!;
  const entry = createLogEntry(
    state,
    'campaignActions',
    action.actor,
    'assignVoterChoice',
    `${player.name}이(가) 유권자를 후보에게 배정했습니다`,
    [{ target: action.voterId, field: 'assignedTo', after: action.candidateId }],
  );
  const next: GameState = {
    ...appendLog(state, entry),
    round: {
      ...state.round,
      voterAssignments: { ...state.round.voterAssignments, [action.voterId]: action.candidateId },
    },
  };
  return ok(next, [entry]);
}

/** 유권자의 선호/비선호/충돌 태그와 후보 공약 태그 사이의 관계 (§10 표 변화 기준) */
function relationOf(voterCard: VoterCard, candidateTag: string | undefined): 1 | 0 | -1 | -2 {
  if (candidateTag == null) return 0;
  if (candidateTag === voterCard.conflictTag) return -2;
  if (candidateTag === voterCard.dislikedTag) return -1;
  if (candidateTag === voterCard.preferredTag) return 1;
  return 0;
}

/** 유권자 카드 1장이 이번 라운드 실제로 행사한 표 (§10, §13, §15가 공유하는 기본 단위) */
export interface VoterSupport {
  candidateId: CandidateId;
  /** 최종 기여 표 수 (0이면 사실상 기권과 동일하게 취급한다) */
  amount: number;
  /** 이 유권자를 단독으로 통제하는 플레이어 (§10, §15 채점 대상) */
  controller: PlayerId | null;
  group: string;
}

/**
 * §10 자동 투표 집계 — 유권자 카드별 결과.
 * 배치된 유권자: 배치된 후보의 공약 태그와 내 선호/비선호/충돌 태그 관계에 따라 표가 갈린다
 * (선호 +1 / 중립 0 / 싫어함 -1 / 직접 충돌 -2를 voteWeight에 곱한 값, 0 미만 불가).
 * 미배치 유권자: 선호 태그가 일치하는 출마 후보를 찾아 전액 지지한다. 없으면 기권(결과에서 제외).
 * 순수 함수 — voting.ts(§13 집계)와 roundScoring.ts(§10 마커, §15 지지 VP)가 공유한다.
 */
export function computeVoterSupport(state: GameState, catalog: CardCatalog): Partial<Record<VoterId, VoterSupport>> {
  const support: Partial<Record<VoterId, VoterSupport>> = {};

  const promiseTagByCandidate = new Map<CandidateId, string | undefined>();
  for (const candidateId of state.round.candidatesRunning) {
    const promiseId = state.round.camps[candidateId]?.promiseId;
    promiseTagByCandidate.set(candidateId, promiseId ? catalog.promises[promiseId]?.reactionTag : undefined);
  }

  for (const voterId of state.round.votersRevealed) {
    const voterCard = catalog.voters[voterId];
    if (!voterCard) continue;
    const controller = getVoterController(state.round.voterInfluence, voterId);

    const assigned = state.round.voterAssignments[voterId];
    if (assigned) {
      const relation = relationOf(voterCard, promiseTagByCandidate.get(assigned));
      const amount = Math.max(0, voterCard.voteWeight * relation);
      if (amount > 0) support[voterId] = { candidateId: assigned, amount, controller, group: voterCard.group };
      continue;
    }

    // 미배치: 선호 태그와 맞는 공약을 가진 출마 후보를 찾는다 (없으면 기권 — 관계는 항상 "선호"이므로 전액 지지)
    const matched = state.round.candidatesRunning.find(
      (candidateId) => promiseTagByCandidate.get(candidateId) === voterCard.preferredTag,
    );
    if (matched) support[voterId] = { candidateId: matched, amount: voterCard.voteWeight, controller, group: voterCard.group };
  }

  return support;
}

/** computeVoterSupport를 후보별로 합산한 값 — voting.ts의 §13 표 집계가 사용한다 */
export function computeVoterVotes(state: GameState, catalog: CardCatalog): Partial<Record<CandidateId, number>> {
  const votes: Partial<Record<CandidateId, number>> = {};
  for (const entry of Object.values(computeVoterSupport(state, catalog))) {
    if (!entry) continue;
    votes[entry.candidateId] = (votes[entry.candidateId] ?? 0) + entry.amount;
  }
  return votes;
}
