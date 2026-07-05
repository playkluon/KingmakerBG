// 기반 스킬: skills/client-lobby-table/SKILL.md
// 참가자 목록 + ready 상태 + 호스트 시작 버튼만 보여준다 (§21) — 인게임 보드는 여기서 그리지 않는다
import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useGameStore } from '../store/gameStore';
import board from '../components/board/board.module.css';
import styles from './screens.module.css';

interface LobbyScreenProps {
  roomId: string;
}

/** `/room/:id` — 시작 전 로비. 시작되면 역할별로 자동 리다이렉트한다 */
export function LobbyScreen({ roomId }: LobbyScreenProps) {
  const roomState = useGameStore((s) => s.roomState);
  const role = useGameStore((s) => s.role);
  const myName = useGameStore((s) => s.myName);
  const attach = useGameStore((s) => s.attach);
  const setReady = useGameStore((s) => s.setReady);
  const startGame = useGameStore((s) => s.startGame);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (!roomState || roomState.status !== 'playing') return;
    if (role === 'player') navigate(`/room/${roomId}/play`);
    else if (role === 'host') navigate(`/room/${roomId}/table`);
    else navigate(`/room/${roomId}/watch`);
  }, [roomState, role, roomId]);

  async function handleJoin() {
    if (!joinName.trim() || busy) return;
    setBusy(true);
    clearError();
    const res = await joinRoom(roomId, joinName.trim());
    if (res.ok) await attach(roomId);
    setBusy(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 API를 쓸 수 없는 환경 — 코드가 이미 화면에 보이므로 조용히 무시한다
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.subtitle}>방을 불러오는 중…</p>
      </main>
    );
  }

  if (!roomState) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{lastError ?? '존재하지 않는 방입니다'}</p>
        <button className={board.buttonGhost} onClick={() => navigate('/')}>
          홈으로
        </button>
      </main>
    );
  }

  // 아직 참가하지 않은 방문자(토큰 없음) — 시작 전이면 이름을 입력해 참가할 수 있다
  if (role === 'spectator' && roomState.status === 'waiting') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{roomState.hostName}님의 방</h1>
        {lastError && <p className={styles.error}>{lastError}</p>}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>이름을 입력하고 입장하세요</h2>
          <input
            className={styles.input}
            placeholder="내 이름"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button className={board.button} disabled={!joinName.trim() || busy} onClick={handleJoin}>
            입장하기
          </button>
        </section>
      </main>
    );
  }

  const isHost = role === 'host';
  const me = !isHost ? roomState.players.find((p) => p.name === myName) : null;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{roomState.hostName}님의 방</h1>
      <p className={styles.hint}>
        초대 코드 <span className={styles.code}>{roomId}</span>{' '}
        <button className={board.buttonGhost} onClick={handleCopy}>
          {copied ? '복사됨' : '링크 복사'}
        </button>
      </p>

      {lastError && <p className={styles.error}>{lastError}</p>}

      <div className={`${styles.panel} ${styles.wide}`}>
        <h2 className={styles.panelTitle}>
          참가자 ({roomState.players.length}/{roomState.maxPlayers})
        </h2>
        <div className={styles.participantList}>
          {roomState.players.length === 0 && <p className={styles.hint}>아직 참가자가 없습니다</p>}
          {roomState.players.map((p) => (
            <div key={p.name} className={styles.participantRow}>
              <span>{p.name}</span>
              <span className={p.ready ? `${styles.readyBadge} ${styles.readyBadgeOn}` : styles.readyBadge}>
                {p.ready ? '준비 완료' : '준비 중'}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.actionsRow}>
          {!isHost && (
            <button className={board.button} onClick={() => setReady(!(me?.ready ?? false))}>
              {me?.ready ? '준비 취소' : '준비 완료'}
            </button>
          )}
          {isHost && (
            <button className={board.button} disabled={!roomState.canStart} onClick={() => startGame()}>
              게임 시작
            </button>
          )}
          {isHost && !roomState.canStart && (
            <span className={styles.hint}>
              {roomState.players.length < roomState.minPlayers
                ? `최소 ${roomState.minPlayers}명이 필요합니다`
                : '모두 준비될 때까지 기다리는 중'}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
