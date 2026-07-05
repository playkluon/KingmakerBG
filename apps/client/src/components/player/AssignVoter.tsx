// 기반 스킬: skills/client-player/SKILL.md
// 내 통제 유권자 → 출마 후보 배정 ("무료" 라벨) — 라운드로빈 차례와 무관하게 언제든 가능하다 (§10)
import { useState } from 'react';
import { getVoterController } from '@kingmakers/engine';
import type { CandidateId, GameState, PlayerId, VoterId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName, voterById } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface AssignVoterProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function AssignVoter({ state, myPlayerId }: AssignVoterProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busyVoter, setBusyVoter] = useState<VoterId | null>(null);
  const myVoters = state.round.votersRevealed.filter(
    (id) => getVoterController(state.round.voterInfluence, id) === myPlayerId,
  );

  if (myVoters.length === 0) return null;

  async function handleAssign(voterId: VoterId, candidateId: CandidateId) {
    setBusyVoter(voterId);
    await sendAction({ type: 'assignVoterChoice', actor: myPlayerId, voterId, candidateId });
    setBusyVoter(null);
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>
        유권자 배정 <span className={styles.hint}>(무료, 언제든 가능)</span>
      </h2>
      {myVoters.map((voterId) => {
        const assigned = state.round.voterAssignments[voterId];
        return (
          <div key={voterId} className={styles.actionRow}>
            <span className={styles.actionLabel}>{voterById.get(voterId)?.name ?? voterId}</span>
            <select
              className={styles.select}
              value={assigned ?? ''}
              disabled={busyVoter === voterId}
              onChange={(e) => e.target.value && handleAssign(voterId, e.target.value as CandidateId)}
            >
              <option value="">배정 안 함</option>
              {state.round.candidatesRunning.map((id) => (
                <option key={id} value={id}>
                  {candidateName(id)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
