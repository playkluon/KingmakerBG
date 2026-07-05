// 기반 스킬: skills/unification-voting/SKILL.md
// §14 정책 변화 4순서 + §6 정책 압박 비교
import { POLICY_TRACK_MAX, POLICY_TRACK_MIN, POLICY_TRACKS } from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { CandidateId, PolicyDirection, PolicyTrackId } from '../types/ids';
import type { EffectDescriptor, GameState, PlayerState, UnificationContract } from '../types/state';

const fail = (reason: string): ReduceResult => ({ ok: false, reason });

function move(
  tracks: Record<PolicyTrackId, number>,
  effects: EffectDescriptor[],
  track: PolicyTrackId,
  direction: PolicyDirection,
  amount: number,
): Record<PolicyTrackId, number> {
  const before = tracks[track];
  const after = Math.max(POLICY_TRACK_MIN, Math.min(POLICY_TRACK_MAX, before + direction * amount));
  if (after !== before) effects.push({ target: track, field: 'policyTrack', delta: after - before, after });
  return { ...tracks, [track]: after };
}

/**
 * 부록 A-15: 공개 조건 계약 이행 — 대표 후보가 실제로 당선된 경우에만 조건이 자동 집행된다.
 * 낙선했으면 계약은 그냥 무효가 된다(불이행 경로 자체가 없다 — §16-5 "이행 수"는 성사된 것만 센다).
 */
function settleUnificationContract(
  contract: UnificationContract | null,
  winner: CandidateId | null,
  players: PlayerState[],
  tracks: Record<PolicyTrackId, number>,
  effects: EffectDescriptor[],
): { players: PlayerState[]; tracks: Record<PolicyTrackId, number>; contract: UnificationContract | null } {
  if (!contract || contract.leadCandidateId !== winner) return { players, tracks, contract };

  let nextTracks = tracks;
  let nextPlayers = players;
  for (const term of contract.terms) {
    if (term.kind === 'moneyTransfer') {
      nextPlayers = nextPlayers.map((p) => {
        if (p.id === contract.proposer) return { ...p, money: p.money - term.amount };
        if (p.id === contract.beneficiary) return { ...p, money: p.money + term.amount };
        return p;
      });
      effects.push({ target: contract.beneficiary, field: 'money', delta: term.amount });
    } else if (term.kind === 'victoryPointGrant') {
      nextPlayers = nextPlayers.map((p) => (p.id === contract.beneficiary ? { ...p, victoryPoints: p.victoryPoints + term.amount } : p));
      effects.push({ target: contract.beneficiary, field: 'victoryPoints', delta: term.amount });
    } else if (term.kind === 'policyConcession') {
      nextTracks = move(nextTracks, effects, term.track, term.direction, term.amount);
    }
  }
  nextPlayers = nextPlayers.map((p) => (p.id === contract.proposer ? { ...p, contractsFulfilled: p.contractsFulfilled + 1 } : p));

  return { players: nextPlayers, tracks: nextTracks, contract: { ...contract, fulfilled: true } };
}

/** §19 resolvePolicy — 당선 공약 이동 → 당선 효과 → 공개 조건 계약 이행 → 정책 압박 비교 */
export function applyResolvePolicyAction(state: GameState, catalog: CardCatalog): ReduceResult {
  if (state.phase !== 'policyResolution') {
    return fail(`지금(${state.phase})은 'resolvePolicy'를 할 수 없습니다`);
  }

  let tracks = { ...state.policyTracks };
  const effects: EffectDescriptor[] = [];
  const winner = state.round.winnerCandidateId;
  const winningPromiseId = winner ? state.round.camps[winner]?.promiseId : null;
  const winningPromise = winningPromiseId ? catalog.promises[winningPromiseId] : undefined;

  // ①당선 후보의 공약 정책 이동
  if (winningPromise) {
    tracks = move(tracks, effects, winningPromise.policyMove.track, winningPromise.policyMove.direction, winningPromise.policyMove.amount);
  }

  // ②당선 후보 카드의 당선 효과
  const resolution = state.round.electionEffectResolution;
  if (resolution?.kind === 'move') {
    tracks = move(tracks, effects, resolution.track, resolution.direction, resolution.amount);
  } else if (resolution?.kind === 'repeatPromise' && winningPromise) {
    for (let i = 0; i < resolution.repeat; i += 1) {
      tracks = move(tracks, effects, winningPromise.policyMove.track, winningPromise.policyMove.direction, winningPromise.policyMove.amount);
    }
  }

  // ③공개 단일화 조건의 정책 양보 등 — 대표 후보가 실제로 당선됐을 때만 자동 이행된다 (부록 A-15)
  const settled = settleUnificationContract(state.round.unificationContract, winner, state.players, tracks, effects);
  tracks = settled.tracks;
  let players = settled.players;

  // ④정책 압박 비교 — 차이가 큰 트랙부터 최대 2개만, 동률은 트랙 정의 순서(POLICY_TRACKS)로 결정적
  const diffs = POLICY_TRACKS.map((track) => {
    const pressure = state.round.policyPressure[track];
    return { track, diff: pressure.plus - pressure.minus };
  }).filter((d) => d.diff !== 0);
  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const appliedTracks: Array<{ track: PolicyTrackId; direction: PolicyDirection }> = [];
  for (const d of diffs.slice(0, 2)) {
    const direction: PolicyDirection = d.diff > 0 ? 1 : -1;
    tracks = move(tracks, effects, d.track, direction, 1);
    appliedTracks.push({ track: d.track, direction });
  }

  const nextPhase = getNextPhase('policyResolution', state.round.round, state.maxRounds);
  const entry = createLogEntry(state, 'policyResolution', null, 'resolvePolicy', '정책 변화가 반영되었습니다', effects);
  const next: GameState = {
    ...appendLog(state, entry),
    policyTracks: tracks,
    players,
    round: { ...state.round, pressureAppliedTracks: appliedTracks, unificationContract: settled.contract },
    phase: nextPhase,
  };
  return { ok: true, state: next, log: [entry] };
}
