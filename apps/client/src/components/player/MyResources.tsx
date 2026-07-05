// 기반 스킬: skills/client-player/SKILL.md
// money/org/rep/VP + 이번 라운드 변화량
import { useEffect, useRef, useState } from 'react';
import type { GameState, PlayerId } from '@kingmakers/engine';
import styles from './player.module.css';

interface MyResourcesProps {
  state: GameState;
  myPlayerId: PlayerId;
}

interface Snapshot {
  money: number;
  organization: number;
  reputation: number;
  victoryPoints: number;
}

function deltaLabel(delta: number): string {
  if (delta === 0) return '';
  return delta > 0 ? ` (+${delta})` : ` (${delta})`;
}

/**
 * "이번 라운드 변화량"은 서버가 델타를 내려주지 않으므로,
 * 라운드가 바뀔 때마다 그 시점의 값을 클라이언트가 직접 스냅샷으로 기억해 두고 비교한다 —
 * 룰 계산이 아니라 이미 받은 공개 값을 그대로 저장/비교하는 화면 표시 로직이다.
 */
export function MyResources({ state, myPlayerId }: MyResourcesProps) {
  const me = state.players.find((p) => p.id === myPlayerId);
  const [roundStartSnapshot, setRoundStartSnapshot] = useState<Snapshot | null>(null);
  const lastRound = useRef<number | null>(null);

  useEffect(() => {
    if (!me) return;
    if (lastRound.current !== state.round.round) {
      lastRound.current = state.round.round;
      setRoundStartSnapshot({
        money: me.money,
        organization: me.organization,
        reputation: me.reputation,
        victoryPoints: me.victoryPoints,
      });
    }
  }, [state.round.round, me]);

  if (!me) return null;
  const base = roundStartSnapshot ?? me;

  return (
    <div className={styles.resourceGrid}>
      <ResourceItem label="자금" value={me.money} delta={me.money - base.money} />
      <ResourceItem label="조직력" value={me.organization} delta={me.organization - base.organization} />
      <ResourceItem label="평판" value={me.reputation} delta={me.reputation - base.reputation} />
      <ResourceItem label="VP" value={me.victoryPoints} delta={me.victoryPoints - base.victoryPoints} />
    </div>
  );
}

function ResourceItem({ label, value, delta }: { label: string; value: number; delta: number }) {
  return (
    <div className={styles.resourceItem}>
      <div className={styles.resourceLabel}>{label}</div>
      <div className={styles.resourceValue}>
        {value}
        <span className={delta >= 0 ? styles.resourceDeltaUp : styles.resourceDeltaDown}>{deltaLabel(delta)}</span>
      </div>
    </div>
  );
}
