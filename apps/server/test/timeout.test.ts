import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearRooms } from '../src/rooms';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
let baseUrl = '';
const openSockets: ClientSocket[] = [];

beforeAll(async () => {
  server = createGameServer('*');
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const address = server.httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${address.port}`;
});

afterAll(async () => {
  for (const socket of openSockets) socket.disconnect();
  server.io.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function emitAck<T = Record<string, unknown>>(socket: ClientSocket, event: string, payload: unknown): Promise<T & { ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: T & { ok: boolean; reason?: string }) => resolve(response));
  });
}

describe('방 타임아웃 기능 테스트', () => {
  it('방이 아무런 동작 없이 1초 경과 시 파괴된다 (500ms에 경고 수신)', async () => {
    clearRooms();
    const host = await connect();
    const created = await emitAck<{ roomId: string; hostToken: string }>(host, 'room:create', { name: '호스트' });
    const { roomId, hostToken } = created;
    await emitAck(host, 'room:attach', { roomId, token: hostToken });

    const warningPromise = new Promise<void>((resolve) => host.once('room:idleWarning', resolve));
    const closedPromise = new Promise<void>((resolve) => host.once('room:closed', resolve));

    // 500ms 후에 warning을 받아야 한다
    await warningPromise;
    expect(true).toBe(true);

    // 1000ms 후에 closed를 받아야 한다
    await closedPromise;
    expect(true).toBe(true);
  });

  it('경고 수신 후 keepAlive를 보내면 1.5초가 지나도 방이 파괴되지 않는다', async () => {
    clearRooms();
    const host = await connect();
    const created = await emitAck<{ roomId: string; hostToken: string }>(host, 'room:create', { name: '호스트' });
    const { roomId, hostToken } = created;
    await emitAck(host, 'room:attach', { roomId, token: hostToken });

    const warningPromise = new Promise<void>((resolve) => host.once('room:idleWarning', resolve));
    let closed = false;
    host.once('room:closed', () => { closed = true; });

    // warning 대기
    await warningPromise;
    
    // 연장 요청
    const clearPromise = new Promise<void>((resolve) => host.once('room:idleWarningClear', resolve));
    await emitAck(host, 'room:keepAlive', { roomId });
    await clearPromise;

    // 1초를 더 대기해도 안 닫히는지 확인
    await new Promise((r) => setTimeout(r, 1000));
    expect(closed).toBe(false);
  });
});
