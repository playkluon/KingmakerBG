// 기반 스킬: skills/client-lobby-table/SKILL.md
// 단일 게임 스토어 — 서버가 보낸 마스킹 뷰를 "그대로" 보관한다.
// 클라이언트 룰 계산 금지(CLAUDE.md): 파생값은 engine selectors만 사용하고, 상태 변경은 서버 응답으로만 일어난다.
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import type { GameAction, GameState, PlayerId } from '@kingmakers/engine';
import { loadAnyToken, loadMyName, saveHostToken, saveMyName, savePlayerToken } from '../lib/storage';

const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
const SOCKET_PATH: string = import.meta.env.VITE_SOCKET_PATH ?? '/socket.io';

/** 서버 toRoomStatePayload와 동일한 형태 */
export interface RoomStatePayload {
  id: string;
  status: 'waiting' | 'playing';
  hostName: string;
  maxPlayers: number;
  minPlayers: number;
  players: Array<{ name: string; ready: boolean; playerId: PlayerId | null }>;
  canStart: boolean;
}

export type Role = 'host' | 'player' | 'spectator';

interface AckResponse {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
}

interface GameStore {
  connected: boolean;
  roomId: string | null;
  token: string | null;
  role: Role | null;
  myPlayerId: PlayerId | null;
  /** 로비에서 roomState.players 중 내 항목을 찾기 위한 이름 (부록 A-2: 새로고침해도 유지) */
  myName: string | null;
  roomState: RoomStatePayload | null;
  view: GameState | null;
  /** 마지막 거부/오류 사유 — 화면이 토스트로 보여주고 지운다 */
  lastError: string | null;

  createRoom(name: string): Promise<{ ok: boolean; roomId?: string; reason?: string }>;
  joinRoom(roomId: string, name: string): Promise<{ ok: boolean; reason?: string }>;
  /** 방에 소켓을 붙인다 (첫 입장·새로고침·재접속 공용) */
  attach(roomId: string): Promise<{ ok: boolean; role?: Role; reason?: string }>;
  setReady(ready: boolean): Promise<void>;
  startGame(): Promise<void>;
  sendAction(action: GameAction): Promise<{ ok: boolean; reason?: string }>;
  clearError(): void;
}

let socket: Socket | null = null;

/** 소켓 싱글턴 — 이벤트 수신은 전부 스토어 갱신으로 이어진다 */
function getSocket(): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, { autoConnect: true, path: SOCKET_PATH });

  socket.on('connect', () => {
    useGameStore.setState({ connected: true });
    // 재접속: 붙어 있던 방이 있으면 좌석·뷰를 복원한다 (부록 A-2)
    const { roomId } = useGameStore.getState();
    if (roomId) void useGameStore.getState().attach(roomId);
  });
  socket.on('disconnect', () => useGameStore.setState({ connected: false }));
  socket.on('room:state', (roomState: RoomStatePayload) => useGameStore.setState({ roomState }));
  socket.on('game:view', (view: GameState) => useGameStore.setState({ view }));
  socket.on('action:rejected', (payload: { reason?: string }) => {
    useGameStore.setState({ lastError: payload?.reason ?? '요청이 거부되었습니다' });
  });

  return socket;
}

/** emit + ack 콜백을 Promise로 감싼다 */
function emitAck<T extends AckResponse = AckResponse>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    getSocket().emit(event, payload, (response: T) => resolve(response));
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  roomId: null,
  token: null,
  role: null,
  myPlayerId: null,
  myName: null,
  roomState: null,
  view: null,
  lastError: null,

  async createRoom(name) {
    const res = await emitAck('room:create', { name });
    if (!res.ok) {
      set({ lastError: res.reason ?? '방 생성에 실패했습니다' });
      return { ok: false, reason: res.reason };
    }
    const roomId = String(res.roomId);
    saveHostToken(roomId, String(res.hostToken));
    saveMyName(roomId, name);
    set({ myName: name });
    return { ok: true, roomId };
  },

  async joinRoom(roomId, name) {
    const res = await emitAck('room:join', { roomId, name });
    if (!res.ok) {
      set({ lastError: res.reason ?? '입장에 실패했습니다' });
      return { ok: false, reason: res.reason };
    }
    savePlayerToken(roomId, String(res.playerToken));
    saveMyName(roomId, name);
    set({ myName: name });
    return { ok: true };
  },

  async attach(roomId) {
    const token = loadAnyToken(roomId) ?? '';
    const res = await emitAck('room:attach', { roomId, token });
    if (!res.ok) {
      set({ lastError: res.reason ?? '방에 연결하지 못했습니다' });
      return { ok: false, reason: res.reason };
    }
    set({
      roomId,
      token,
      role: res.role as Role,
      myPlayerId: (res.myPlayerId as PlayerId | null) ?? null,
      myName: get().myName ?? loadMyName(roomId),
      roomState: res.roomState as RoomStatePayload,
      view: (res.view as GameState | null) ?? null,
    });
    return { ok: true, role: res.role as Role };
  },

  async setReady(ready) {
    const { roomId, token } = get();
    if (!roomId || !token) return;
    const res = await emitAck('room:ready', { roomId, token, ready });
    if (!res.ok) set({ lastError: res.reason ?? '준비 상태 변경에 실패했습니다' });
  },

  async startGame() {
    const { roomId, token } = get();
    if (!roomId || !token) return;
    const res = await emitAck('room:start', { roomId, token });
    if (!res.ok) set({ lastError: res.reason ?? '게임 시작에 실패했습니다' });
  },

  async sendAction(action) {
    const { roomId, token } = get();
    if (!roomId || !token) return { ok: false, reason: '방에 연결되어 있지 않습니다' };
    const res = await emitAck('game:action', { roomId, token, action });
    if (!res.ok) {
      set({ lastError: res.reason ?? '액션이 거부되었습니다' });
      return { ok: false, reason: res.reason };
    }
    // ack에 포함된 "내 액션이 반영된" 뷰로 즉시 갱신 (서버 브로드캐스트보다 빠르고 순서 경합이 없다)
    if (res.view) set({ view: res.view as GameState, lastError: null });
    return { ok: true };
  },

  clearError() {
    set({ lastError: null });
  },
}));
