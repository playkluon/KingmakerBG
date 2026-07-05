// 기반 스킬: skills/client-lobby-table/SKILL.md
// 좌석별 공개 자원(money/org/rep/VP), 캠프 슬롯 배지 (§22 필수 UI: 플레이어 패널)
import type { CampRole, CandidateId, GameState, PlayerId } from '@kingmakers/engine';
import { candidateName } from '../../lib/cards';
import styles from './board.module.css';

interface PlayerPanelsProps {
  state: GameState;
  /** 내 좌석이면 강조 표시 — table/spectator 화면은 생략한다 */
  myPlayerId?: PlayerId | null;
}

const ROLE_LABELS: Record<CampRole, string> = {
  majorBacker: '메인 후원자',
  coBacker: '공동 후원자',
  organizer: '조직책',
};

function campRolesOf(state: GameState, playerId: PlayerId): Array<{ role: CampRole; candidateId: CandidateId }> {
  const result: Array<{ role: CampRole; candidateId: CandidateId }> = [];
  for (const candidateId of state.round.candidatesRunning) {
    const camp = state.round.camps[candidateId];
    if (!camp) continue;
    (['majorBacker', 'coBacker', 'organizer'] as const).forEach((role) => {
      if (camp[role] === playerId) result.push({ role, candidateId });
    });
  }
  return result;
}

/** 좌석별 공개 자원 패널 — table/player/spectator 화면이 공유한다 */
export function PlayerPanels({ state, myPlayerId }: PlayerPanelsProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>플레이어</h2>
      <div className={styles.playerRow}>
        {state.players.map((player) => {
          const roles = campRolesOf(state, player.id);
          return (
            <div
              key={player.id}
              className={player.id === myPlayerId ? `${styles.playerBox} ${styles.playerBoxMe}` : styles.playerBox}
            >
              <div className={styles.playerName}>{player.name}</div>
              <div className={styles.resources}>
                <span>자금 {player.money}</span>
                <span>조직 {player.organization}</span>
                <span>평판 {player.reputation}</span>
                <span>VP {player.victoryPoints}</span>
              </div>
              {roles.length > 0 && (
                <div className={styles.cardMeta}>
                  {roles.map((r) => `${ROLE_LABELS[r.role]}: ${candidateName(r.candidateId)}`).join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
