// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-16)
// 비밀 pact — 받은 제안 수락/거절, 내가 보낸 제안 대기 표시, 활성 pact 목록, 새 제안 폼.
// state.round.pendingSecretPactProposals/activeSecretPacts는 서버가 이미 당사자 것만 남기고 마스킹해 보낸다.
import { useState } from 'react';
import type { CandidateId, GameState, PlayerId } from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface SecretPactPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function SecretPactPanel({ state, myPlayerId }: SecretPactPanelProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busy, setBusy] = useState(false);
  const [counterparty, setCounterparty] = useState<PlayerId | ''>('');
  const [candidateId, setCandidateId] = useState<CandidateId | ''>('');

  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? id;
  const incoming = state.round.pendingSecretPactProposals.filter((p) => p.counterparty === myPlayerId);
  const outgoing = state.round.pendingSecretPactProposals.filter((p) => p.proposer === myPlayerId);
  const myActivePacts = state.round.activeSecretPacts.filter((p) => p.proposer === myPlayerId || p.counterparty === myPlayerId);
  const otherPlayers = state.players.filter((p) => p.id !== myPlayerId);

  async function respond(proposer: PlayerId, accept: boolean) {
    setBusy(true);
    await sendAction({ type: accept ? 'acceptSecretPact' : 'declineSecretPact', actor: myPlayerId, proposer });
    setBusy(false);
  }

  async function propose() {
    if (!counterparty || !candidateId) return;
    setBusy(true);
    await sendAction({
      type: 'proposeSecretPact',
      actor: myPlayerId,
      counterparty,
      promise: { kind: 'supportCandidate', candidateId },
    });
    setBusy(false);
    setCounterparty('');
    setCandidateId('');
  }

  return (
    <div className={styles.secretPanel}>
      <h2 className={styles.secretPanelTitle}>
        비밀 밀약 <span className={board.hint}>(당사자만 볼 수 있음)</span>
      </h2>

      {incoming.map((p) => (
        <div key={p.proposer} className={board.section} style={{ border: '1px solid var(--accent-warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <span className={styles.actionLabel}>
            ✉️ <strong>{nameOf(p.proposer)}</strong> 님의 은밀한 제안:<br/>
            <span style={{ color: 'var(--accent-warning)' }}>{candidateName(p.promise.candidateId)}</span> 지지 약속
          </span>
          <div className={styles.actionsRow}>
            <button className={board.button} disabled={busy} onClick={() => respond(p.proposer, true)}>
              수락
            </button>
            <button className={board.buttonGhost} disabled={busy} onClick={() => respond(p.proposer, false)}>
              거절
            </button>
          </div>
        </div>
      ))}

      {outgoing.map((p) => (
        <p key={p.counterparty} className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⏳ {nameOf(p.counterparty)} 님에게 보낸 밀서 대기 중 ({candidateName(p.promise.candidateId)} 지지)
        </p>
      ))}

      {myActivePacts.map((p, i) => (
        <p key={i} className={styles.hint} style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📜 {p.proposer === myPlayerId
            ? `${nameOf(p.counterparty)} 님과의 밀약 성사: ${candidateName(p.promise.candidateId)}를(을) 지지하기로 함`
            : `${nameOf(p.proposer)} 님이 ${candidateName(p.promise.candidateId)} 지지를 약속함`}
        </p>
      ))}

      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
        <span className={styles.actionLabel}>상대 브로커 선택</span>
        <div className={styles.selectableRow}>
          {otherPlayers.map((p) => (
            <div
              key={p.id}
              className={`${styles.avatarBadge} ${counterparty === p.id ? styles.avatarBadgeActive : ''}`}
              onClick={() => setCounterparty(p.id)}
            >
              {p.name}
            </div>
          ))}
        </div>

        <span className={styles.actionLabel} style={{ marginTop: '16px', display: 'block' }}>내가 지지할 후보</span>
        <div className={styles.selectableRow}>
          {state.round.candidatesRunning.map((id) => (
            <div
              key={id}
              className={`${styles.selectableCard} ${candidateId === id ? styles.selectableCardActive : ''}`}
              onClick={() => setCandidateId(id)}
            >
              {candidateName(id)}
            </div>
          ))}
        </div>
        
        <div className={styles.actionsRow}>
          <button className={board.button} disabled={busy || !counterparty || !candidateId} onClick={propose}>
            밀서 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
