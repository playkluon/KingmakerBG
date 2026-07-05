// 기반 스킬: skills/server-rooms/SKILL.md
// 서버 부팅 진입점 — 조립은 server.ts, 방/마스킹/권한은 rooms.ts·views.ts·sockets.ts가 담당한다.
import path from 'node:path';
import dotenv from 'dotenv';
import { createGameServer } from './server';

// 루트 .env 로드 (없으면 기본값 사용)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// PORT 대신 SERVER_PORT 사용 — 실행 환경(프리뷰/호스팅)이 주입하는 PORT와의 충돌 방지
const PORT = Number(process.env.SERVER_PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

/** 게임 서버를 기동한다 */
function main(): void {
  const { httpServer } = createGameServer(CORS_ORIGIN);
  httpServer.listen(PORT, () => {
    console.log(`[서버] http://localhost:${PORT} 대기 중 — 방 생성/입장/게임 진행 준비 완료`);
  });
}

main();
