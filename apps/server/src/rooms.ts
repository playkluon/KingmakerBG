// 기반 스킬: skills/server-rooms/SKILL.md
// 방 생성/입장/ready/start — MVP 저장소는 서버 메모리 Map (부록 A-2: 계정·DB 없음, 방은 휘발성)
import { randomUUID } from 'node:crypto';
import { reduce, setupGame } from '@kingmakers/engine';
import type { CardCatalog, DrawPiles, GameState, PlayerId } from '@kingmakers/engine';
import { AGENDAS, buildCardCatalog, CANDIDATES, CANDIDATE_EVENTS, ISSUES, PROMISES, VOTERS, VOTER_EVENTS } from '@kingmakers/data';

export interface RoomPlayer {
  /** playerToken (uuid) — 재접속·권한 검증의 근거 (부록 A-2) */
  token: string;
  name: string;
  ready: boolean;
  /** 게임 시작 시 랜덤 좌석 배정으로 확정 (§21) */
  playerId: PlayerId | null;
}

export interface Room {
  id: string;
  hostToken: string;
  hostName: string;
  status: 'waiting' | 'playing';
  players: RoomPlayer[];
  game: GameState | null;
}

/** 방 관련 실패는 throw가 아니라 사유 문자열로 돌려준다 (CLAUDE.md — 서버가 해당 소켓에만 회신) */
export type RoomResult<T> = { ok: true; value: T } | { ok: false; reason: string };

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

export function createRoom(hostName: string): RoomResult<Room> {
  const name = hostName.trim();
  if (!name) return { ok: false, reason: '호스트 이름을 입력하세요' };
  const room: Room = {
    id: newRoomId(),
    hostToken: randomUUID(),
    hostName: name,
    status: 'waiting',
    players: [],
    game: null,
  };
  rooms.set(room.id, room);
  return { ok: true, value: room };
}

export function joinRoom(roomId: string, playerName: string): RoomResult<{ room: Room; token: string }> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작된 방입니다' };
  if (room.players.length >= 7) return { ok: false, reason: '정원(7명)이 가득 찼습니다' };
  const name = playerName.trim();
  if (!name) return { ok: false, reason: '이름을 입력하세요' };
  if (room.players.some((p) => p.name === name)) return { ok: false, reason: '이미 사용 중인 이름입니다' };

  const player: RoomPlayer = { token: randomUUID(), name, ready: false, playerId: null };
  room.players.push(player);
  return { ok: true, value: { room, token: player.token } };
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

/**
 * §21: 모두 준비되면 호스트가 시작 → 시스템이 좌석을 랜덤 배정.
 * seed는 서버가 생성해 GameState에 기록한다 (엔진 내부 Math.random 금지 — 부록 A-5).
 */
export function startGame(roomId: string, token: string): RoomResult<Room> {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: '존재하지 않는 방입니다' };
  if (token !== room.hostToken) return { ok: false, reason: '게임 시작은 호스트만 할 수 있습니다' };
  if (room.status !== 'waiting') return { ok: false, reason: '이미 게임이 시작되었습니다' };
  if (room.players.length < 4 || room.players.length > 7) {
    return { ok: false, reason: `4~7명이 필요합니다 (현재 ${room.players.length}명)` };
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
    maxPlayers: 7,
    minPlayers: 4,
    players: room.players.map((p) => ({ name: p.name, ready: p.ready, playerId: p.playerId })),
    canStart: room.status === 'waiting' && room.players.length >= 4 && room.players.length <= 7 && room.players.every((p) => p.ready),
  };
}
