// 기반 스킬: skills/scoring/SKILL.md
// §17 비밀 의제 조건 11유형 평가기.
// 반드시 라운드 히스토리(당선 이력)와 누적 영향력 마커를 참조한다 — 현재 라운드 스냅샷만 보는 구현 금지(§17).
import { POLICY_TRACK_MAX } from '../constants';
import type { AgendaCondition } from '../types/cards';
import type { PlayerId, VoterGroupId } from '../types/ids';
import type { GameState, PlayerState, RoundHistoryEntry } from '../types/state';

/**
 * 순위형 조건의 동점 규칙 (skills/scoring/SKILL.md 잠정 결정 — 스펙 미정):
 * 공동 1위도 "1위"로 인정한다. 단 influenceLeader류는 마커 0개면 아예 1위 후보가 아니다.
 * notInfluenceLeader는 공동 1위여도 "1위"이므로 불충족 처리된다.
 */
function isInfluenceLeader(players: PlayerState[], playerId: PlayerId, group: VoterGroupId): boolean {
  const mine = players.find((p) => p.id === playerId)?.influenceMarkers[group] ?? 0;
  if (mine <= 0) return false;
  return players.every((p) => (p.influenceMarkers[group] ?? 0) <= mine);
}

/** reputation 내림차순 competition ranking — 공동 1위는 둘 다 rank 1 */
function reputationRank(players: PlayerState[], playerId: PlayerId): number {
  const mine = players.find((p) => p.id === playerId)?.reputation ?? 0;
  return 1 + players.filter((p) => p.reputation > mine).length;
}

function countCandidateWins(history: RoundHistoryEntry[], candidateId: string): number {
  return history.filter((h) => h.winnerCandidateId === candidateId).length;
}

/**
 * §17 비밀 의제 조건 1개를 게임 종료 시점 기준으로 평가한다.
 * @param condition 평가할 조건
 * @param playerId 의제 소유자
 * @param state 게임 종료 시점 상태 (정책 트랙·자원·누적 마커)
 * @param history 5라운드 전체 히스토리 (후보 당선 이력)
 */
export function evaluateAgendaCondition(
  condition: AgendaCondition,
  playerId: PlayerId,
  state: GameState,
  history: RoundHistoryEntry[],
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  switch (condition.kind) {
    case 'policyAtLeast':
      // direction 방향으로 minMagnitude칸 이상 이동해 있어야 한다 (예: direction -1, magnitude 2 -> 값 ≤ -2)
      return state.policyTracks[condition.track] * condition.direction >= condition.minMagnitude;
    case 'policyBetween':
      return state.policyTracks[condition.track] >= condition.min && state.policyTracks[condition.track] <= condition.max;
    case 'noExtremePolicies':
      // 극단 = 트랙이 클램프 경계(±2)에 도달한 상태
      return Object.values(state.policyTracks).every((v) => Math.abs(v) < POLICY_TRACK_MAX);
    case 'influenceLeader':
      return isInfluenceLeader(state.players, playerId, condition.group);
    case 'influenceLeaderAny':
      return condition.groups.some((group) => isInfluenceLeader(state.players, playerId, group));
    case 'notInfluenceLeader':
      return !isInfluenceLeader(state.players, playerId, condition.group);
    case 'candidateWon':
      return countCandidateWins(history, condition.candidateId) >= 1;
    case 'candidateWonAtMost':
      return countCandidateWins(history, condition.candidateId) <= condition.maxTimes;
    case 'reputationAtLeast':
      return player.reputation >= condition.minAmount;
    case 'reputationRankAtMost':
      return reputationRank(state.players, playerId) <= condition.maxRank;
    case 'remainingMoneyAtLeast':
      return player.money >= condition.minAmount;
    default: {
      const exhaustiveCheck: never = condition;
      throw new Error(`알 수 없는 의제 조건입니다: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
