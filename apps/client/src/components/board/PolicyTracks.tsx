// 기반 스킬: skills/client-lobby-table/SKILL.md
// §6 정책 트랙 5종(-2..2) 시각화 — 현재 값 하이라이트 + 대기 중인 압박 표시
import { POLICY_TRACKS, POLICY_TRACK_MAX, POLICY_TRACK_MIN } from '@kingmakers/engine';
import type { GameState, PolicyPressure, PolicyTrackId } from '@kingmakers/engine';
import { TRACK_LABELS } from '../../lib/cards';
import styles from './board.module.css';

interface PolicyTracksProps {
  state: GameState;
}

const CELLS: readonly number[] = Array.from(
  { length: POLICY_TRACK_MAX - POLICY_TRACK_MIN + 1 },
  (_, i) => POLICY_TRACK_MIN + i,
);

/** 정책 트랙 5개 카드 — table/player/spectator 화면이 공유한다 */
export function PolicyTracks({ state }: PolicyTracksProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>정책 트랙</h2>
      <div className={styles.tracks}>
        {POLICY_TRACKS.map((track) => (
          <PolicyTrackRow
            key={track}
            track={track}
            value={state.policyTracks[track]}
            pressure={state.round.policyPressure[track]}
          />
        ))}
      </div>
    </div>
  );
}

function PolicyTrackRow({
  track,
  value,
  pressure,
}: {
  track: PolicyTrackId;
  value: number;
  pressure: PolicyPressure;
}) {
  const label = TRACK_LABELS[track];
  return (
    <div className={styles.track}>
      <div className={styles.trackName}>{label.name}</div>
      <div className={styles.trackCells}>
        {CELLS.map((cell) => (
          <div
            key={cell}
            className={cell === value ? `${styles.trackCell} ${styles.trackCellActive}` : styles.trackCell}
          >
            {cell === 0 ? '·' : ''}
          </div>
        ))}
      </div>
      <div className={styles.trackEnds}>
        <span>◀ {label.minus}</span>
        <span>{label.plus} ▶</span>
      </div>
      {(pressure.plus > 0 || pressure.minus > 0) && (
        <div className={styles.trackEnds}>
          <span>압박 −{pressure.minus}</span>
          <span>압박 +{pressure.plus}</span>
        </div>
      )}
    </div>
  );
}
