// 기반 스킬: skills/client-lobby-table/SKILL.md
// 공개 유권자, controller 표시, 배치 결과 (§22 필수 UI)
import { useState } from 'react';
import { getVoterController } from '@kingmakers/engine';
import type { GameState, PlayerId, VoterId } from '@kingmakers/engine';
import { CAMPAIGN_ACTION_COSTS } from '@kingmakers/engine';
import { candidateName, groupLabel, voterById } from '../../lib/cards';
import { Tooltip } from '../Tooltip';
import { useGameStore } from '../../store/gameStore';
import { costLabel } from '../player/CampaignActions';
import styles from './board.module.css';

interface VoterBoardProps {
  state: GameState;
  myPlayerId?: PlayerId;
}

/**
 * 공개 유권자 카드 그리드 — table/player/spectator 화면이 공유한다.
 * getVoterController는 voterInfluence(이미 공개된 상태)에 대한 순수 표시용 판정이라
 * 서버와 동일한 결과를 보장하기 위해 엔진 함수를 그대로 재사용한다 (CLAUDE.md 코딩 규칙: 셀렉터/포매터 허용).
 */
export function VoterBoard({ state, myPlayerId }: VoterBoardProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const { round, players } = state;
  const nameOf = (id: string | null) => (id ? (players.find((p) => p.id === id)?.name ?? id) : null);

  const [selectedCardId, setSelectedCardId] = useState<VoterId | null>(null);
  const isMyCampaignTurn = state.phase === 'campaignActions' && state.round.campaignTurnOrder[state.round.campaignActiveIndex] === myPlayerId;
  const used = myPlayerId ? (state.round.campaignActionsUsed[myPlayerId] ?? 0) : 0;
  const canAct = isMyCampaignTurn && used < 2;

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
          const isClickable = canAct;
          const className = [
            styles.card,
            isClickable && styles.rainbowBorderActive,
          ].filter(Boolean).join(' ');

          return (
            <div key={id} style={{ position: 'relative' }}>
              <div 
                className={className} 
                onClick={() => isClickable && setSelectedCardId(selectedCardId === id ? null : id)}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
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
              {selectedCardId === id && myPlayerId && (
                <VoterActionPopup 
                  voterId={id} 
                  myPlayerId={myPlayerId} 
                  onAction={async () => {
                    setSelectedCardId(null);
                    await sendAction({ type: 'contactVoter', actor: myPlayerId, voterId: id });
                  }} 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VoterActionPopup({ 
  voterId, 
  myPlayerId, 
  onAction 
}: { 
  voterId: VoterId; 
  myPlayerId: PlayerId; 
  onAction: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translate(-50%, 8px)',
      background: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--accent-primary)',
      borderRadius: '8px',
      padding: '8px',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      minWidth: '160px',
    }}>
      <button className={styles.buttonGhost} onClick={(e) => { e.stopPropagation(); onAction(); }}>
        🗣️ 유권자 접촉 ({costLabel(CAMPAIGN_ACTION_COSTS.contactVoter)})
      </button>
    </div>
  );
}
