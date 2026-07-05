// 기반 스킬: skills/client-player/SKILL.md
// /room/:id/play — 공용 보드 축약 + 내 전용 패널 (§21 "자기 좌석 개인 화면")
import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useGameStore } from '../store/gameStore';
import { ActionLog } from '../components/board/ActionLog';
import { CandidateBoard } from '../components/board/CandidateBoard';
import { PhaseHeader } from '../components/board/PhaseHeader';
import { PlayerPanels } from '../components/board/PlayerPanels';
import { PolicyTracks } from '../components/board/PolicyTracks';
import { VoterBoard } from '../components/board/VoterBoard';
import { ActionPanel } from '../components/player/ActionPanel';
import { MyResources } from '../components/player/MyResources';
import { SecretAgenda } from '../components/player/SecretAgenda';
import { TodoBanner } from '../components/player/TodoBanner';
import styles from './screens.module.css';

interface PlayerScreenProps {
  roomId: string;
}

export function PlayerScreen({ roomId }: PlayerScreenProps) {
  const role = useGameStore((s) => s.role);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const roomState = useGameStore((s) => s.roomState);
  const view = useGameStore((s) => s.view);
  const attach = useGameStore((s) => s.attach);
  const lastError = useGameStore((s) => s.lastError);

  const [loading, setLoading] = useState(true);

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
    if (loading || !roomState) return;
    if (roomState.status === 'waiting') navigate(`/room/${roomId}`);
    else if (role === 'host') navigate(`/room/${roomId}/table`);
    else if (role === 'spectator') navigate(`/room/${roomId}/watch`);
  }, [loading, roomState, role, roomId]);

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.subtitle}>내 좌석을 불러오는 중…</p>
      </main>
    );
  }

  if (!view || !myPlayerId) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{lastError ?? '게임 상태를 불러올 수 없습니다'}</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.wide}>
        <PhaseHeader state={view} />
        <TodoBanner state={view} myPlayerId={myPlayerId} />
        <MyResources state={view} myPlayerId={myPlayerId} />
        <SecretAgenda state={view} myPlayerId={myPlayerId} />
        <ActionPanel state={view} myPlayerId={myPlayerId} />

        <PolicyTracks state={view} />
        <CandidateBoard state={view} />
        <VoterBoard state={view} />
        <PlayerPanels state={view} myPlayerId={myPlayerId} />
        <ActionLog state={view} />
      </div>
    </main>
  );
}
