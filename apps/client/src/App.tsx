// 기반 스킬: skills/client-lobby-table/SKILL.md, skills/client-player/SKILL.md
// 앱 루트 — 첫 화면은 마케팅 페이지가 아니라 실제 플레이 테이블로 이어지는 진입점이어야 한다 (§22)
import { navigate, useRoute } from './lib/router';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SpectatorScreen } from './screens/SpectatorScreen';
import { TableScreen } from './screens/TableScreen';
import { useGameStore } from './store/gameStore';
import board from './components/board/board.module.css';
import styles from './App.module.css';

function IdleWarningModal() {
  const showIdleWarning = useGameStore((s) => s.showIdleWarning);
  const sendKeepAlive = useGameStore((s) => s.sendKeepAlive);

  if (!showIdleWarning) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111', padding: '2.5rem', borderRadius: '16px', textAlign: 'center', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <h2 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>장시간 활동이 없습니다</h2>
        <p style={{ color: '#aaa', marginBottom: '2rem', fontSize: '1rem' }}>응답이 없으면 방이 곧 삭제됩니다. 연장하시겠습니까?</p>
        <button className={board.buttonPrimary} style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }} onClick={() => sendKeepAlive()}>
          연장하기
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();

  let content;
  switch (route.screen) {
    case 'home':
      content = <HomeScreen />;
      break;
    case 'room-entry':
      content = <LobbyScreen roomId={route.roomId!} />;
      break;
    case 'table':
      content = <TableScreen roomId={route.roomId!} />;
      break;
    case 'play':
      content = <PlayerScreen roomId={route.roomId!} />;
      break;
    case 'watch':
      content = <SpectatorScreen roomId={route.roomId!} />;
      break;
    default:
      content = (
        <main className={styles.root}>
          <h1 className={styles.title}>페이지를 찾을 수 없습니다</h1>
          <button className={board.buttonGhost} onClick={() => navigate('/')}>
            홈으로
          </button>
        </main>
      );
  }

  return (
    <>
      {content}
      <IdleWarningModal />
    </>
  );
}
