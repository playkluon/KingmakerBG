// 기반 스킬: skills/client-lobby-table/SKILL.md
// ActionLogEntry.summary 스트림 — 로그를 읽지 않아도 방금 일어난 일이 이해되어야 한다 (§22)
import { PHASES } from '@kingmakers/engine';
import type { GameState } from '@kingmakers/engine';
import styles from './board.module.css';

interface ActionLogProps {
  state: GameState;
}

/** 최근 액션 로그 스트림 — table/player/spectator 화면이 공유한다 */
export function ActionLog({ state }: ActionLogProps) {
  const entries = [...state.actionLog].reverse().slice(0, 60);
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>액션 로그</h2>
      <div className={styles.log}>
        {entries.length === 0 && <p className={styles.cardMeta}>아직 기록이 없습니다</p>}
        {entries.map((entry) => (
          <div key={entry.seq} className={styles.logEntry}>
            <span className={styles.logPhase}>
              R{entry.round}·{PHASES[entry.phase].description}
            </span>
            {entry.summary}
          </div>
        ))}
      </div>
    </div>
  );
}
