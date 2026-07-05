// 기반 스킬: skills/client-player/SKILL.md
// 선택형 당선 효과(choose/flex) 옵션 — 카드에 인쇄된 공개 정보를 그대로 보여줄 뿐이다 (§14)
import { useState } from 'react';
import { POLICY_TRACKS } from '@kingmakers/engine';
import type { GameState, PlayerId, PolicyDirection, PolicyTrackId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateById, candidateName, TRACK_LABELS } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface ElectionEffectPickerProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function ElectionEffectPicker({ state, myPlayerId }: ElectionEffectPickerProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busy, setBusy] = useState(false);
  const [track, setTrack] = useState<PolicyTrackId>(POLICY_TRACKS[0]!);
  const [direction, setDirection] = useState<PolicyDirection>(1);

  const winnerId = state.round.winnerCandidateId;
  const camp = winnerId ? state.round.camps[winnerId] : null;
  const card = winnerId ? candidateById.get(winnerId) : null;

  if (!winnerId || !card || camp?.majorBacker !== myPlayerId) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>당선 효과</h2>
        <p className={styles.hint}>
          {winnerId ? `${candidateName(winnerId)} 측의 당선 효과 선택을 기다리는 중…` : '당선 결과를 기다리는 중…'}
        </p>
      </div>
    );
  }

  async function submit(t: PolicyTrackId, d: PolicyDirection) {
    setBusy(true);
    await sendAction({ type: 'selectElectionPolicyMove', actor: myPlayerId, track: t, direction: d });
    setBusy(false);
  }

  const effect = card.electionEffect;

  if (effect.kind === 'choosePolicyMove') {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>당선 효과 선택 — {candidateName(winnerId)}</h2>
        <div className={styles.pickerGrid}>
          {effect.options.map((option) => (
            <button
              key={`${option.track}-${option.direction}`}
              className={styles.pickerCard}
              disabled={busy}
              onClick={() => submit(option.track, option.direction)}
            >
              <div className={styles.pickerCardTitle}>{TRACK_LABELS[option.track].name}</div>
              <div className={styles.hint}>
                {option.direction === 1 ? TRACK_LABELS[option.track].plus : TRACK_LABELS[option.track].minus} 방향으로{' '}
                {option.amount}칸
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (effect.kind === 'flexPolicyMove') {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>당선 효과 선택 — {candidateName(winnerId)}</h2>
        <p className={styles.hint}>원하는 트랙과 방향을 자유롭게 선택하세요 ({effect.amount}칸 이동)</p>
        <div className={styles.actionRow}>
          <select className={styles.select} value={track} onChange={(e) => setTrack(e.target.value as PolicyTrackId)}>
            {POLICY_TRACKS.map((t) => (
              <option key={t} value={t}>
                {TRACK_LABELS[t].name}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={direction}
            onChange={(e) => setDirection(Number(e.target.value) as PolicyDirection)}
          >
            <option value={1}>{TRACK_LABELS[track].plus} 방향</option>
            <option value={-1}>{TRACK_LABELS[track].minus} 방향</option>
          </select>
          <button className={board.button} disabled={busy} onClick={() => submit(track, direction)}>
            확정
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>당선 효과</h2>
      <p className={styles.hint}>자동으로 결정되었습니다.</p>
    </div>
  );
}
