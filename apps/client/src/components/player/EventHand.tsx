// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-17)
// 내 이벤트 카드 손패 — campaignActions 중 언제든 무료로 사용할 수 있다 (assignVoterChoice와 동일한 성격)
import { useState } from 'react';
import type { CandidateId, GameState, PlayerId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName, eventById } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface EventHandProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function EventHand({ state, myPlayerId }: EventHandProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, CandidateId | ''>>({});

  const me = state.players.find((p) => p.id === myPlayerId);
  if (!me) return null;
  const hand = [...me.candidateEventHand, ...me.voterEventHand];
  if (hand.length === 0) return null;

  async function handleUse(eventId: string) {
    setBusyId(eventId);
    const card = eventById.get(eventId);
    const targetCandidateId = card?.effect.kind === 'candidateVotesDelta' ? targets[eventId] || undefined : undefined;
    await sendAction({ type: 'useEvent', actor: myPlayerId, eventId: eventId as never, targetCandidateId });
    setBusyId(null);
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>
        내 이벤트 카드 <span className={styles.hint}>(무료, 언제든 가능)</span>
      </h2>
      {hand.map((eventId) => {
        const card = eventById.get(eventId);
        const needsTarget = card?.effect.kind === 'candidateVotesDelta';
        return (
          <div key={eventId} className={styles.actionRow}>
            <span className={styles.actionLabel}>
              {card?.name ?? eventId}
              <span className={styles.hint}> — {card?.description}</span>
            </span>
            {needsTarget && (
              <select
                className={styles.select}
                value={targets[eventId] ?? ''}
                onChange={(e) => setTargets((prev) => ({ ...prev, [eventId]: e.target.value as CandidateId }))}
              >
                <option value="">후보 선택</option>
                {state.round.candidatesRunning.map((id) => (
                  <option key={id} value={id}>
                    {candidateName(id)}
                  </option>
                ))}
              </select>
            )}
            <button
              className={board.button}
              disabled={busyId === eventId || (needsTarget && !targets[eventId])}
              onClick={() => handleUse(eventId)}
            >
              사용
            </button>
          </div>
        );
      })}
    </div>
  );
}
