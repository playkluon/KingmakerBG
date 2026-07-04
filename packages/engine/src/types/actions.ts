// 기반 스킬: skills/engine-core/SKILL.md
// §19 시스템 액션(16종) + §20 플레이어 액션(17종)
import type { CandidateId, EventId, PlayerId, PolicyDirection, PolicyTrackId, PromiseId, VoterId } from './ids';

/** §8: 기본은 동시 비공개 입찰, 공개 순차는 튜토리얼/디버그 전용 */
export type AuctionMode = 'simultaneousBlind' | 'sequentialOpen';

// ── 시스템 액션 (§19) — actor 없음, 호스트/서버/엔진이 트리거 ──
export type SystemAction =
  | { type: 'startGame' }
  | { type: 'setAuctionMode'; mode: AuctionMode }
  | { type: 'runSystemStep' }
  | { type: 'runUntilPlayerAction' }
  | { type: 'advancePhase' }
  | { type: 'revealIssue' }
  | { type: 'revealCandidates' }
  | { type: 'generateRandomBids' } // 디버그 전용 (부록 A-4)
  | { type: 'resolveAuction' }
  | { type: 'autoSelectPromises' }
  | { type: 'revealVoters' }
  | { type: 'runUnificationTest' }
  | { type: 'resolveVoting' }
  | { type: 'resolvePolicy' }
  | { type: 'scoreRound' }
  | { type: 'nextRound' };

// ── 플레이어 액션 (§20) — 전부 actor: PlayerId를 가진다 ─────────
export type PlayerAction =
  | { type: 'placeBid'; actor: PlayerId; allocations: Partial<Record<CandidateId, number>> }
  | { type: 'confirmAuctionBids'; actor: PlayerId }
  | { type: 'selectPromise'; actor: PlayerId; candidateId: CandidateId; promiseId: PromiseId }
  | { type: 'contactVoter'; actor: PlayerId; voterId: VoterId }
  | { type: 'runAd'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'pressurePolicy'; actor: PlayerId; track: PolicyTrackId; direction: PolicyDirection }
  | { type: 'fundraise'; actor: PlayerId }
  | { type: 'reportScandal'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'conditionalSupport'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'proposeUnification'; actor: PlayerId; leadCandidateId: CandidateId; withdrawCandidateId: CandidateId }
  | { type: 'acceptUnification'; actor: PlayerId }
  | { type: 'declineUnification'; actor: PlayerId }
  | { type: 'skipUnification'; actor: PlayerId }
  | { type: 'selectElectionPolicyMove'; actor: PlayerId; track: PolicyTrackId; direction: PolicyDirection }
  | { type: 'useEvent'; actor: PlayerId; eventId: EventId } // 효과는 7단계 활성화 전까지 거부 (부록 A-4)
  | { type: 'poll'; actor: PlayerId } // 비활성 플래그 (부록 A-4)
  | { type: 'assignVoterChoice'; actor: PlayerId; voterId: VoterId; candidateId: CandidateId };

export type GameAction = SystemAction | PlayerAction;

/** PlayerAction은 전부 actor 필드를 갖는다는 사실을 이용한 판별 함수 */
export function isPlayerAction(action: GameAction): action is PlayerAction {
  return 'actor' in action;
}
