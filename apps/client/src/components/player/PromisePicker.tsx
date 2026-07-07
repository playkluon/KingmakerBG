// 기반 스킬: skills/client-player/SKILL.md
// majorBacker일 때 공약 3장 중 선택 (§9)
import type { GameState, PlayerId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName, promiseById } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface PromisePickerProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function PromisePicker({ state, myPlayerId }: PromisePickerProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const pending = state.round.candidatesRunning.filter(
    (id) => state.round.camps[id]?.majorBacker === myPlayerId && state.round.camps[id]?.promiseId == null,
  );

  if (pending.length === 0) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>공약 선택</h2>
        <p className={styles.hint}>다른 브로커의 공약 선택을 기다리는 중…</p>
      </div>
    );
  }

  return (
    <div className={board.section} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed var(--accent-primary)', textAlign: 'center', padding: '20px' }}>
      <p className={styles.hint} style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
        👇 중앙 보드판의 후보자 카드 옆에서 공약을 선택하세요.
      </p>
    </div>
  );
}
