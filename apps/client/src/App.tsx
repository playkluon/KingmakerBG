// 기반 스킬: skills/setup/SKILL.md
// Phase 0 앱 루트 — 서버 연결 상태만 표시한다.
// 홈/로비/테이블/플레이어 화면은 Phase 4(skills/client-lobby-table, client-player)에서 추가된다.
import { useEffect, useState } from 'react';
import { SCHEMA_VERSION } from '@kingmakers/engine';
import { createSocket } from './socket/connection';
import styles from './App.module.css';

/** 앱 루트 컴포넌트 — 서버 Socket.IO 연결 상태를 표시한다 */
export default function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 마운트 시 소켓 연결, 언마운트 시 해제
    const socket = createSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className={styles.root}>
      <h1 className={styles.title}>킹메이커스: 민심 경매</h1>
      <p className={styles.subtitle}>정치 브로커 보드게임 — 개발 빌드 (스키마 {SCHEMA_VERSION})</p>
      <p className={connected ? styles.ok : styles.waiting}>
        {connected ? '● 서버 연결됨' : '○ 서버 연결 대기 중…'}
      </p>
    </main>
  );
}
