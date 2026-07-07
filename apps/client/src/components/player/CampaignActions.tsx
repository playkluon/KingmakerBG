// 기반 스킬: skills/client-player/SKILL.md
// 캠페인 액션 버튼 + 대상 선택, 남은 액션 수(2개) 표시 (§11)
// useEvent는 별도 EventHand 컴포넌트가 담당한다. poll은 부록 A-18로 활성화되어 여기 포함된다.
import { useState } from 'react';
import { CAMPAIGN_ACTIONS_PER_PLAYER, CAMPAIGN_ACTION_COSTS, POLICY_TRACKS, POLL_ENABLED } from '@kingmakers/engine';
import type {
  CampaignActionCost,
  CandidateId,
  GameAction,
  GameState,
  PlayerId,
  PolicyDirection,
  PolicyTrackId,
  VoterId,
} from '@kingmakers/engine';
import { useGameStore } from '../../store/gameStore';
import { candidateName, TRACK_LABELS, voterById } from '../../lib/cards';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface CampaignActionsProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function costLabel(cost: CampaignActionCost): string {
  const parts: string[] = [];
  if (cost.money) parts.push(`자금 ${cost.money}`);
  if (cost.organization) parts.push(`조직 ${cost.organization}`);
  if (cost.reputation) parts.push(`평판 ${cost.reputation}`);
  return parts.length > 0 ? parts.join(' · ') : '무료';
}

export function CampaignActions({ state, myPlayerId }: CampaignActionsProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const [busy, setBusy] = useState(false);

  const isMyTurn = state.round.campaignTurnOrder[state.round.campaignActiveIndex] === myPlayerId;
  const used = state.round.campaignActionsUsed[myPlayerId] ?? 0;
  const remaining = CAMPAIGN_ACTIONS_PER_PLAYER - used;
  const candidates = state.round.candidatesRunning;

  async function run(action: GameAction) {
    setBusy(true);
    await sendAction(action);
    setBusy(false);
  }

  if (!isMyTurn) {
    const currentId = state.round.campaignTurnOrder[state.round.campaignActiveIndex];
    const currentName = state.players.find((p) => p.id === currentId)?.name ?? '알 수 없음';
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>캠페인 액션</h2>
        <p className={styles.hint}>
          {currentName} 님의 차례를 기다리는 중… (내 남은 액션 {remaining}/{CAMPAIGN_ACTIONS_PER_PLAYER})
        </p>
      </div>
    );
  }

  return (
    <div className={`${board.section} ${board.rainbowBorderActive}`}>
      <h2 className={board.sectionTitle}>
        캠페인 액션 — 남은 횟수 {remaining}/{CAMPAIGN_ACTIONS_PER_PLAYER}
      </h2>

      <div className={styles.actionRow}>
        <span className={styles.actionLabel}>자금 모금 ({costLabel(CAMPAIGN_ACTION_COSTS.fundraise)})</span>
        <button className={board.button} disabled={busy} onClick={() => run({ type: 'fundraise', actor: myPlayerId })}>
          실행
        </button>
      </div>

      <div className={board.section} style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px dashed var(--accent-primary)', textAlign: 'center', padding: '20px' }}>
        <p className={styles.hint} style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}>
          👇 중앙 보드판에서 대상(후보자 또는 유권자) 카드를 직접 클릭하여 캠페인 액션을 진행하세요.
        </p>
      </div>

      <PressurePolicyAction
        cost={costLabel(CAMPAIGN_ACTION_COSTS.pressurePolicy)}
        disabled={busy}
        onRun={(track, direction) => run({ type: 'pressurePolicy', actor: myPlayerId, track, direction })}
      />

      {POLL_ENABLED && (
        <div className={styles.actionRow}>
          <span className={styles.actionLabel}>
            여론조사 <span className={styles.hint}>({costLabel(CAMPAIGN_ACTION_COSTS.poll)}, 결과는 전원에게 공개)</span>
          </span>
          <button className={board.button} disabled={busy} onClick={() => run({ type: 'poll', actor: myPlayerId })}>
            실행
          </button>
        </div>
      )}
    </div>
  );
}

function PressurePolicyAction({
  cost,
  disabled,
  onRun,
}: {
  cost: string;
  disabled: boolean;
  onRun: (track: PolicyTrackId, direction: PolicyDirection) => void;
}) {
  const [track, setTrack] = useState<PolicyTrackId>(POLICY_TRACKS[0]!);
  const [direction, setDirection] = useState<PolicyDirection>(1);
  return (
    <div className={styles.actionRow}>
      <span className={styles.actionLabel}>
        정책 압박 <span className={styles.hint}>({cost})</span>
      </span>
      <select className={styles.select} value={track} onChange={(e) => setTrack(e.target.value as PolicyTrackId)}>
        {POLICY_TRACKS.map((t) => (
          <option key={t} value={t}>
            {TRACK_LABELS[t].name}
          </option>
        ))}
      </select>
      <select className={styles.select} value={direction} onChange={(e) => setDirection(Number(e.target.value) as PolicyDirection)}>
        <option value={1}>{TRACK_LABELS[track].plus} 방향</option>
        <option value={-1}>{TRACK_LABELS[track].minus} 방향</option>
      </select>
      <button className={board.button} disabled={disabled} onClick={() => onRun(track, direction)}>
        실행
      </button>
    </div>
  );
}
