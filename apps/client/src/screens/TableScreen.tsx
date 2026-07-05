// 기반 스킬: skills/client-lobby-table/SKILL.md
// /room/:id/table — 공용 진행 화면. 호스트만 "진행" 버튼을 쓸 수 있다 (§21-8, §22)
import { useEffect, useState } from 'react';
import { getPendingDecision } from '@kingmakers/engine';
import { navigate } from '../lib/router';
import { useGameStore } from '../store/gameStore';
import { ActionLog } from '../components/board/ActionLog';
import { CandidateBoard } from '../components/board/CandidateBoard';
import { EffectToast } from '../components/board/EffectToast';
import { FinalResults } from '../components/board/FinalResults';
import { PhaseHeader } from '../components/board/PhaseHeader';
import { PlayerPanels } from '../components/board/PlayerPanels';
import { PolicyTracks } from '../components/board/PolicyTracks';
import { RoundGoals } from '../components/board/RoundGoals';
import { RoundSummary } from '../components/board/RoundSummary';
import { VoterBoard } from '../components/board/VoterBoard';
import board from '../components/board/board.module.css';
import styles from './screens.module.css';

interface TableScreenProps {
  roomId: string;
  /** SpectatorScreen이 이 컴포넌트를 재사용할 때 진행 버튼을 강제로 숨긴다 */
  forceReadOnly?: boolean;
}

/**
 * 공용 진행 화면 — 시스템 진행과 플레이어 액션 UI를 분리한다(§22).
 * 서버가 액션 직후 자동으로 진행 가능한 곳까지 이어서 처리하므로(부록 A-13)
 * 이 "진행" 버튼은 대부분 누를 필요가 없는 수동 재동기화/안전망이다.
 */
export function TableScreen({ roomId, forceReadOnly = false }: TableScreenProps) {
  const role = useGameStore((s) => s.role);
  const roomState = useGameStore((s) => s.roomState);
  const view = useGameStore((s) => s.view);
  const attach = useGameStore((s) => s.attach);
  const sendAction = useGameStore((s) => s.sendAction);
  const lastError = useGameStore((s) => s.lastError);

  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void attach(roomId).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId, attach]);

  useEffect(() => {
    if (!loading && roomState && roomState.status === 'waiting') navigate(`/room/${roomId}`);
  }, [loading, roomState, roomId]);

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.subtitle}>테이블을 불러오는 중…</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{lastError ?? '게임 상태를 불러올 수 없습니다'}</p>
      </main>
    );
  }

  const canControl = role === 'host' && !forceReadOnly;
  const pending = getPendingDecision(view);
  const locked = pending !== null && pending.actors.length > 0;

  async function handleAdvance() {
    setAdvancing(true);
    await sendAction({ type: 'runUntilPlayerAction' });
    setAdvancing(false);
  }

  return (
    <main className={styles.page}>
      <EffectToast state={view} />
      <RoundSummary state={view} />
      <div className={styles.wide}>
        <PhaseHeader state={view} />
        <RoundGoals state={view} />
        <FinalResults state={view} />

        {canControl && (
          <div className={board.section}>
            <button
              className={board.button}
              disabled={locked || advancing || view.phase === 'gameEnd'}
              onClick={handleAdvance}
            >
              {advancing ? '진행 중…' : '진행'}
            </button>
            {locked && <span className={styles.hint}> 플레이어 결정을 기다리는 중에는 진행할 수 없습니다</span>}
          </div>
        )}

        <PolicyTracks state={view} />
        <CandidateBoard state={view} />
        <VoterBoard state={view} />
        <PlayerPanels state={view} />
        <ActionLog state={view} />
      </div>
    </main>
  );
}
