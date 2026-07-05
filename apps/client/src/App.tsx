// 기반 스킬: skills/client-lobby-table/SKILL.md, skills/client-player/SKILL.md
// 앱 루트 — 첫 화면은 마케팅 페이지가 아니라 실제 플레이 테이블로 이어지는 진입점이어야 한다 (§22)
import { navigate, useRoute } from './lib/router';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SpectatorScreen } from './screens/SpectatorScreen';
import { TableScreen } from './screens/TableScreen';
import board from './components/board/board.module.css';
import styles from './App.module.css';

export default function App() {
  const route = useRoute();

  switch (route.screen) {
    case 'home':
      return <HomeScreen />;
    case 'room-entry':
      return <LobbyScreen roomId={route.roomId!} />;
    case 'table':
      return <TableScreen roomId={route.roomId!} />;
    case 'play':
      return <PlayerScreen roomId={route.roomId!} />;
    case 'watch':
      return <SpectatorScreen roomId={route.roomId!} />;
    default:
      return (
        <main className={styles.root}>
          <h1 className={styles.title}>페이지를 찾을 수 없습니다</h1>
          <button className={board.buttonGhost} onClick={() => navigate('/')}>
            홈으로
          </button>
        </main>
      );
  }
}
