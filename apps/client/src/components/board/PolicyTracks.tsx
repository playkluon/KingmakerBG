// 기반 스킬: skills/client-lobby-table/SKILL.md
// §6 정책 트랙 5종(-2..2) 시각화 — 현재 값 하이라이트 + 대기 중인 압박 표시
import { POLICY_TRACKS, POLICY_TRACK_MAX, POLICY_TRACK_MIN } from '@kingmakers/engine';
import type { GameState, PolicyPressure, PolicyTrackId } from '@kingmakers/engine';
import { TRACK_LABELS } from '../../lib/cards';
import { Tooltip } from '../Tooltip';
import styles from './board.module.css';

interface PolicyTracksProps {
  state: GameState;
}

const CELLS: readonly number[] = Array.from(
  { length: POLICY_TRACK_MAX - POLICY_TRACK_MIN + 1 },
  (_, i) => POLICY_TRACK_MIN + i,
);

const getTrackDescription = (track: string) => {
  switch (track) {
    case 'economy': return '경제 쟁점: 복지 확충(◀) vs 시장 자율화(▶)\n해당 방향을 지지하는 유권자들의 투표 성향에 직접적인 영향을 미칩니다.';
    case 'labor': return '노동 쟁점: 노동권 강화(◀) vs 기업 자율(▶)\n해당 방향을 지지하는 유권자들의 투표 성향에 직접적인 영향을 미칩니다.';
    case 'society': return '사회 쟁점: 시민 자유(◀) vs 사회 질서(▶)\n해당 방향을 지지하는 유권자들의 투표 성향에 직접적인 영향을 미칩니다.';
    case 'industry': return '산업 쟁점: 환경 우선(◀) vs 성장 우선(▶)\n해당 방향을 지지하는 유권자들의 투표 성향에 직접적인 영향을 미칩니다.';
    case 'foreign': return '대외 쟁점: 시장 개방(◀) vs 자국 보호(▶)\n해당 방향을 지지하는 유권자들의 투표 성향에 직접적인 영향을 미칩니다.';
    default: return '정책 트랙입니다.';
  }
};

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
      <Tooltip content={getTrackDescription(track)}>
        <div className={styles.trackName}>{label.name} ⓘ</div>
      </Tooltip>
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
