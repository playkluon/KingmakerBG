// 기반 스킬: skills/server-rooms/SKILL.md
// HTTP + Socket.IO 서버 조립 — listen하지 않는 팩토리로 분리해 E2E 테스트가 임의 포트로 띄울 수 있게 한다.
import http from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { ENGINE_VERSION, SCHEMA_VERSION } from '@kingmakers/engine';
import { DATA_VERSION } from '@kingmakers/data';
import { registerSocketHandlers } from './sockets';

export interface GameServer {
  httpServer: http.Server;
  io: Server;
}

/** Express 앱과 Socket.IO 서버를 조립한다 (listen은 호출자 몫) */
export function createGameServer(corsOrigin: string | string[]): GameServer {
  const app = express();

  // 헬스체크 — 배포·개발 확인용
  app.get('/health', (_req, res) => {
    res.json({ ok: true, engine: ENGINE_VERSION, schema: SCHEMA_VERSION, data: DATA_VERSION });
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: corsOrigin } });
  registerSocketHandlers(io);

  return { httpServer, io };
}
