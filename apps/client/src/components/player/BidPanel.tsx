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
        <h2 className={board.sectionTitle}>입찰 완료</h2>
        <p className={styles.hint}>
          {confirmedCount}/{state.players.length}명 확정
        </p>
      </div>
    );
  }

  return (
    <div className={board.section} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed var(--accent-primary)', textAlign: 'center', padding: '20px' }}>
      <p className={styles.hint} style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
        👇 중앙 보드판에서 각 후보 카드의 하단 버튼을 조작하여 입찰을 진행하세요.
      </p>
      <p className={styles.hint} style={{ marginTop: '8px' }}>
        ({confirmedCount}/{state.players.length}명 확정 대기 중)
      </p>
    </div>
  );
}
