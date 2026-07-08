// 기반 스킬: skills/client-player/SKILL.md (코어 루프 개편안 B — 후보 제안·어필)
// 사전 공개된 이슈 2장을 보고 손패에서 후보 1명을 골라 탁자에 내놓는다.
import { useGameStore } from '../../store/gameStore';
import { CATALOG } from '../../lib/catalog';
import type { GameState, PlayerId } from '@kingmakers/engine';
import { RevealedCandidateCard } from '../board/CandidateBoard';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface CandidateProposalPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function CandidateProposalPanel({ state, myPlayerId }: CandidateProposalPanelProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const player = state.players.find((p) => p.id === myPlayerId);
  const myProposal = state.round.proposals[myPlayerId];

  // 내가 이미 제안했으면 다른 플레이어들을 기다린다
  if (myProposal) {
    const proposedName = CATALOG.candidates[myProposal]?.name ?? myProposal;
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>후보 제안 완료</h2>
        <p className={styles.hint}>
          {proposedName} 후보를 제안했습니다. 다른 플레이어들의 제안이 끝나면 숨겨진 이슈 2장이 공개됩니다.
        </p>
      </div>
    );
  }

  // 정당 후보가 모두 소모된 극단 케이스 — 제안 의무에서 자동 면제된다 (엔진 isProposalPhaseComplete와 동일 규칙)
  if (!player || player.hand.length === 0) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>후보 제안</h2>
        <p className={styles.hint}>제안할 수 있는 손패가 없어 이번 라운드 제안은 건너뜁니다. (당적 변경으로 새 손패를 받을 수 있습니다)</p>
      </div>
    );
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>이번 라운드 후보 제안 (어필)</h2>
      <p className={styles.hint}>
        사전 공개된 2장의 이슈를 참고하여, 현재 손패에 있는 후보 중 가장 유리한 후보를 1명 골라 탁자에 내놓고 어필하세요.
        전원이 제출하면 숨겨진 이슈 2장이 추가로 공개되어 판이 뒤집힐 수 있습니다.
      </p>

      <div className={styles.handContainer}>
        {player.hand.map((candidateId) => {
          const candidate = CATALOG.candidates[candidateId];
          if (!candidate) return null;
          return (
            <div key={candidateId} className={styles.handCardWrapper}>
              <RevealedCandidateCard id={candidateId} />
              <button
                className={board.button}
                onClick={() => sendAction({ type: 'proposeCandidate', actor: myPlayerId, candidateId })}
                style={{ marginTop: '0.5rem', width: '100%' }}
              >
                이 후보 제안하기
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
