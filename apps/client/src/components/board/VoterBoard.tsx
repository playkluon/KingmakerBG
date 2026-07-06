// 기반 스킬: skills/client-lobby-table/SKILL.md
// 공개 유권자, controller 표시, 배치 결과 (§22 필수 UI)
import { getVoterController } from '@kingmakers/engine';
import type { GameState } from '@kingmakers/engine';
import { candidateName, groupLabel, voterById } from '../../lib/cards';
import { Tooltip } from '../Tooltip';
import styles from './board.module.css';

interface VoterBoardProps {
  state: GameState;
}

/**
 * 공개 유권자 카드 그리드 — table/player/spectator 화면이 공유한다.
 * getVoterController는 voterInfluence(이미 공개된 상태)에 대한 순수 표시용 판정이라
 * 서버와 동일한 결과를 보장하기 위해 엔진 함수를 그대로 재사용한다 (CLAUDE.md 코딩 규칙: 셀렉터/포매터 허용).
 */
export function VoterBoard({ state }: VoterBoardProps) {
  const { round, players } = state;
  const nameOf = (id: string | null) => (id ? (players.find((p) => p.id === id)?.name ?? id) : null);

  if (round.votersRevealed.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>유권자</h2>
      <div className={styles.cardGrid}>
        {round.votersRevealed.map((id) => {
          const card = voterById.get(id);
          const controllerName = nameOf(getVoterController(round.voterInfluence, id));
          const assignedTo = round.voterAssignments[id];
          return (
            <div key={id} className={styles.card}>
              <div className={styles.cardName}>{card?.name ?? id}</div>
              <div className={styles.cardMeta}>
                {card ? (
                  <Tooltip content={`[${groupLabel(card.group)}] 그룹 유권자\n정책 트랙의 변화에 가장 민감하게 반응하며, 이들의 마음을 얻는 것이 승리의 열쇠입니다.`}>
                    <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>
                      {groupLabel(card.group)}
                    </span>
                  </Tooltip>
                ) : ''} · 표 가중치 {card?.voteWeight ?? '?'}
              </div>
              <div className={styles.cardMeta}>
                {controllerName ? <span className={styles.badge}>통제: {controllerName}</span> : '통제자 없음'}
              </div>
              {assignedTo && <div className={styles.cardMeta}>배정: {candidateName(assignedTo)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
