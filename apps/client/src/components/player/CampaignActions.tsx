// 기반 스킬: skills/client-player/SKILL.md
// 캠페인 액션 버튼 + 대상 선택, 남은 액션 수(2개) 표시 (§11)
// poll/useEvent는 부록 A-4에 따라 아직 비활성이라 이 패널에 노출하지 않는다.
import { useState } from 'react';
import { CAMPAIGN_ACTIONS_PER_PLAYER, CAMPAIGN_ACTION_COSTS, POLICY_TRACKS } from '@kingmakers/engine';
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

function costLabel(cost: CampaignActionCost): string {
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
    <div className={board.section}>
      <h2 className={board.sectionTitle}>
        캠페인 액션 — 남은 횟수 {remaining}/{CAMPAIGN_ACTIONS_PER_PLAYER}
      </h2>

      <div className={styles.actionRow}>
        <span className={styles.actionLabel}>자금 모금 ({costLabel(CAMPAIGN_ACTION_COSTS.fundraise)})</span>
        <button className={board.button} disabled={busy} onClick={() => run({ type: 'fundraise', actor: myPlayerId })}>
          실행
        </button>
      </div>

      <VoterTargetAction
        label="유권자 접촉"
        cost={costLabel(CAMPAIGN_ACTION_COSTS.contactVoter)}
        voterIds={state.round.votersRevealed}
        disabled={busy}
        onRun={(voterId) => run({ type: 'contactVoter', actor: myPlayerId, voterId })}
      />

      <CandidateTargetAction
        label="광고"
        cost={costLabel(CAMPAIGN_ACTION_COSTS.runAd)}
        candidates={candidates}
        disabled={busy}
        onRun={(candidateId) => run({ type: 'runAd', actor: myPlayerId, candidateId })}
      />

      <CandidateTargetAction
        label="스캔들 폭로"
        cost={costLabel(CAMPAIGN_ACTION_COSTS.reportScandal)}
        candidates={candidates}
        disabled={busy}
        onRun={(candidateId) => run({ type: 'reportScandal', actor: myPlayerId, candidateId })}
      />

      <CandidateTargetAction
        label="조건부 지지"
        cost={costLabel(CAMPAIGN_ACTION_COSTS.conditionalSupport)}
        candidates={candidates}
        disabled={busy}
        onRun={(candidateId) => run({ type: 'conditionalSupport', actor: myPlayerId, candidateId })}
      />

      <PressurePolicyAction
        cost={costLabel(CAMPAIGN_ACTION_COSTS.pressurePolicy)}
        disabled={busy}
        onRun={(track, direction) => run({ type: 'pressurePolicy', actor: myPlayerId, track, direction })}
      />
    </div>
  );
}

function CandidateTargetAction({
  label,
  cost,
  candidates,
  disabled,
  onRun,
}: {
  label: string;
  cost: string;
  candidates: CandidateId[];
  disabled: boolean;
  onRun: (candidateId: CandidateId) => void;
}) {
  const [target, setTarget] = useState<CandidateId | ''>('');
  return (
    <div className={styles.actionRow}>
      <span className={styles.actionLabel}>
        {label} <span className={styles.hint}>({cost})</span>
      </span>
      <select className={styles.select} value={target} onChange={(e) => setTarget(e.target.value as CandidateId)}>
        <option value="">후보 선택</option>
        {candidates.map((id) => (
          <option key={id} value={id}>
            {candidateName(id)}
          </option>
        ))}
      </select>
      <button className={board.button} disabled={disabled || !target} onClick={() => target && onRun(target)}>
        실행
      </button>
    </div>
  );
}

function VoterTargetAction({
  label,
  cost,
  voterIds,
  disabled,
  onRun,
}: {
  label: string;
  cost: string;
  voterIds: VoterId[];
  disabled: boolean;
  onRun: (voterId: VoterId) => void;
}) {
  const [target, setTarget] = useState<VoterId | ''>('');
  return (
    <div className={styles.actionRow}>
      <span className={styles.actionLabel}>
        {label} <span className={styles.hint}>({cost})</span>
      </span>
      <select className={styles.select} value={target} onChange={(e) => setTarget(e.target.value as VoterId)}>
        <option value="">유권자 선택</option>
        {voterIds.map((id) => (
          <option key={id} value={id}>
            {voterById.get(id)?.name ?? id}
          </option>
        ))}
      </select>
      <button className={board.button} disabled={disabled || !target} onClick={() => target && onRun(target)}>
        실행
      </button>
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
