// 기반 스킬: skills/client-player/SKILL.md
// 후보별 입찰 배분(스텝퍼), 합계/잔액, 확정 후 잠금 (§8)
import { useState } from 'react';
import type { CandidateId, GameState, PlayerId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface BidPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function BidPanel({ state, myPlayerId }: BidPanelProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const me = state.players.find((p) => p.id === myPlayerId)!;
  const myBid = state.round.bids[myPlayerId];
  const confirmed = myBid?.confirmed ?? false;
  const candidates = state.round.candidatesRevealed;
  const confirmedCount = state.players.filter((p) => state.round.bids[p.id]?.confirmed).length;

  const [draft, setDraft] = useState<Partial<Record<CandidateId, number>>>(() => ({ ...(myBid?.allocations ?? {}) }));
  const [submitting, setSubmitting] = useState(false);

  const total = Object.values(draft).reduce((sum: number, v) => sum + (v ?? 0), 0);
  const remaining = me.money - total;

  function adjust(candidateId: CandidateId, delta: number) {
    setDraft((prev) => ({ ...prev, [candidateId]: Math.max(0, (prev[candidateId] ?? 0) + delta) }));
  }

  async function handleConfirm() {
    setSubmitting(true);
    const allocations = Object.fromEntries(Object.entries(draft).filter(([, v]) => (v ?? 0) > 0));
    const placed = await sendAction({ type: 'placeBid', actor: myPlayerId, allocations });
    if (placed.ok) await sendAction({ type: 'confirmAuctionBids', actor: myPlayerId });
    setSubmitting(false);
  }

  if (confirmed) {
    const finalAllocations = Object.entries(myBid?.allocations ?? {}).filter(([, v]) => (v ?? 0) > 0);
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>입찰 확정됨</h2>
        <p className={styles.hint}>
          {confirmedCount}/{state.players.length}명 확정
        </p>
        {finalAllocations.length === 0 ? (
          <p className={styles.hint}>이번 라운드는 입찰하지 않았습니다</p>
        ) : (
          finalAllocations.map(([id, amount]) => (
            <div key={id} className={styles.actionRow}>
              <span className={styles.actionLabel}>{candidateName(id)}</span>
              <span>{amount}</span>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>
        입찰 ({confirmedCount}/{state.players.length}명 확정)
      </h2>
      <p className={styles.hint}>
        자금 {me.money} 중 {total} 배분 · 잔액 {remaining}
      </p>
      <div className={styles.stepperList}>
        {candidates.map((id) => (
          <div key={id} className={styles.stepperRow}>
            <span className={styles.stepperLabel}>{candidateName(id)}</span>
            <div className={styles.stepperControls}>
              <button className={board.buttonGhost} disabled={(draft[id] ?? 0) <= 0} onClick={() => adjust(id, -1)}>
                −
              </button>
              <span className={styles.stepperValue}>{draft[id] ?? 0}</span>
              <button className={board.buttonGhost} disabled={remaining <= 0} onClick={() => adjust(id, 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className={board.button} disabled={submitting || remaining < 0} onClick={handleConfirm}>
        {submitting ? '제출 중…' : '입찰 확정'}
      </button>
    </div>
  );
}
