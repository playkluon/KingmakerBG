// 기반 스킬: skills/client-lobby-table/SKILL.md
// 라운드 n/5 · phase 한국어 설명 · 지금 누구를 기다리는지 표시 (§22 필수 UI)
import { getPendingDecision, getPhaseDescription } from '@kingmakers/engine';
import type { GameState, PlayerId } from '@kingmakers/engine';
import styles from './board.module.css';

interface PhaseHeaderProps {
  state: GameState;
}

/** 공용 진행 상태 헤더 — table/player/spectator 화면이 공유한다 */
export function PhaseHeader({ state }: PhaseHeaderProps) {
  const pending = getPendingDecision(state);
  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? id;

  let waitingText: string;
  if (state.phase === 'gameEnd') {
    waitingText = '게임이 종료되었습니다';
  } else if (pending && pending.actors.length > 0) {
    waitingText = `${pending.actors.map(nameOf).join(', ')} 님 대기 중 — ${pending.description}`;
  } else if (pending) {
    waitingText = pending.description;
  } else {
    waitingText = '시스템이 자동으로 진행하는 중…';
  }

  return (
    <header className={styles.phaseHeader}>
      <span className={styles.phaseRound}>
        라운드 {state.round.round}/{state.maxRounds}
      </span>
      <span className={styles.phaseName}>{getPhaseDescription(state)}</span>
      <span className={styles.phaseWaiting}>{waitingText}</span>
    </header>
  );
}
