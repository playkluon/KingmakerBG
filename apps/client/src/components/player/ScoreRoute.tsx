// 기반 스킬: skills/ux-feedback/SKILL.md
// 내 점수 루트: 현재 VP + 이번 라운드 가능 VP 출처 목록 (§30-2 "그 선택은 어떤 점수 루트로 이어지는가")
import { getScoreRoute } from '@kingmakers/engine';
import type { GameState, PlayerId } from '@kingmakers/engine';
import { candidateName } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface ScoreRouteProps {
  state: GameState;
  myPlayerId: PlayerId;
}

/** getScoreRoute는 CardCatalog 없이 공개 상태만으로 계산되는 엔진 selector라 클라이언트에서 직접 호출한다 */
export function ScoreRoute({ state, myPlayerId }: ScoreRouteProps) {
  const me = state.players.find((p) => p.id === myPlayerId);
  const entries = getScoreRoute(state, myPlayerId);

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>내 점수 루트</h2>
      <p className={styles.hint}>현재 공개 VP {me?.victoryPoints ?? 0}</p>
      {entries.length === 0 ? (
        <p className={styles.hint}>이번 라운드에 확정된 캠프 역할·기여가 아직 없습니다.</p>
      ) : (
        <ul className={styles.scoreRouteList}>
          {entries.map((entry, i) => (
            <li key={i} className={styles.scoreRouteItem}>
              <span>
                {entry.candidateId && `${candidateName(entry.candidateId)} — `}
                {entry.label}
              </span>
              <span className={styles.scoreRouteAmount}>+{entry.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
