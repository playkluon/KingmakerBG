// 기반 스킬: skills/setup/SKILL.md
import { io, type Socket } from 'socket.io-client';

const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

/**
 * 서버와의 Socket.IO 연결을 생성한다.
 * Phase 4(skills/server-rooms)에서 playerToken 인증·재접속 백오프가 추가된다.
 */
export function createSocket(): Socket {
  return io(SERVER_URL, { autoConnect: true });
}
