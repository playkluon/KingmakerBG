// 기반 스킬: skills/engine-core/SKILL.md
// UI용 파생값 계산 — 클라이언트가 import를 허용받는 유일한 로직 (CLAUDE.md 코딩 규칙: reducer 호출은 금지)
import { CAMPAIGN_ACTIONS_PER_PLAYER } from '../constants';
import { PHASES } from '../phases';
import type { PlayerId } from '../types/ids';
import type { GameState } from '../types/state';

/** 현재 phase가 플레이어 결정을 기다리는 중인지 (§19 runUntilPlayerAction 정지 기준) */
export function isWaitingForPlayerDecision(state: GameState): boolean {
  return PHASES[state.phase].requiresPlayerDecision;
}

/** 현재 phase의 한국어 설명 (§22 "현재 phase" UI에 사용) */
export function getPhaseDescription(state: GameState): string {
  return PHASES[state.phase].description;
}

/** 게임 종료 여부 */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'gameEnd';
}

/** "지금 해야 할 일" (skills/client-player TodoBanner의 근거 — §22, §30-1) */
export interface PendingDecision {
  /** 지금 행동해야 하는 플레이어들 */
  actors: PlayerId[];
  /** 해당 플레이어에게 보여줄 한국어 안내 */
  description: string;
}

/** 출마 후보들의 majorBacker 목록 (중복 제거, 좌석 순) */
function runningMajorBackers(state: GameState): PlayerId[] {
  const set = new Set<PlayerId>();
  for (const candidateId of state.round.candidatesRunning) {
    const majorBacker = state.round.camps[candidateId]?.majorBacker;
    if (majorBacker) set.add(majorBacker);
  }
  return state.players.map((p) => p.id).filter((id) => set.has(id));
}

/**
 * 현재 phase에서 결정을 기다리는 플레이어와 할 일을 계산한다.
 * 시스템 자동 진행 phase면 null — UI는 "자동 진행 중"으로 표시하면 된다 (§22).
 */
export function getPendingDecision(state: GameState): PendingDecision | null {
  switch (state.phase) {
    case 'partySelection': {
      // 개편안 A: 아직 정당을 고르지 않은 전원이 동시에 결정한다
      const actors = state.players.filter((p) => p.party === null).map((p) => p.id);
      return { actors, description: '가입할 정당을 선택하세요 (정당당 최대 2명)' };
    }
    case 'candidateProposal': {
      // 개편안 B: 손패가 있고 아직 제안하지 않은 전원 — 손패가 빈 플레이어는 자동 면제된다
      const actors = state.players
        .filter((p) => state.round.proposals[p.id] == null && p.hand.length > 0)
        .map((p) => p.id);
      return { actors, description: '공개된 이슈를 보고 손패에서 후보 1명을 골라 제안하세요' };
    }
    case 'auctionBidding': {
      const actors = state.players.filter((p) => !state.round.bids[p.id]?.confirmed).map((p) => p.id);
      return { actors, description: '후보에게 자금을 배분하고 입찰을 확정하세요' };
    }
    case 'promiseSelection': {
      const actors = state.round.candidatesRunning
        .filter((id) => state.round.camps[id]?.promiseId == null)
        .map((id) => state.round.camps[id]?.majorBacker)
        .filter((id): id is PlayerId => id != null);
      return { actors: [...new Set(actors)], description: '제시된 공약 3장 중 1장을 선택하세요' };
    }
    case 'campaignActions': {
      const current = state.round.campaignTurnOrder[state.round.campaignActiveIndex];
      if (!current) return { actors: [], description: '캠페인 진행 중' };
      const used = state.round.campaignActionsUsed[current] ?? 0;
      return {
        actors: [current],
        description: `캠페인 액션을 선택하세요 (${used + 1}/${CAMPAIGN_ACTIONS_PER_PLAYER}번째)`,
      };
    }
    case 'unification': {
      const proposal = state.round.pendingUnificationProposal;
      if (proposal) {
        const responder = state.round.camps[proposal.withdrawCandidateId]?.majorBacker;
        return {
          actors: responder ? [responder] : [],
          description: '단일화 제안에 응답하세요 (수락 또는 거절)',
        };
      }
      const actors = runningMajorBackers(state).filter((id) => !state.round.unificationDone[id]);
      return { actors, description: '단일화를 제안하거나 넘기세요' };
    }
    case 'electionEffectSelection': {
      const winner = state.round.winnerCandidateId;
      const majorBacker = winner ? state.round.camps[winner]?.majorBacker : null;
      return {
        actors: majorBacker ? [majorBacker] : [],
        description: '당선 효과를 선택하세요 (정책 트랙과 방향)',
      };
    }
    default:
      return null;
  }
}
