// 기반 스킬: skills/client-lobby-table/SKILL.md
// ActionLogEntry.summary 스트림 — 로그를 읽지 않아도 방금 일어난 일이 이해되어야 한다 (§22)
import { PHASES } from '@kingmakers/engine';
import type { GameState } from '@kingmakers/engine';
import styles from './board.module.css';

interface ActionLogProps {
  state: GameState;
}

/** 텍스트 내 특정 자원/키워드에 이모지 아이콘을 부여하는 헬퍼 함수 */
function enrichSummary(text: string) {
  // 간단한 정규식으로 키워드 매칭 후 아이콘 치환
  let enriched = text
    .replace(/평판/g, '⭐ 평판')
    .replace(/(자금|돈)(?!\s*💰)/g, '💰 $1')
    .replace(/조직력/g, '🤝 조직력')
    .replace(/영향력/g, '🔥 영향력')
    .replace(/(승점|VP)/gi, '🏆 $1')
    .replace(/밀약/g, '📜 밀약')
    .replace(/배신/g, '🔪 배신')
    .replace(/정책/g, '🏛️ 정책');
  
  return enriched;
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
            <span className={styles.logText}>
              {enrichSummary(entry.summary)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
