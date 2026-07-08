// 기반 스킬: skills/engine-core/SKILL.md
// §19 시스템 액션(16종) + §20 플레이어 액션(17종)
import type { CandidateId, EventId, PlayerId, PolicyDirection, PolicyTrackId, PromiseId, VoterId, PartyId } from './ids';
import type { SecretPactPromise, UnificationTerm } from './state';

/** §8: 기본은 동시 비공개 입찰, 공개 순차는 튜토리얼/디버그 전용 */
export type AuctionMode = 'simultaneousBlind' | 'sequentialOpen';

// ── 시스템 액션 (§19) — actor 없음, 호스트/서버/엔진이 트리거 ──
export type SystemAction =
  | { type: 'startGame' }
  | { type: 'setAuctionMode'; mode: AuctionMode }
  | { type: 'runSystemStep' }
  | { type: 'runUntilPlayerAction' }
  | { type: 'advancePhase' }
  | { type: 'revealFirstIssues' }
  | { type: 'revealSecondIssues' }
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
  | { type: 'selectParty'; actor: PlayerId; partyId: PartyId }
  | { type: 'proposeCandidate'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'placeBid'; actor: PlayerId; allocations: Partial<Record<CandidateId, number>> }
  | { type: 'confirmAuctionBids'; actor: PlayerId }
  | { type: 'selectPromise'; actor: PlayerId; candidateId: CandidateId; promiseId: PromiseId }
  | { type: 'contactVoter'; actor: PlayerId; voterId: VoterId }
  | { type: 'runAd'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'pressurePolicy'; actor: PlayerId; track: PolicyTrackId; direction: PolicyDirection }
  | { type: 'fundraise'; actor: PlayerId }
  | { type: 'reportScandal'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'conditionalSupport'; actor: PlayerId; candidateId: CandidateId }
  | { type: 'changeParty'; actor: PlayerId; partyId: PartyId }
  | {
      type: 'proposeUnification';
      actor: PlayerId;
      leadCandidateId: CandidateId;
      withdrawCandidateId: CandidateId;
      /** 부록 A-15 공개 조건 계약 — 생략하면 조건 없는 순수 단일화(§12 기본 범위) */
      terms?: UnificationTerm[];
    }
  | { type: 'acceptUnification'; actor: PlayerId }
  | { type: 'declineUnification'; actor: PlayerId }
  | { type: 'skipUnification'; actor: PlayerId }
  | { type: 'selectElectionPolicyMove'; actor: PlayerId; track: PolicyTrackId; direction: PolicyDirection }
  // 부록 A-17: candidateVotesDelta 효과만 대상 후보 지정이 필요하다. campaignActions 중 무료·차례 무관.
  | { type: 'useEvent'; actor: PlayerId; eventId: EventId; targetCandidateId?: CandidateId }
  | { type: 'poll'; actor: PlayerId } // 비활성 플래그 (부록 A-4)
  | { type: 'assignVoterChoice'; actor: PlayerId; voterId: VoterId; candidateId: CandidateId }
  // §12 비밀 pact (부록 A-16) — campaignActions 중 무료·차례 무관, assignVoterChoice와 동일한 성격
  | { type: 'proposeSecretPact'; actor: PlayerId; counterparty: PlayerId; promise: SecretPactPromise }
  | { type: 'acceptSecretPact'; actor: PlayerId; proposer: PlayerId }
  | { type: 'declineSecretPact'; actor: PlayerId; proposer: PlayerId };

export type GameAction = SystemAction | PlayerAction;

/** PlayerAction은 전부 actor 필드를 갖는다는 사실을 이용한 판별 함수 */
export function isPlayerAction(action: GameAction): action is PlayerAction {
  return 'actor' in action;
}
