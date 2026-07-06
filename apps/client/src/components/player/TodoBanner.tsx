// 기반 스킬: skills/client-player/SKILL.md
// "지금 해야 할 일" — 최우선 UI, 매 순간 비어 있지 않아야 한다 (§30-1)
import { getPendingDecision } from '@kingmakers/engine';
import type { GameState, PlayerId } from '@kingmakers/engine';
import styles from './player.module.css';

interface TodoBannerProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function TodoBanner({ state, myPlayerId }: TodoBannerProps) {
  const pending = getPendingDecision(state);
  const isMyTurn = pending?.actors.includes(myPlayerId) ?? false;

  let text: string;
  if (state.phase === 'gameEnd') {
    text = '게임이 종료되었습니다 — 최종 결과를 확인하세요';
  } else if (!pending) {
    text = '시스템이 자동으로 진행하는 중입니다. 잠시만 기다려 주세요…';
  } else if (isMyTurn) {
    text = pending.description;
  } else if (pending.actors.length > 0) {
    const names = pending.actors.map((id) => state.players.find((p) => p.id === id)?.name ?? id).join(', ');
    text = `${names} 님을 기다리는 중…`;
  } else {
    text = pending.description;
  }

  return (
    <div className={isMyTurn ? `${styles.banner} ${styles.bannerActive}` : styles.banner}>
      <div className={styles.bannerTitle}>
        {isMyTurn && <span className={styles.pulseDot} />}
        {isMyTurn ? '내 차례 - 진행 필요' : '대기 중'}
      </div>
      <div className={styles.bannerBody}>{text}</div>
    </div>
  );
}
