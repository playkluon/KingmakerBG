// 기반 스킬: skills/client-player/SKILL.md
// 제안 작성(비율은 제출 즉시 서버가 계산해 보여준다) / 수신 제안 수락·거절 / 스킵 (§12)
import { useState } from 'react';
import type { CandidateId, GameAction, GameState, PlayerId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface UnificationPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

/**
 * 이전 비율은 클라이언트가 예측하지 않는다 — computeTransferRatio는 CardCatalog가 필요한 규칙 계산이라
 * CLAUDE.md 원칙(표 계산 클라이언트 금지)에 따라 제안 제출 후 서버가 채운 pendingUnificationProposal만 그대로 표시한다.
 */
export function UnificationPanel({ state, myPlayerId }: UnificationPanelProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busy, setBusy] = useState(false);
  const [leadCandidateId, setLeadCandidateId] = useState<CandidateId | ''>('');
  const [withdrawCandidateId, setWithdrawCandidateId] = useState<CandidateId | ''>('');
  const { round } = state;

  const [moneyTerm, setMoneyTerm] = useState('');
  const myCandidates = round.candidatesRunning.filter((id) => round.camps[id]?.majorBacker === myPlayerId);
  const isEligible = myCandidates.length > 0 && !round.unificationDone[myPlayerId];
  const proposal = round.pendingUnificationProposal;
  const isResponder = proposal ? round.camps[proposal.withdrawCandidateId]?.majorBacker === myPlayerId : false;
  const isProposer = proposal?.proposer === myPlayerId;

  async function run(action: GameAction) {
    setBusy(true);
    await sendAction(action);
    setBusy(false);
  }

  if (proposal && isResponder) {
    return (
      <div className={`${styles.secretPanel} ${board.rainbowBorderActive}`}>
        <h2 className={styles.secretPanelTitle}>단일화 제안 수신</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '20px 0', background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>사퇴 (내 후보)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-danger)' }}>{candidateName(proposal.withdrawCandidateId)}</div>
          </div>
          <div className={styles.unificationArrow}>➡️</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>흡수 (상대 대표)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{candidateName(proposal.leadCandidateId)}</div>
          </div>
        </div>
        <p className={styles.hint} style={{ textAlign: 'center', fontSize: '0.95rem' }}>
          이전 비율 {Math.round(proposal.ratio * 100)}% · 예상 이전 표 <strong style={{ color: 'var(--text-main)' }}>{proposal.transferVotes}</strong>
        </p>
        {proposal.terms.length > 0 && (
          <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid var(--accent-secondary)', padding: '12px', borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
            <strong style={{ color: 'var(--accent-secondary)' }}>🤝 공개 조건:</strong> {proposal.terms.map((t) => (t.kind === 'moneyTransfer' ? `당선 시 자금 💰${t.amount} 지급` : t.kind)).join(', ')}<br/>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(대표 후보 당선 시에만 자동 이행, 낙선하면 무효)</span>
          </div>
        )}
        <div className={styles.actionsRow} style={{ justifyContent: 'center', marginTop: '20px' }}>
          <button className={board.button} disabled={busy} onClick={() => run({ type: 'acceptUnification', actor: myPlayerId })}>
            제안 수락
          </button>
          <button
            className={board.buttonGhost}
            disabled={busy}
            onClick={() => run({ type: 'declineUnification', actor: myPlayerId })}
          >
            거절
          </button>
        </div>
      </div>
    );
  }

  if (proposal) {
    return (
      <div className={styles.secretPanel}>
        <h2 className={styles.secretPanelTitle}>단일화 테이블</h2>
        <p className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⏳ {isProposer
            ? `${candidateName(proposal.withdrawCandidateId)} 측의 결단을 기다리는 중…`
            : `${candidateName(proposal.withdrawCandidateId)} ➡️ ${candidateName(proposal.leadCandidateId)} 단일화 협상 진행 중…`}
        </p>
        {isEligible && (
          <button className={board.buttonGhost} style={{ marginTop: '16px' }} disabled={busy} onClick={() => run({ type: 'skipUnification', actor: myPlayerId })}>
            내 단일화 기회 넘기기
          </button>
        )}
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className={styles.secretPanel}>
        <h2 className={styles.secretPanelTitle}>단일화 테이블</h2>
        <p className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          👁️ 다른 브로커들의 단일화 눈치싸움을 지켜보는 중…
        </p>
      </div>
    );
  }

  const withdrawOptions = round.candidatesRunning.filter((id) => id !== leadCandidateId);

  return (
    <div className={`${styles.secretPanel} ${board.rainbowBorderActive}`}>
      <h2 className={styles.secretPanelTitle}>단일화 제안하기</h2>
      
      <div style={{ marginTop: '16px' }}>
        <span className={styles.actionLabel}>대표로 남길 내 후보</span>
        <div className={styles.selectableRow}>
          {myCandidates.map((id) => (
            <div
              key={id}
              className={`${styles.selectableCard} ${leadCandidateId === id ? styles.selectableCardActive : ''}`}
              onClick={() => { setLeadCandidateId(id); setWithdrawCandidateId(''); }}
            >
              {candidateName(id)}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '16px' }}>
        <span className={styles.actionLabel}>사퇴를 제안할 후보</span>
        {leadCandidateId ? (
          <div className={styles.selectableRow}>
            {withdrawOptions.map((id) => (
              <div
                key={id}
                className={`${styles.selectableCard} ${withdrawCandidateId === id ? styles.selectableCardActive : ''}`}
                style={{ borderColor: withdrawCandidateId === id ? 'var(--accent-danger)' : undefined }}
                onClick={() => setWithdrawCandidateId(id)}
              >
                {candidateName(id)}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.hint}>대표 후보를 먼저 선택해주세요.</p>
        )}
      </div>

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
        <span className={styles.actionLabel}>
          공개 조건 (옵션) <span className={styles.hint}>— 당선 시 자동 지급</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>💰</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            placeholder="자금 수량"
            value={moneyTerm}
            onChange={(e) => setMoneyTerm(e.target.value)}
            style={{ width: '150px' }}
          />
        </div>
      </div>

      <div className={styles.actionsRow} style={{ marginTop: '24px' }}>
        <button
          className={board.button}
          disabled={busy || !leadCandidateId || !withdrawCandidateId}
          onClick={() => {
            if (!leadCandidateId || !withdrawCandidateId) return;
            const amount = Number(moneyTerm);
            const terms = amount > 0 ? [{ kind: 'moneyTransfer' as const, amount }] : [];
            run({ type: 'proposeUnification', actor: myPlayerId, leadCandidateId, withdrawCandidateId, terms });
          }}
        >
          제안서 건네기
        </button>
        <button className={board.buttonGhost} disabled={busy} onClick={() => run({ type: 'skipUnification', actor: myPlayerId })}>
          지금은 넘기기
        </button>
      </div>
    </div>
  );
}
