// 기반 스킬: skills/client-lobby-table/SKILL.md
// 공개 후보 / 출마 후보 / 확정 공약 / 현재 표 (§22 필수 UI)
import { useState } from 'react';
import type { CandidateId, GameState, CandidateAbility, PlayerId } from '@kingmakers/engine';
import { CAMPAIGN_ACTION_COSTS } from '@kingmakers/engine';
import { candidateById, candidateName, promiseById, tagLabel, groupLabel } from '../../lib/cards';
import { CAMP_ROLE_LABELS } from '../../lib/terms';
import { Tooltip } from '../Tooltip';
import { useGameStore } from '../../store/gameStore';
import { costLabel } from '../player/CampaignActions';
import styles from './board.module.css';

interface CandidateBoardProps {
  state: GameState;
  myPlayerId?: PlayerId;
}

function parseAbilityBadge(ability: CandidateAbility) {
  switch (ability.kind) {
    case 'fundraiseBonus': return { text: `💰 모금 +${ability.amount}`, type: 'good' };
    case 'voterContactDiscount': return { text: `🗣️ 접촉 할인`, type: 'good' };
    case 'policyPressureDiscount': return { text: `⚖️ 정책 할인`, type: 'good' };
    case 'promiseRestriction': return { text: `🚫 공약 불가`, type: 'bad' };
    case 'reputationLossOnPromise': return { text: `📉 평판 하락`, type: 'bad' };
    case 'flavorOnly': return null;
  }
}

function parseAbilityDesc(ability: CandidateAbility) {
  switch (ability.kind) {
    case 'fundraiseBonus': return `자금 조달 액션 시 추가 자금 ${ability.amount} 획득`;
    case 'voterContactDiscount': return `[${groupLabel(ability.group)}] 유권자 접촉 시 비용 ${ability.amount} 감소`;
    case 'policyPressureDiscount': return `정책 압박 액션 시 조직력 비용 ${ability.amount} 감소`;
    case 'promiseRestriction': return `[${tagLabel(ability.excludedTag)}] 태그가 있는 공약은 수용 불가 (경매 패스)`;
    case 'reputationLossOnPromise': return `공약을 수용할 때마다 평판 ${ability.amount} 하락`;
    case 'flavorOnly': return ability.description;
  }
}

function CandidateAbilitiesTooltip({ abilities }: { abilities: CandidateAbility[] }) {
  const activeAbilities = abilities.filter(a => a.kind !== 'flavorOnly');
  if (activeAbilities.length === 0) return <div style={{ fontSize: '0.85rem' }}>특수 능력이 없습니다.</div>;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
      <strong style={{ color: 'var(--accent-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>후보 특성 (능력/약점)</strong>
      {activeAbilities.map((ab, i) => {
        const parsed = parseAbilityBadge(ab);
        const isBad = parsed?.type === 'bad';
        return (
          <div key={i} style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
            {parsed && <strong style={{ color: isBad ? 'var(--accent-danger)' : 'var(--accent-success)', display: 'block', marginBottom: '2px' }}>{parsed.text}</strong>}
            <span style={{ color: 'var(--text-main)' }}>{parseAbilityDesc(ab)}</span>
          </div>
        );
      })}
    </div>
  );
}

function AbilityBadges({ abilities }: { abilities: CandidateAbility[] }) {
  const activeAbilities = abilities.filter(a => a.kind !== 'flavorOnly');
  if (activeAbilities.length === 0) return null;
  return (
    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {activeAbilities.map((ab, i) => {
        const parsed = parseAbilityBadge(ab);
        if (!parsed) return null;
        const badgeClass = parsed.type === 'good' ? styles.abilityBadge : styles.weaknessBadge;
        return <span key={i} className={`${styles.badge} ${badgeClass}`}>{parsed.text}</span>;
      })}
    </div>
  );
}

/** 후보 마켓/출마 후보 카드 그리드 — table/player/spectator 화면이 공유한다 */
export function CandidateBoard({ state, myPlayerId }: CandidateBoardProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const { round, players } = state;
  const nameOf = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? '—';
  const running = round.candidatesRunning;
  const notRunning = round.candidatesRevealed.filter((id) => !running.includes(id));
  const lastVotes = state.lastRoundResult?.round === round.round ? state.lastRoundResult.candidateVotes : null;

  const [selectedCardId, setSelectedCardId] = useState<CandidateId | null>(null);
  const isMyCampaignTurn = state.phase === 'campaignActions' && state.round.campaignTurnOrder[state.round.campaignActiveIndex] === myPlayerId;
  const used = myPlayerId ? (state.round.campaignActionsUsed[myPlayerId] ?? 0) : 0;
  const canAct = isMyCampaignTurn && used < 2;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>후보</h2>
      {running.length === 0 ? (
        <div className={styles.cardGrid}>
          {round.candidatesRevealed.map((id) => (
            <RevealedCandidateCard key={id} id={id} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.cardGrid}>
            {running.map((id) => {
              const camp = round.camps[id];
              const isWinner = round.winnerCandidateId === id;
              const isWithdrawn = round.withdrawnCandidates.includes(id);
              const isClickable = canAct;
              const className = [
                styles.card,
                styles.cardRunning,
                isWinner && styles.cardWinner,
                isWithdrawn && styles.cardWithdrawn,
                isClickable && styles.rainbowBorderActive,
              ]
                .filter(Boolean)
                .join(' ');
              const card = candidateById.get(id);
              const promise = camp?.promiseId ? promiseById.get(camp.promiseId) : null;
              const bonus = round.campaignVotes[id] ?? 0;
              return (
                <div key={id} style={{ position: 'relative' }}>
                  <Tooltip content={<CandidateAbilitiesTooltip abilities={card?.abilities ?? []} />}>
                    <div 
                      className={className} 
                      onClick={() => isClickable && setSelectedCardId(selectedCardId === id ? null : id)}
                      style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    >
                      <div className={styles.cardName}>
                        {card?.name ?? id}
                        {isWinner && <span className={`${styles.badge} ${styles.badgeGold}`}>당선</span>}
                        {isWithdrawn && <span className={`${styles.badge} ${styles.badgeRed}`}>사퇴</span>}
                      </div>
                    <div className={styles.cardMeta}>
                      기본표 {card?.baseVotes ?? '?'}
                      {bonus !== 0 && ` · 캠페인 보정 ${bonus > 0 ? '+' : ''}${bonus}`}
                      {lastVotes?.[id] != null && ` · 최종 표 ${lastVotes[id]}`}
                    </div>
                    <div className={styles.cardMeta}>
                      {CAMP_ROLE_LABELS.majorBacker} {nameOf(camp?.majorBacker)}
                      {camp?.coBacker && ` · ${CAMP_ROLE_LABELS.coBacker} ${nameOf(camp.coBacker)}`}
                      {camp?.organizer && ` · ${CAMP_ROLE_LABELS.organizer} ${nameOf(camp.organizer)}`}
                    </div>
                    <div className={styles.cardMeta}>공약: {promise ? promise.name : '선택 대기 중'}</div>
                    <AbilityBadges abilities={card?.abilities ?? []} />
                    </div>
                  </Tooltip>
                  {selectedCardId === id && myPlayerId && (
                    <CandidateActionPopup 
                      candidateId={id} 
                      myPlayerId={myPlayerId} 
                      state={state} 
                      onAction={async (actionType) => {
                        setSelectedCardId(null);
                        await sendAction({ type: actionType, actor: myPlayerId, candidateId: id } as any);
                      }} 
                    />
                  )}
                </div>
              );
            })}
          </div>
          {notRunning.length > 0 && (
            <p className={styles.cardMeta}>경매 탈락: {notRunning.map((id) => candidateName(id)).join(', ')}</p>
          )}
        </>
      )}
    </div>
  );
}

function RevealedCandidateCard({ id }: { id: CandidateId }) {
  const card = candidateById.get(id);
  return (
    <Tooltip content={<CandidateAbilitiesTooltip abilities={card?.abilities ?? []} />}>
      <div className={styles.card}>
        <div className={styles.cardName}>{card?.name ?? id}</div>
        <div className={styles.cardMeta}>기본표 {card?.baseVotes ?? '?'}</div>
        <div className={styles.cardMeta}>{card?.description}</div>
        <AbilityBadges abilities={card?.abilities ?? []} />
      </div>
    </Tooltip>
  );
}

function CandidateActionPopup({ 
  candidateId, 
  myPlayerId, 
  state, 
  onAction 
}: { 
  candidateId: CandidateId; 
  myPlayerId: PlayerId; 
  state: GameState; 
  onAction: (type: 'runAd' | 'reportScandal' | 'conditionalSupport') => void;
}) {
  const camp = state.round.camps[candidateId];
  const isMyCandidate = camp?.majorBacker === myPlayerId || camp?.coBacker === myPlayerId || camp?.organizer === myPlayerId;

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
      minWidth: '180px',
    }}>
      {isMyCandidate ? (
        <button className={styles.buttonGhost} onClick={(e) => { e.stopPropagation(); onAction('runAd'); }}>
          📢 광고 ({costLabel(CAMPAIGN_ACTION_COSTS.runAd)})
        </button>
      ) : (
        <>
          <button className={styles.buttonGhost} onClick={(e) => { e.stopPropagation(); onAction('reportScandal'); }}>
            💥 스캔들 폭로 ({costLabel(CAMPAIGN_ACTION_COSTS.reportScandal)})
          </button>
          <button className={styles.buttonGhost} onClick={(e) => { e.stopPropagation(); onAction('conditionalSupport'); }}>
            🤝 조건부 지지 ({costLabel(CAMPAIGN_ACTION_COSTS.conditionalSupport)})
          </button>
        </>
      )}
    </div>
  );
}
