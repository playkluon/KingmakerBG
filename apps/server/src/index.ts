// 기반 스킬: skills/setup/SKILL.md
// Phase 0 서버 부팅 골격 — 방/좌석/마스킹은 Phase 4(skills/server-rooms)에서 구현한다.
import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from 'socket.io';
import { ENGINE_VERSION, SCHEMA_VERSION } from '@kingmakers/engine';
import { DATA_VERSION } from '@kingmakers/data';

// 루트 .env 로드 (없으면 기본값 사용)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// PORT 대신 SERVER_PORT 사용 — 실행 환경(프리뷰/호스팅)이 주입하는 PORT와의 충돌 방지
const PORT = Number(process.env.SERVER_PORT ?? 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

/** Express 앱과 Socket.IO 서버를 생성해 기동한다 */
function main(): void {
  const app = express();

  // 헬스체크 — 배포·개발 확인용
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      engine: ENGINE_VERSION,
      schema: SCHEMA_VERSION,
      data: DATA_VERSION,
    });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: CORS_ORIGIN },
  });

  // Phase 0: 연결 확인 로그만 남긴다 (네임스페이스·방 관리는 Phase 4)
  io.on('connection', (socket) => {
    console.log(`[소켓] 연결됨: ${socket.id}`);
    socket.on('disconnect', (reason) => {
      console.log(`[소켓] 연결 해제: ${socket.id} (${reason})`);
    });
  });

  server.listen(PORT, () => {
    console.log(
      `[서버] http://localhost:${PORT} 대기 중 — 엔진 v${ENGINE_VERSION} / 스키마 ${SCHEMA_VERSION}`,
    );
  });
}

main();
