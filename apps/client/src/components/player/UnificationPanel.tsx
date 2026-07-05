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
      <div className={board.section}>
        <h2 className={board.sectionTitle}>단일화 제안 수신</h2>
        <p>
          {candidateName(proposal.leadCandidateId)} 측이 {candidateName(proposal.withdrawCandidateId)}의 사퇴를
          제안했습니다.
        </p>
        <p className={styles.hint}>
          이전 비율 {Math.round(proposal.ratio * 100)}% · 예상 이전 표 {proposal.transferVotes}
        </p>
        <div className={styles.actionsRow}>
          <button className={board.button} disabled={busy} onClick={() => run({ type: 'acceptUnification', actor: myPlayerId })}>
            수락
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
      <div className={board.section}>
        <h2 className={board.sectionTitle}>단일화</h2>
        <p className={styles.hint}>
          {isProposer
            ? `${candidateName(proposal.withdrawCandidateId)} 측의 응답을 기다리는 중…`
            : `${candidateName(proposal.leadCandidateId)} → ${candidateName(proposal.withdrawCandidateId)} 제안에 대한 응답을 기다리는 중…`}
        </p>
        {isEligible && (
          <button className={board.buttonGhost} disabled={busy} onClick={() => run({ type: 'skipUnification', actor: myPlayerId })}>
            내 단일화 기회 넘기기
          </button>
        )}
      </div>
    );
  }

  if (!isEligible) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>단일화</h2>
        <p className={styles.hint}>다른 브로커의 단일화 진행을 기다리는 중…</p>
      </div>
    );
  }

  const withdrawOptions = round.candidatesRunning.filter((id) => id !== leadCandidateId);

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>단일화 제안하기</h2>
      <div className={styles.actionRow}>
        <span className={styles.actionLabel}>대표로 남길 내 후보</span>
        <select
          className={styles.select}
          value={leadCandidateId}
          onChange={(e) => setLeadCandidateId(e.target.value as CandidateId)}
        >
          <option value="">선택</option>
          {myCandidates.map((id) => (
            <option key={id} value={id}>
              {candidateName(id)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.actionRow}>
        <span className={styles.actionLabel}>사퇴를 제안할 후보</span>
        <select
          className={styles.select}
          value={withdrawCandidateId}
          disabled={!leadCandidateId}
          onChange={(e) => setWithdrawCandidateId(e.target.value as CandidateId)}
        >
          <option value="">선택</option>
          {withdrawOptions.map((id) => (
            <option key={id} value={id}>
              {candidateName(id)}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.hint}>이전 비율은 제안 즉시 서버가 계산해 상대에게 보여줍니다.</p>
      <div className={styles.actionsRow}>
        <button
          className={board.button}
          disabled={busy || !leadCandidateId || !withdrawCandidateId}
          onClick={() =>
            leadCandidateId &&
            withdrawCandidateId &&
            run({ type: 'proposeUnification', actor: myPlayerId, leadCandidateId, withdrawCandidateId })
          }
        >
          제안하기
        </button>
        <button className={board.buttonGhost} disabled={busy} onClick={() => run({ type: 'skipUnification', actor: myPlayerId })}>
          넘기기
        </button>
      </div>
    </div>
  );
}
