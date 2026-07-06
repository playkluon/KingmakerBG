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
        내 이벤트 카드 <span className={styles.hint}>(무료, 차례와 무관하게 사용 가능)</span>
      </h2>
      <div className={styles.eventHandGrid}>
        {hand.map((eventId) => {
          const card = eventById.get(eventId);
          if (!card) return null;
          
          const isCandidate = card.category === 'candidate';
          const cardClass = isCandidate ? styles.eventCardCandidate : styles.eventCardVoter;
          const icon = isCandidate ? '👔' : '👥';
          
          const needsTarget = card.effect.kind === 'candidateVotesDelta';
          const currentTarget = targets[eventId] || '';

          return (
            <div key={eventId} className={`${styles.eventCard} ${cardClass}`}>
              <div className={styles.eventCardTitle}>
                {icon} {card.name}
              </div>
              <div className={styles.eventCardDesc}>
                {card.description}
              </div>
              
              {needsTarget && (
                <div className={styles.targetSelectorArea}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>대상 후보 선택:</div>
                  <div className={styles.selectableRow} style={{ marginBottom: '12px', justifyContent: 'center' }}>
                    {state.round.candidatesRunning.map((id) => (
                      <div
                        key={id}
                        className={`${styles.avatarBadge} ${currentTarget === id ? styles.avatarBadgeActive : ''}`}
                        onClick={() => setTargets((prev) => ({ ...prev, [eventId]: id }))}
                        style={{ padding: '4px 10px', fontSize: '0.8rem', minWidth: 'auto' }}
                      >
                        {candidateName(id)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={styles.eventCardAction}>
                <button
                  className={board.button}
                  disabled={busyId === eventId || (needsTarget && !currentTarget)}
                  onClick={() => handleUse(eventId)}
                  style={{ width: '100%', marginTop: needsTarget ? '0' : '12px' }}
                >
                  사용하기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
