// 기반 스킬: skills/unification-voting/SKILL.md
// §14 정책 변화 4순서 + §6 정책 압박 비교
import { POLICY_TRACK_MAX, POLICY_TRACK_MIN, POLICY_TRACKS } from '../constants';
import { appendLog, createLogEntry } from '../log';
import { getNextPhase } from '../phases';
import type { ReduceResult } from '../result';
import type { CardCatalog } from '../types/cards';
import type { PolicyDirection, PolicyTrackId } from '../types/ids';
import type { EffectDescriptor, GameState } from '../types/state';

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

/** §19 resolvePolicy — 당선 공약 이동 → 당선 효과 → (단일화 양보, no-op) → 정책 압박 비교 */
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

  // ③공개 단일화 조건의 정책 양보 — Skill 12(고급 규칙)까지 no-op 훅
  // (공개 계약 자체가 아직 없으므로 여기서 할 일이 없다)

  // ④정책 압박 비교 — 차이가 큰 트랙부터 최대 2개만, 동률은 트랙 정의 순서(POLICY_TRACKS)로 결정적
  const diffs = POLICY_TRACKS.map((track) => {
    const pressure = state.round.policyPressure[track];
    return { track, diff: pressure.plus - pressure.minus };
  }).filter((d) => d.diff !== 0);
  diffs.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  for (const d of diffs.slice(0, 2)) {
    tracks = move(tracks, effects, d.track, d.diff > 0 ? 1 : -1, 1);
  }

  const nextPhase = getNextPhase('policyResolution', state.round.round, state.maxRounds);
  const entry = createLogEntry(state, 'policyResolution', null, 'resolvePolicy', '정책 변화가 반영되었습니다', effects);
  const next: GameState = { ...appendLog(state, entry), policyTracks: tracks, phase: nextPhase };
  return { ok: true, state: next, log: [entry] };
}
