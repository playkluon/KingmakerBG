// 기반 스킬: skills/voters-campaign/SKILL.md
// 라운드 시작 시(setup, nextRound) 공유하는 빈 RoundState 생성기.
// 스킬이 늘어날 때마다 필드가 늘어나므로 이 팩토리 하나로 모아 setup.ts/system.ts의 중복을 없앤다.
import { POLICY_TRACKS } from './constants';
import type { PolicyTrackId } from './types/ids';
import type { PolicyPressure, RoundState } from './types/state';

function createEmptyPolicyPressure(): Record<PolicyTrackId, PolicyPressure> {
  return Object.fromEntries(POLICY_TRACKS.map((track) => [track, { plus: 0, minus: 0 }])) as Record<
    PolicyTrackId,
    PolicyPressure
  >;
}

export function createInitialRoundState(round: number): RoundState {
  return {
    round,
    issueId: null,
    candidatesRevealed: [],
    candidatesRunning: [],
    votersRevealed: [],
    bids: {},
    camps: {},
    voterInfluence: {},
    voterAssignments: {},
    campaignVotes: {},
    conditionalSupporters: {},
    policyPressure: createEmptyPolicyPressure(),
    campaignTurnOrder: [],
    campaignActiveIndex: 0,
    campaignActionsUsed: {},
  };
}
