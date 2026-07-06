import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearRooms } from '../src/rooms';
import { createGameServer, type GameServer } from '../src/server';
import { buildCardCatalog } from '@kingmakers/data';
import { chooseHeuristicAction } from '@kingmakers/data/sim/heuristic';
import { BotRng } from '@kingmakers/data/sim/bot';
import type { GameState, PlayerId } from '@kingmakers/engine';
import { isWaitingForPlayerDecision } from '@kingmakers/engine';

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

describe('7인 풀게임 자동 테스트', () => {
  it('7명의 클라이언트가 소켓으로 연결하여 5라운드(게임 종료)까지 에러나 데드락 없이 플레이를 완료한다', async () => {
    // 1. 방 생성 (Host)
    clearRooms();
    const host = await connect();
    const created = await emitAck<{ roomId: string; hostToken: string }>(host, 'room:create', { name: 'Player-0 (Host)' });
    expect(created.ok).toBe(true);
    const { roomId, hostToken } = created;
    await emitAck(host, 'room:attach', { roomId, token: hostToken });
    await emitAck(host, 'room:ready', { roomId, token: hostToken, ready: true });

    // 2. 나머지 6명 접속 및 준비
    const clients: Array<{ socket: ClientSocket; token: string; playerId: PlayerId }> = [];
    const tokens: Record<string, string> = { 'Player-0 (Host)': hostToken };

    // 임시로 소켓과 토큰만 저장 (아직 게임 시작 전이라 PlayerId는 모름)
    const pendingClients = [{ socket: host, token: hostToken, name: 'Player-0 (Host)' }];

    for (let i = 1; i <= 6; i++) {
      const socket = await connect();
      const name = `Player-${i}`;
      const join = await emitAck<{ playerToken: string }>(socket, 'room:join', { roomId, name });
      expect(join.ok).toBe(true);
      await emitAck(socket, 'room:attach', { roomId, token: join.playerToken });
      await emitAck(socket, 'room:ready', { roomId, token: join.playerToken, ready: true });
      tokens[name] = join.playerToken;
      pendingClients.push({ socket, token: join.playerToken, name });
    }

    // 3. 게임 시작 대기용 프라미스 생성 (7명 모두 view 수신 대기)
    const gameStartPromises = pendingClients.map(c => new Promise<GameState>((resolve) => c.socket.once('game:view', resolve)));
    
    // 호스트가 게임 시작
    const started = await emitAck(host, 'room:start', { roomId, token: hostToken });
    expect(started.ok).toBe(true);

    // 4. 모두 시작된 view를 받고 PlayerId 할당
    await Promise.all(gameStartPromises);
    
    for (const c of pendingClients) {
      const attach = await emitAck<{ myPlayerId: PlayerId | null }>(c.socket, 'room:attach', { roomId, token: c.token });
      expect(attach.myPlayerId).not.toBeNull();
      clients.push({ socket: c.socket, token: c.token, playerId: attach.myPlayerId! });
    }

    // 5. 게임 루프 실행 (봇 기반 자동 액션)
    const catalog = buildCardCatalog();
    const botRng = new BotRng(9999); // 고정 시드 사용

    let gameEnded = false;
    let loopCount = 0;
    const MAX_LOOPS = 2000; // 무한 루프 방지용 (락 걸림 감지)

    // 게임 뷰를 지속적으로 추적할 수 있도록 콜백 등록
    let latestState: GameState | null = null;
    let pendingDecision = false;
    
    // 호스트의 뷰를 기준으로 진행 상황 판단 (모두 동기화되므로)
    host.on('game:view', (view: GameState) => {
      latestState = view;
      pendingDecision = isWaitingForPlayerDecision(view);
      if (view.phase === 'gameEnd') {
        gameEnded = true;
      }
    });

    // 최신 상태를 강제로 가져오기 위한 헬퍼 (마지막 진행에서 멈췄을 때)
    const getLatestState = async (): Promise<GameState> => {
       const res = await emitAck<{ view: GameState }>(host, 'room:attach', { roomId, token: hostToken });
       return res.view;
    };

    latestState = await getLatestState();

    let lastPhase = '';
    
    while (!gameEnded && loopCount < MAX_LOOPS) {
      loopCount++;

      // 만약 시스템 액션만 남았다면 호스트가 진행시킴 (A-13 이후 자동이지만 엣지 케이스 방지용)
      if (latestState && !isWaitingForPlayerDecision(latestState) && latestState.phase !== 'gameEnd') {
         await emitAck(host, 'game:action', { roomId, token: hostToken, action: { type: 'runUntilPlayerAction' } });
      }

      latestState = await getLatestState();
      if (latestState.phase === 'gameEnd') {
        gameEnded = true;
        break;
      }
      
      if (latestState.phase !== lastPhase) {
         console.log(`[Loop ${loopCount}] Round ${latestState.round.round} - Phase: ${latestState.phase}`);
         lastPhase = latestState.phase;
      }

      if (!isWaitingForPlayerDecision(latestState)) {
        await new Promise(r => setTimeout(r, 10)); // 잠시 대기 후 루프 재개
        continue;
      }

      // 플레이어 행동이 필요한 상태
      const state = latestState;
      let actionTaken = false;

      // 액션이 필요한 사람들을 찾아서 봇 액션 실행
      for (const client of clients) {
        try {
          let action: any = null;
          
          if (state.phase === 'auctionBidding') {
             if (!state.round.bids[client.playerId]?.confirmed) {
                const target = botRng.pick(state.round.candidatesRevealed);
                const pState = state.players.find(p => p.id === client.playerId);
                const amount = botRng.int(Math.min(pState ? pState.money : 0, 6) + 1);
                
                await emitAck(client.socket, 'game:action', { roomId, token: client.token, action: { type: 'placeBid', actor: client.playerId, allocations: amount > 0 ? { [target]: amount } : {} } });
                action = { type: 'confirmAuctionBids', actor: client.playerId };
             }
          } else if (state.phase === 'unification') {
             const remaining = state.round.candidatesRunning
               .map((id) => state.round.camps[id]?.majorBacker)
               .find((id) => id != null && !state.round.unificationDone[id]);
             if (remaining === client.playerId) {
               action = { type: 'skipUnification', actor: client.playerId };
             }
          } else {
             action = chooseHeuristicAction(state, catalog, client.playerId, botRng);
          }

          if (action) {
            const res = await emitAck(client.socket, 'game:action', { roomId, token: client.token, action });
            if (res.ok) {
               actionTaken = true;
            } else {
               console.warn(`Action failed for ${client.playerId}: ${res.reason}`, action);
            }
          }
        } catch (e) {
          // 해당 플레이어의 턴이 아니면 에러를 던지게 되어 있음
        }
      }

      if (!actionTaken && isWaitingForPlayerDecision(latestState)) {
        // 아무도 액션을 취할 수 없는데 대기 중이면 데드락
        console.error(`Deadlock detected at phase: ${latestState.phase}. No valid actions found for any player. Round: ${latestState.round.round}`);
        throw new Error(`Deadlock detected at phase: ${latestState.phase}. No valid actions found for any player.`);
      }
      
      await new Promise(r => setTimeout(r, 50)); // 다음 view 브로드캐스트가 적용될 시간 여유
    }

    if (loopCount >= MAX_LOOPS) {
      console.error(`MAX_LOOPS (${MAX_LOOPS}) reached! Current Phase: ${latestState?.phase}`);
    }

    expect(gameEnded).toBe(true);
    expect(loopCount).toBeLessThan(MAX_LOOPS); // 무한 루프가 돌지 않았는지 확인
    
    const finalState = await getLatestState();
    expect(finalState.finalResult).not.toBeNull();
    expect(finalState.finalResult!.entries).toHaveLength(7); // 7명 정산 확인
  }, 120000); // 타임아웃을 120초로 연장
});
