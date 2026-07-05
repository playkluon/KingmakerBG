// 기반 스킬: skills/server-rooms/SKILL.md
// 소켓 이벤트 핸들러 — 엔진 호출 + 뷰 전송만 담당한다. 룰 계산은 전부 engine에 있다 (CLAUDE.md).
import { isPlayerAction, reduce } from '@kingmakers/engine';
import type { ActionLogEntry, GameAction } from '@kingmakers/engine';
import type { Server, Socket } from 'socket.io';
import { CATALOG, createRoom, getRoom, joinRoom, setReady, startGame, toRoomStatePayload, type Room } from './rooms';
import { projectView, type Viewer } from './views';

/**
 * 소켓 1개가 붙어 있는 방·토큰 정보 (socket.data에 보관).
 * 뷰 시점은 여기 고정하지 않고 브로드캐스트 시점마다 재판정한다 —
 * 게임 시작 전 attach한 참가자도 좌석 배정 후에는 자동으로 player 시점을 받는다.
 */
interface SocketAttachment {
  roomId: string;
  token: string;
}

type Ack = (response: { ok: boolean; reason?: string; [key: string]: unknown }) => void;

/** 콜백이 없어도 죽지 않도록 감싸는 헬퍼 */
function ack(cb: unknown): Ack {
  return typeof cb === 'function' ? (cb as Ack) : () => undefined;
}

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

/** 토큰으로 이 소켓의 뷰 시점을 판정한다 — 호스트 토큰=table, 좌석 있는 참가자=player, 그 외=spectator */
function resolveViewer(room: Room, token: string | undefined): Viewer {
  if (token && token === room.hostToken) return { kind: 'table' };
  const player = token ? room.players.find((p) => p.token === token) : undefined;
  if (player?.playerId) return { kind: 'player', playerId: player.playerId };
  return { kind: 'spectator' };
}

/** UI 라우팅용 역할 — 좌석 배정 전이라도 참가자 토큰이면 'player'다 (resolveViewer와 구분) */
function resolveRole(room: Room, token: string | undefined): 'host' | 'player' | 'spectator' {
  if (token && token === room.hostToken) return 'host';
  if (token && room.players.some((p) => p.token === token)) return 'player';
  return 'spectator';
}

/** 방의 모든 소켓에 각자 시점으로 마스킹한 뷰를 보낸다 (부록 A-3: 시점마다 payload가 다르다) */
async function broadcastViews(io: Server, room: Room): Promise<void> {
  if (!room.game) return;
  const sockets = await io.in(roomChannel(room.id)).fetchSockets();
  for (const socket of sockets) {
    const attachment = socket.data as Partial<SocketAttachment>;
    if (attachment.roomId !== room.id) continue;
    socket.emit('game:view', projectView(room.game, resolveViewer(room, attachment.token)));
  }
}

/** 새 액션 로그를 방 전체에 브로드캐스트한다 (로그 summary/effects는 공개 정보만 담는다 — 부록 A-6) */
function broadcastLog(io: Server, roomId: string, log: ActionLogEntry[]): void {
  if (log.length > 0) io.in(roomChannel(roomId)).emit('game:log', log);
}

function broadcastRoomState(io: Server, room: Room): void {
  io.in(roomChannel(room.id)).emit('room:state', toRoomStatePayload(room));
}

/** §20 액션 권한: 참가자는 자기 좌석의 플레이어 액션만, 호스트는 시스템 액션만, 관전자는 불가 */
function authorizeAction(room: Room, token: string, action: GameAction): string | null {
  if (isPlayerAction(action)) {
    const player = room.players.find((p) => p.token === token);
    if (!player?.playerId) return '이 방의 참가자가 아닙니다';
    if (player.playerId !== action.actor) return '자기 좌석의 액션만 실행할 수 있습니다';
    return null;
  }
  if (token !== room.hostToken) return '시스템 진행은 호스트만 할 수 있습니다';
  return null;
}

/** 서버의 모든 소켓 이벤트를 등록한다 */
export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // ── 방 생성 (§21-1) ──────────────────────────────────────
    socket.on('room:create', (payload: { name?: string }, cb?: unknown) => {
      const result = createRoom(String(payload?.name ?? ''));
      if (!result.ok) return ack(cb)({ ok: false, reason: result.reason });
      ack(cb)({ ok: true, roomId: result.value.id, hostToken: result.value.hostToken });
    });

    // ── 참가자 입장 (§21-3: 초대 링크 + 이름 입력) ─────────────
    socket.on('room:join', (payload: { roomId?: string; name?: string }, cb?: unknown) => {
      const result = joinRoom(String(payload?.roomId ?? ''), String(payload?.name ?? ''));
      if (!result.ok) return ack(cb)({ ok: false, reason: result.reason });
      broadcastRoomState(io, result.value.room);
      ack(cb)({ ok: true, playerToken: result.value.token, roomState: toRoomStatePayload(result.value.room) });
    });

    // ── 소켓을 방에 연결 (첫 입장·새로고침·재접속 공용 — 부록 A-2) ──
    socket.on('room:attach', async (payload: { roomId?: string; token?: string }, cb?: unknown) => {
      const room = getRoom(String(payload?.roomId ?? ''));
      if (!room) return ack(cb)({ ok: false, reason: '존재하지 않는 방입니다' });

      const token = String(payload?.token ?? '');
      const attachment: SocketAttachment = { roomId: room.id, token };
      Object.assign(socket.data, attachment);
      await socket.join(roomChannel(room.id));

      const viewer = resolveViewer(room, token);
      ack(cb)({
        ok: true,
        role: resolveRole(room, token),
        myPlayerId: viewer.kind === 'player' ? viewer.playerId : null,
        roomState: toRoomStatePayload(room),
        view: room.game ? projectView(room.game, viewer) : null,
      });
    });

    // ── 준비 토글 (§21-4) ────────────────────────────────────
    socket.on('room:ready', (payload: { roomId?: string; token?: string; ready?: boolean }, cb?: unknown) => {
      const result = setReady(String(payload?.roomId ?? ''), String(payload?.token ?? ''), Boolean(payload?.ready));
      if (!result.ok) return ack(cb)({ ok: false, reason: result.reason });
      broadcastRoomState(io, result.value);
      ack(cb)({ ok: true });
    });

    // ── 게임 시작 (§21-5~6: 호스트 전용, 랜덤 좌석) ─────────────
    socket.on('room:start', async (payload: { roomId?: string; token?: string }, cb?: unknown) => {
      const result = startGame(String(payload?.roomId ?? ''), String(payload?.token ?? ''));
      if (!result.ok) return ack(cb)({ ok: false, reason: result.reason });
      const room = result.value;
      broadcastRoomState(io, room);
      io.in(roomChannel(room.id)).emit('game:started', { roomId: room.id });
      await broadcastViews(io, room);
      ack(cb)({ ok: true });
    });

    // ── 게임 액션 (§20 권한 검증 → 엔진 reduce → 뷰/로그 브로드캐스트) ──
    socket.on('game:action', async (payload: { roomId?: string; token?: string; action?: GameAction }, cb?: unknown) => {
      const room = getRoom(String(payload?.roomId ?? ''));
      if (!room) return ack(cb)({ ok: false, reason: '존재하지 않는 방입니다' });
      if (!room.game) return ack(cb)({ ok: false, reason: '아직 게임이 시작되지 않았습니다' });
      const action = payload?.action;
      if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
        return ack(cb)({ ok: false, reason: '올바르지 않은 액션 형식입니다' });
      }

      const authError = authorizeAction(room, String(payload?.token ?? ''), action);
      if (authError) {
        socket.emit('action:rejected', { reason: authError });
        return ack(cb)({ ok: false, reason: authError });
      }

      const result = reduce(room.game, action, CATALOG);
      if (!result.ok) {
        // 검증 실패 사유는 해당 플레이어에게만 회신한다 (CLAUDE.md)
        socket.emit('action:rejected', { reason: result.reason });
        return ack(cb)({ ok: false, reason: result.reason });
      }

      // 자동 진행 가능한 phase까지 서버가 곧바로 이어서 진행한다 —
      // §22 "플레이어가 액션해야 할 때만 화면이 멈춰야 한다" 요구사항 때문에,
      // 특정 클라이언트(호스트)가 별도로 runUntilPlayerAction을 보내줄 때까지 기다리게 두면 안 된다 (부록 A-13).
      // runUntilPlayerAction은 이미 결정 지점/종료 상태여도 안전하게 no-op되므로 항상 이어붙여도 된다.
      const chained = reduce(result.state, { type: 'runUntilPlayerAction' }, CATALOG);
      const finalState = chained.ok ? chained.state : result.state;
      const combinedLog = chained.ok ? [...result.log, ...chained.log] : result.log;

      room.game = finalState;
      broadcastLog(io, room.id, combinedLog);
      await broadcastViews(io, room);
      // ack에 요청자 시점의 최신 뷰를 함께 돌려준다 — 브로드캐스트와의 순서 경합 없이
      // "내 액션이 반영된 상태"를 확정적으로 받을 수 있다 (클라이언트 낙관적 갱신 불필요)
      ack(cb)({ ok: true, view: projectView(room.game, resolveViewer(room, String(payload?.token ?? ''))) });
    });
  });
}
