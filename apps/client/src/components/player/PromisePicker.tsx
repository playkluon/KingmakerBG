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
    <>
      {pending.map((candidateId) => {
        const options = state.round.camps[candidateId]?.promiseOptions ?? [];
        return (
          <div key={candidateId} className={board.section}>
            <h2 className={board.sectionTitle}>{candidateName(candidateId)}의 공약 선택</h2>
            <div className={styles.pickerGrid}>
              {options.map((promiseId) => {
                const promise = promiseById.get(promiseId);
                return (
                  <button
                    key={promiseId}
                    className={styles.pickerCard}
                    onClick={() => sendAction({ type: 'selectPromise', actor: myPlayerId, candidateId, promiseId })}
                  >
                    <div className={styles.pickerCardTitle}>{promise?.name ?? promiseId}</div>
                    <div className={styles.hint}>{promise?.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
