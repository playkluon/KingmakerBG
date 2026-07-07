// 기반 스킬: skills/client-player/SKILL.md
// /room/:id/play — 공용 보드 축약 + 내 전용 패널 (§21 "자기 좌석 개인 화면")
// 부록 A-22: 호스트가 참가자를 겸하면 이 화면에서 플레이하면서도 방 관리 도구(수동 진행)를 함께 쓸 수 있어야 한다
import { useEffect, useState } from 'react';
import { getPendingDecision } from '@kingmakers/engine';
import { navigate } from '../lib/router';
import { useGameStore } from '../store/gameStore';
import { ActionLog } from '../components/board/ActionLog';
import { CandidateBoard } from '../components/board/CandidateBoard';
import { EffectToast } from '../components/board/EffectToast';
import { FinalResults } from '../components/board/FinalResults';
import { OnboardingHints } from '../components/board/OnboardingHints';
import { PhaseHeader } from '../components/board/PhaseHeader';
import { PlayerPanels } from '../components/board/PlayerPanels';
import { PolicyTracks } from '../components/board/PolicyTracks';
import { RoundGoals } from '../components/board/RoundGoals';
import { RoundSummary } from '../components/board/RoundSummary';
import { VoterBoard } from '../components/board/VoterBoard';
import { ActionPanel } from '../components/player/ActionPanel';
import { MyResources } from '../components/player/MyResources';
import { ScoreRoute } from '../components/player/ScoreRoute';
import { SecretAgenda } from '../components/player/SecretAgenda';
import { TodoBanner } from '../components/player/TodoBanner';
import board from '../components/board/board.module.css';
import styles from './screens.module.css';

interface PlayerScreenProps {
  roomId: string;
}

type PlayerMobileTab = 'me' | 'candidates' | 'voters' | 'policy' | 'log';

const PLAYER_MOBILE_TABS: Array<{ key: PlayerMobileTab; label: string }> = [
  { key: 'me', label: '내 정보' },
  { key: 'candidates', label: '후보' },
  { key: 'voters', label: '유권자' },
  { key: 'policy', label: '정책' },
  { key: 'log', label: '로그' },
];

export function PlayerScreen({ roomId }: PlayerScreenProps) {
  const role = useGameStore((s) => s.role);
  const isHost = useGameStore((s) => s.isHost);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const roomState = useGameStore((s) => s.roomState);
  const view = useGameStore((s) => s.view);
  const attach = useGameStore((s) => s.attach);
  const sendAction = useGameStore((s) => s.sendAction);
  const lastError = useGameStore((s) => s.lastError);

  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [mobileTab, setMobileTab] = useState<PlayerMobileTab>('me');

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
        <button className={board.buttonGhost} onClick={() => navigate('/')}>
          홈으로
        </button>
      </main>
    );
  }

  const pending = getPendingDecision(view);
  const locked = pending !== null && pending.actors.length > 0;

  async function handleAdvance() {
    setAdvancing(true);
    await sendAction({ type: 'runUntilPlayerAction' });
    setAdvancing(false);
  }

  return (
    <main className={styles.playPage}>
      <EffectToast state={view} />
      <RoundSummary state={view} />
        <div className={styles.desktopPlayLayout}>
          {/* 좌측 1패널: 기본 상태 및 리소스, 점수 루트 */}
          <div className={styles.playColumn}>
            <PhaseHeader state={view} />
            <TodoBanner state={view} myPlayerId={myPlayerId} />
            <RoundGoals state={view} />
            {isHost && (
              <div className={board.section}>
                <button
                  className={board.buttonGhost}
                  disabled={locked || advancing || view.phase === 'gameEnd'}
                  onClick={handleAdvance}
                >
                  {advancing ? '진행 중…' : '호스트 도구: 진행'}
                </button>
                {locked && <span className={styles.hint}> 플레이어 결정을 기다리는 중에는 진행할 수 없습니다</span>}
              </div>
            )}
            <MyResources state={view} myPlayerId={myPlayerId} />
            <SecretAgenda state={view} myPlayerId={myPlayerId} />
            <ScoreRoute state={view} myPlayerId={myPlayerId} />
          </div>

          {/* 좌측 2패널: 액션 패널 (캠페인, 이벤트, 밀약) */}
          <div className={styles.playColumn}>
            <ActionPanel state={view} myPlayerId={myPlayerId} />
          </div>

          {/* 중앙 패널: 메인 보드 */}
          <div className={styles.playColumn}>
            <CandidateBoard state={view} myPlayerId={myPlayerId} />
            <VoterBoard state={view} myPlayerId={myPlayerId} />
            <PolicyTracks state={view} />
          </div>

          {/* 우측 패널: 상대방 및 로그 */}
          <div className={styles.playColumn}>
            <FinalResults state={view} />
            <PlayerPanels state={view} myPlayerId={myPlayerId} />
            <ActionLog state={view} />
            <OnboardingHints phase={view.phase} />
          </div>
        </div>

        <div className={styles.mobilePlayLayout}>
          <PhaseHeader state={view} />
          <TodoBanner state={view} myPlayerId={myPlayerId} />
          <MyResources state={view} myPlayerId={myPlayerId} />



          {isHost && (
            <div className={board.section}>
              <button
                className={board.buttonGhost}
                disabled={locked || advancing || view.phase === 'gameEnd'}
                onClick={handleAdvance}
              >
                {advancing ? '진행 중…' : '호스트 도구: 진행'}
              </button>
              {locked && <span className={styles.hint}> 플레이어 결정을 기다리는 중에는 진행할 수 없습니다</span>}
            </div>
          )}

          <div className={styles.mobileTabBar} role="tablist" aria-label="게임 정보">
            {PLAYER_MOBILE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={mobileTab === tab.key}
                className={styles.mobileTab}
                onClick={() => setMobileTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.mobileTabPanel}>
            {mobileTab === 'me' && (
              <>
                <ActionPanel state={view} myPlayerId={myPlayerId} />
                <RoundGoals state={view} />
                <FinalResults state={view} />
                <SecretAgenda state={view} myPlayerId={myPlayerId} />
                <ScoreRoute state={view} myPlayerId={myPlayerId} />
                <PlayerPanels state={view} myPlayerId={myPlayerId} />
                <OnboardingHints phase={view.phase} />
              </>
            )}
            {mobileTab === 'candidates' && <CandidateBoard state={view} myPlayerId={myPlayerId} />}
            {mobileTab === 'voters' && <VoterBoard state={view} myPlayerId={myPlayerId} />}
            {mobileTab === 'policy' && <PolicyTracks state={view} />}
            {mobileTab === 'log' && <ActionLog state={view} />}
          </div>
        </div>
    </main>
  );
}
