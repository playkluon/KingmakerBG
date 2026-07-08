// 기반 스킬: skills/server-rooms/SKILL.md
// 방 생성/입장/ready/start — MVP 저장소는 서버 메모리 Map (부록 A-2: 계정·DB 없음, 방은 휘발성)
import { randomUUID } from 'node:crypto';
import { reduce, setupGame } from '@kingmakers/engine';
import type { CardCatalog, DrawPiles, GameState, PlayerId } from '@kingmakers/engine';
import { AGENDAS, buildCardCatalog, CANDIDATES, CANDIDATE_EVENTS, ISSUES, PROMISES, VOTERS, VOTER_EVENTS } from '@kingmakers/data';

export interface RoomPlayer {
  /** playerToken (uuid) — 재접속·권한 검증의 근거 (부록 A-2). 호스트가 겸직 참가하면 hostToken과 동일한 값이다 (부록 A-22) */
  token: string;
  name: string;
  ready: boolean;
  /** 서버가 자동으로 행동하는 참가자 슬롯 (부록 A-23). 사람 토큰으로 조작할 수 없다. */
  isAi: boolean;
  /**
   * 첫 게임 안내(튜토리얼)를 마쳤는지 (부록 A-24) — 완료하거나 건너뛰기 전에는 준비 완료로 넘어갈 수 없다.
   * AI는 안내가 필요 없으므로 생성 시점에 항상 true다.
   */
  tutorialDone: boolean;
  /** 게임 시작 시 랜덤 좌석 배정으로 확정 (§21) */
  playerId: PlayerId | null;
}

/** 관전자 — 좌석·ready 없이 공개 정보만 구경한다 (부록 A-3 spectator 시점) */
export interface RoomSpectator {
  token: string;
  name: string;
}

/** 방 공개 범위 (부록 A-22): 공개방은 room:list로 조회되고, 비공개방은 초대 링크로만 입장한다 */
export type RoomVisibility = 'public' | 'private';

export interface Room {
  id: string;
  hostToken: string;
  hostName: string;
  visibility: RoomVisibility;
  allowSpectators: boolean;
  status: 'waiting' | 'playing';
  players: RoomPlayer[];
  spectators: RoomSpectator[];
  game: GameState | null;
  /** 타임아웃 관리를 위한 마지막 활동 시간 */
  lastActivityAt: number;
  /** 타임아웃 경고 발송 여부 */
  timeoutWarningIssued: boolean;
}

/** 방 관련 실패는 throw가 아니라 사유 문자열로 돌려준다 (CLAUDE.md — 서버가 해당 소켓에만 회신) */
export type RoomResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** 인원별 설정표 (부록 A-22) — 게임 규칙 수치가 아니라 방 운영 정원이라 engine/constants.ts가 아닌 여기 둔다 */
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;
export const MAX_SPECTATORS = 5;

const rooms = new Map<string, Room>();

/** 실카드 190장으로 엔진 CardCatalog를 만든다 — 모든 방이 공유하는 불변 데이터 */
export const CATALOG: CardCatalog = buildCardCatalog();

/** 실카드 ID로 엔진 DrawPiles를 구성한다 (셔플은 setupGame이 seed로 수행) */
function realDecks(): DrawPiles {
  return {
    candidateDeck: CANDIDATES.map((c) => c.id),
    promiseDeck: PROMISES.map((p) => p.id),
    voterDeck: VOTERS.map((v) => v.id),
    issueDeck: ISSUES.map((i) => i.id),
    candidateEventDeck: CANDIDATE_EVENTS.map((e) => e.id),
    voterEventDeck: VOTER_EVENTS.map((e) => e.id),
    agendaDeck: AGENDAS.map((a) => a.id),
  };
}

/** 초대 링크용 짧은 방 코드 (uuid 앞 6자리 — 충돌 시 재시도) */
function newRoomId(): string {
  for (let i = 0; i < 10; i += 1) {
    const id = randomUUID().replace(/-/g, '').slice(0, 6);
    if (!rooms.has(id)) return id;
  }
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/** 테스트 전용 — 방 전체 초기화 */
export function clearRooms(): void {
  rooms.clear();
}

/** 전체 방 목록 반환 (타이머 검사용) */
export function getAllRooms(): Room[] {
  return [...rooms.values()];
}

/** 방의 마지막 활동 시간을 현재로 갱신하고 경고 상태를 초기화한다 */
export function touchRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.lastActivityAt = Date.now();
    room.timeoutWarningIssued = false;
  }
}

/** 방 강제 삭제 (타임아웃용) */
export function destroyRoom(roomId: string): void {
  rooms.delete(roomId);
}

export interface CreateRoomOptions {
  /** 공개방은 room:list로 조회되고, 비공개방은 초대 링크로만 입장한다 (부록 A-22). 기본값은 안전한 쪽인 비공개 */
  visibility?: RoomVisibility;
  allowSpectators?: boolean;
  customRoomId?: string;
  /** 호스트도 좌석을 받아 플레이어로 참가할지 (부록 A-22) — true면 hostToken을 그대로 참가자 토큰으로 등록한다 */
  hostJoinsAsPlayer?: boolean;
  /** 방 생성 시 미리 넣을 AI 참가자 수 (부록 A-23). AI는 자동 준비 상태다. */
  aiPlayerCount?: number;
}

/** 방 전체에서 이미 쓰이는 이름인지 확인한다 — 참가자와 관전자를 통틀어 하나의 이름 공간을 쓴다 */
function isNameTaken(room: Room, name: string): boolean {
  return room.players.some((p) => p.name === name) || room.spectators.some((s) => s.name === name);
}

/**
 * 호스트는 옵션(hostJoinsAsPlayer)에 따라 참가자 좌석을 겸할 수 있다.
 * hostToken을 그대로 참가자 토큰으로 등록해 하나의 토큰이 방 관리 권한과 좌석을 동시에 가진다.
 */
export function createRoom(hostName: string, options: CreateRoomOptions = {}): RoomResult<Room> {
  const name = hostName.trim();
  if (!name) return { ok: false, reason: '호스트 이름을 입력하세요' };
  
  let id = newRoomId();
  if (options.customRoomId?.trim()) {
    id = options.customRoomId.trim();
    if (id.length > 20) return { ok: false, reason: '방 코드는 20자 이하여야 합니다' };
    if (rooms.has(id)) return { ok: false, reason: '이미 존재하는 방 코드입니다' };
  }

  const hostToken = randomUUID();
  const aiPlayerCount = normalizeAiPlayerCount(options.aiPlayerCount);
  
  // 부록 A-22: 예전에는 항상 참가였으나, AI 추가 시 옵션 제어 필요하므로 기본적으로 hostJoinsAsPlayer를 따른다
  const isHostPlayer = options.hostJoinsAsPlayer !== false;
  const initialPlayers: RoomPlayer[] = isHostPlayer
    ? [{ token: hostToken, name, ready: false, isAi: false, tutorialDone: false, playerId: null }]
    : [];
  
  if (initialPlayers.length + aiPlayerCount > MAX_PLAYERS) {
    return { ok: false, reason: `참가자 정원(${MAX_PLAYERS}명)을 초과했습니다` };
  }

  const room: Room = {
    id,
    hostToken,
    hostName: name,
    visibility: options.visibility === 'public' ? 'public' : 'private',
    allowSpectators: options.allowSpectators ?? true,
    status: 'waiting',
    players: initialPlayers,
    spectators: [],
    game: null,
    lastActivityAt: Date.now(),
    timeoutWarningIssued: false,
  };
  for (let i = 0; i < aiPlayerCount; i += 1) {
    room.players.push(newAiPlayer(room));
  }
  rooms.set(room.id, room);
  return { ok: true, value: room };
}

export function joinRoom(roomId: string, playerName: string): RoomResult<{ room: Room; token: string }> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작된 방입니다' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, reason: `정원(${MAX_PLAYERS}명)이 가득 찼습니다` };
  const name = playerName.trim();
  if (!name) return { ok: false, reason: '이름을 입력하세요' };
  if (isNameTaken(room, name)) return { ok: false, reason: '이미 사용 중인 이름입니다' };

  const player: RoomPlayer = { token: randomUUID(), name, ready: false, isAi: false, tutorialDone: false, playerId: null };
  room.players.push(player);
  return { ok: true, value: { room, token: player.token } };
}

function normalizeAiPlayerCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(MAX_PLAYERS, Math.floor(parsed)));
}

function nextAiName(room: Room): string {
  for (let i = 1; i <= MAX_PLAYERS; i += 1) {
    const name = `AI ${i}`;
    if (!isNameTaken(room, name)) return name;
  }
  return `AI ${randomUUID().slice(0, 4)}`;
}

function newAiPlayer(room: Room): RoomPlayer {
  // AI는 튜토리얼이 필요 없으므로 처음부터 완료 상태로 만든다 (부록 A-24)
  return { token: `ai-${randomUUID()}`, name: nextAiName(room), ready: true, isAi: true, tutorialDone: true, playerId: null };
}

export function addAiPlayer(roomId: string, token: string): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (token !== room.hostToken) return { ok: false, reason: 'AI 참가자 추가는 호스트만 할 수 있습니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '게임 시작 후에는 AI 참가자를 추가할 수 없습니다' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, reason: `정원(${MAX_PLAYERS}명)이 가득 찼습니다` };
  room.players.push(newAiPlayer(room));
  return { ok: true, value: room };
}

export function removeAiPlayer(roomId: string, token: string, aiName?: string): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (token !== room.hostToken) return { ok: false, reason: 'AI 참가자 제거는 호스트만 할 수 있습니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '게임 시작 후에는 AI 참가자를 제거할 수 없습니다' };
  const targetIndex =
    aiName && aiName.trim()
      ? room.players.findIndex((p) => p.isAi && p.name === aiName.trim())
      : (() => {
          for (let i = room.players.length - 1; i >= 0; i -= 1) {
            if (room.players[i]?.isAi) return i;
          }
          return -1;
        })();
  if (targetIndex < 0) return { ok: false, reason: '제거할 AI 참가자가 없습니다' };
  room.players.splice(targetIndex, 1);
  return { ok: true, value: room };
}
/**
 * 관전자 입장 (부록 A-22) — 좌석·ready가 없어 게임 진행 중에도 언제든 들어올 수 있고, 정원은 MAX_SPECTATORS로 제한한다.
 */
export function spectateRoom(roomId: string, spectatorName: string): RoomResult<{ room: Room; token: string }> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (!room.allowSpectators) return { ok: false, reason: '이 방은 관전을 허용하지 않습니다' };
  if (room.spectators.length >= MAX_SPECTATORS) return { ok: false, reason: `관전 정원(${MAX_SPECTATORS}명)이 가득 찼습니다` };
  const name = spectatorName.trim();
  if (!name) return { ok: false, reason: '이름을 입력하세요' };
  if (isNameTaken(room, name)) return { ok: false, reason: '이미 사용 중인 이름입니다' };

  const spectator: RoomSpectator = { token: randomUUID(), name };
  room.spectators.push(spectator);
  return { ok: true, value: { room, token: spectator.token } };
}

/** 공개방 목록 (부록 A-22) — room:list가 토큰 없이 누구에게나 돌려주는 요약 정보라 민감 데이터는 포함하지 않는다 */
export interface PublicRoomSummary {
  id: string;
  hostName: string;
  status: 'waiting' | 'playing';
  visibility: RoomVisibility;
  allowSpectators: boolean;
  playerCount: number;
  maxPlayers: number;
  spectatorCount: number;
  maxSpectators: number;
}

export function listPublicRooms(): PublicRoomSummary[] {
  return [...rooms.values()]
    .filter((room) => room.visibility === 'public')
    .map((room) => ({
      id: room.id,
      hostName: room.hostName,
      status: room.status,
      visibility: room.visibility,
      allowSpectators: room.allowSpectators,
      playerCount: room.players.length,
      maxPlayers: MAX_PLAYERS,
      spectatorCount: room.spectators.length,
      maxSpectators: MAX_SPECTATORS,
    }));
}

export function setReady(roomId: string, token: string, ready: boolean): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작되었습니다' };
  const player = room.players.find((p) => p.token === token);
  if (!player) return { ok: false, reason: '이 방의 참가자가 아닙니다' };
  player.ready = ready;
  return { ok: true, value: room };
}

/** 튜토리얼 완료/건너뛰기 기록 (부록 A-24) — 완료 전에는 준비 완료로 넘어갈 수 없다 */
export function setTutorialDone(roomId: string, token: string, done: boolean): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작되었습니다' };
  const player = room.players.find((p) => p.token === token);
  if (!player) return { ok: false, reason: '이 방의 참가자가 아닙니다' };
  player.tutorialDone = done;
  // 튜토리얼을 다시 안 보기로 하면(done=false) 그 사이 눌러뒀던 준비 완료는 무효로 되돌린다
  if (!done) player.ready = false;
  return { ok: true, value: room };
}

/**
 * 방 나가기 (부록 A-22).
 * - 관전자는 좌석·진행 상태와 무관하게 언제든 나갈 수 있다 — 게임 결과에 영향이 없기 때문이다.
 * - 참가자(호스트 포함)는 대기 중(waiting)에만 나갈 수 있다 — 게임이 시작되면 좌석이 GameState에
 *   고정돼(§21) 엔진에 "탈주" 개념이 없으므로, 중도 이탈 처리는 스킬 12 이후로 미룬다.
 * - 호스트가 나가면 방 관리자가 사라지므로 방 전체를 닫는다(closed: true) — 호스트가 항상 참가자를
 *   겸하므로(부록 A-22) 이 검사를 참가자 목록 조회보다 먼저 해야 한다.
 */
export function leaveRoom(roomId: string, token: string): RoomResult<{ closed: boolean }> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };

  const spectatorIndex = room.spectators.findIndex((s) => s.token === token);
  if (spectatorIndex !== -1) {
    room.spectators.splice(spectatorIndex, 1);
    return { ok: true, value: { closed: false } };
  }

  if (room.status !== 'waiting') return { ok: false, reason: '게임이 시작된 후에는 나갈 수 없습니다' };

  const playerIndex = room.players.findIndex((p) => p.token === token);
  if (playerIndex === -1) return { ok: false, reason: '이 방에 속해 있지 않습니다' };
  
  room.players.splice(playerIndex, 1);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { ok: true, value: { closed: true } };
  }

  if (token === room.hostToken) {
    const nextHumanHost = room.players.find(p => !p.isAi);
    if (nextHumanHost) {
      room.hostToken = nextHumanHost.token;
      room.hostName = nextHumanHost.name;
    } else {
      // 남은 사람이 모두 AI라면 방을 유지할 이유가 없으므로 파기한다
      rooms.delete(roomId);
      return { ok: true, value: { closed: true } };
    }
  }

  return { ok: true, value: { closed: false } };
}

/**
 * §21: 모두 준비되면 호스트가 시작 → 시스템이 좌석을 랜덤 배정.
 * seed는 서버가 생성해 GameState에 기록한다 (엔진 내부 Math.random 금지 — 부록 A-5).
 */
export function startGame(roomId: string, token: string): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (token !== room.hostToken) return { ok: false, reason: '게임 시작은 호스트만 할 수 있습니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작되었습니다' };
  if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
    return { ok: false, reason: `${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다 (현재 ${room.players.length}명)` };
  }
  // 부록 A-24: 튜토리얼 미완료가 우선 사유 — "준비 안 됨"만 보이면 뭘 더 해야 하는지 알 수 없다
  if (!room.players.every((p) => p.tutorialDone)) {
    return { ok: false, reason: '아직 튜토리얼을 완료(또는 건너뛰기)하지 않은 참가자가 있습니다' };
  }
  if (!room.players.every((p) => p.ready)) return { ok: false, reason: '아직 준비하지 않은 참가자가 있습니다' };

  // 좌석 랜덤 배정 (Fisher-Yates — 서버 측 난수는 허용, 엔진 밖이다)
  const shuffled = [...room.players];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  shuffled.forEach((p, seat) => {
    p.playerId = `player-${seat}`;
  });

  const seed = Math.floor(Math.random() * 2 ** 31);
  let state = setupGame({ seed, players: shuffled.map((p) => ({ name: p.name })), decks: realDecks() });

  const started = reduce(state, { type: 'startGame' }, CATALOG);
  if (!started.ok) return { ok: false, reason: started.reason };
  const advanced = reduce(started.state, { type: 'runUntilPlayerAction' }, CATALOG);
  if (!advanced.ok) return { ok: false, reason: advanced.reason };

  room.game = advanced.state;
  room.status = 'playing';
  return { ok: true, value: room };
}

/** 로비/대기실에 뿌리는 공개 방 상태 — 토큰은 절대 포함하지 않는다 */
export function toRoomStatePayload(room: Room) {
  return {
    id: room.id,
    status: room.status,
    hostName: room.hostName,
    visibility: room.visibility,
    allowSpectators: room.allowSpectators,
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    maxSpectators: MAX_SPECTATORS,
    players: room.players.map((p) => ({ name: p.name, ready: p.ready, isAi: p.isAi, tutorialDone: p.tutorialDone, playerId: p.playerId })),
    spectators: room.spectators.map((s) => ({ name: s.name })),
    canStart:
      room.status === 'waiting' &&
      room.players.length >= MIN_PLAYERS &&
      room.players.length <= MAX_PLAYERS &&
      room.players.every((p) => p.tutorialDone) &&
      room.players.every((p) => p.ready),
  };
}
