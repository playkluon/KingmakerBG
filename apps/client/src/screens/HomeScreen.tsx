// 기반 스킬: skills/client-lobby-table/SKILL.md
// 첫 화면 — 마케팅 페이지가 아니라 방 생성/입장 화면이어야 한다 (§22)
import { useState } from 'react';
import { navigate } from '../lib/router';
import { useGameStore } from '../store/gameStore';
import board from '../components/board/board.module.css';
import styles from './screens.module.css';

export function HomeScreen() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!hostName.trim() || busy) return;
    setBusy(true);
    clearError();
    const res = await createRoom(hostName.trim());
    setBusy(false);
    if (res.ok && res.roomId) navigate(`/room/${res.roomId}`);
  }

  async function handleJoin() {
    const roomId = joinCode.trim();
    if (!roomId || !joinName.trim() || busy) return;
    setBusy(true);
    clearError();
    const res = await joinRoom(roomId, joinName.trim());
    setBusy(false);
    if (res.ok) navigate(`/room/${roomId}`);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>킹메이커스: 민심 경매</h1>
      <p className={styles.subtitle}>정치 브로커 온라인 보드게임</p>

      {lastError && <p className={styles.error}>{lastError}</p>}

      <div className={styles.panels}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>방 만들기</h2>
          <input
            className={styles.input}
            placeholder="호스트 이름"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button className={board.button} disabled={!hostName.trim() || busy} onClick={handleCreate}>
            방 만들기
          </button>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>초대 코드로 입장</h2>
          <input
            className={styles.input}
            placeholder="방 코드"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="내 이름"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            className={board.button}
            disabled={!joinCode.trim() || !joinName.trim() || busy}
            onClick={handleJoin}
          >
            입장하기
          </button>
        </section>
      </div>
    </main>
  );
}
