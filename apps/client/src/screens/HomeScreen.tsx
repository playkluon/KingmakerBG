// 기반 스킬: skills/client-lobby-table/SKILL.md
// 첫 화면 — 마케팅 페이지가 아니라 방 생성/입장 화면이어야 한다 (§22)
// 부록 A-22: 초대 코드 입장은 유지하되, 공개방은 방 목록에서 코드 없이도 찾을 수 있다
import { useEffect, useState } from 'react';
import { navigate } from '../lib/router';
import { useGameStore, type RoomVisibility } from '../store/gameStore';
import board from '../components/board/board.module.css';
import styles from './screens.module.css';

export function HomeScreen() {
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const publicRooms = useGameStore((s) => s.publicRooms);
  const refreshRoomList = useGameStore((s) => s.refreshRoomList);
  const lastError = useGameStore((s) => s.lastError);
  const clearError = useGameStore((s) => s.clearError);

  const [hostName, setHostName] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [hostJoinsAsPlayer, setHostJoinsAsPlayer] = useState(false);
  const [aiPlayerCount, setAiPlayerCount] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    void refreshRoomList().finally(() => setListLoading(false));
  }, [refreshRoomList]);

  async function handleCreate() {
    if (!hostName.trim() || busy) return;
    setBusy(true);
    clearError();
    const res = await createRoom(hostName.trim(), { visibility, hostJoinsAsPlayer, aiPlayerCount });
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

  async function handleRefreshList() {
    setListLoading(true);
    await refreshRoomList();
    setListLoading(false);
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
          <div className={styles.visibilityRow}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
              />
              공개방 (방 목록에 노출)
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              비공개방 (초대 코드로만 입장)
            </label>
          </div>
          <label className={styles.radioLabel}>
            <input
              type="checkbox"
              checked={hostJoinsAsPlayer}
              onChange={(e) => setHostJoinsAsPlayer(e.target.checked)}
            />
            저도 플레이어로 참가할게요
          </label>
          <label className={styles.fieldLabel}>
            AI 참가자
            <select
              className={styles.select}
              value={aiPlayerCount}
              onChange={(e) => setAiPlayerCount(Number(e.target.value))}
            >
              {Array.from({ length: hostJoinsAsPlayer ? 7 : 8 }, (_, count) => (
                <option key={count} value={count}>
                  {count}명
                </option>
              ))}
            </select>
          </label>
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

      <section className={`${styles.panel} ${styles.wide}`}>
        <div className={styles.roomListHeader}>
          <h2 className={styles.panelTitle}>공개방 목록</h2>
          <button className={board.buttonGhost} onClick={handleRefreshList} disabled={listLoading}>
            새로고침
          </button>
        </div>
        {listLoading && <p className={styles.hint}>불러오는 중…</p>}
        {!listLoading && publicRooms.length === 0 && <p className={styles.hint}>열려 있는 공개방이 없습니다</p>}
        <div className={styles.participantList}>
          {publicRooms.map((room) => (
            <div key={room.id} className={styles.participantRow}>
              <span>
                {room.hostName}님의 방 · 인원 {room.playerCount}/{room.maxPlayers} · 관전 {room.spectatorCount}/{room.maxSpectators}
              </span>
              <span className={styles.roomListActions}>
                <span className={room.status === 'waiting' ? styles.hint : styles.readyBadgeOn}>
                  {room.status === 'waiting' ? '대기 중' : '진행 중'}
                </span>
                <button className={board.buttonGhost} onClick={() => navigate(`/room/${room.id}`)}>
                  입장
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
