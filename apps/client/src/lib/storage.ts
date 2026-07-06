// 기반 스킬: skills/server-rooms/SKILL.md (부록 A-2, A-22)
// playerToken/hostToken/spectatorToken을 localStorage에 보관 — 새로고침·재접속 시 좌석/관전 상태 복원의 근거

type StorageKind = 'player' | 'host' | 'spectator' | 'name';

function key(roomId: string, kind: StorageKind): string {
  return `kingmakers:${roomId}:${kind}Token`;
}

/** 참가자 토큰 저장 */
export function savePlayerToken(roomId: string, token: string): void {
  localStorage.setItem(key(roomId, 'player'), token);
}

export function loadPlayerToken(roomId: string): string | null {
  return localStorage.getItem(key(roomId, 'player'));
}

/** 호스트 토큰 저장 */
export function saveHostToken(roomId: string, token: string): void {
  localStorage.setItem(key(roomId, 'host'), token);
}

export function loadHostToken(roomId: string): string | null {
  return localStorage.getItem(key(roomId, 'host'));
}

/** 관전자 토큰 저장 (부록 A-22) */
export function saveSpectatorToken(roomId: string, token: string): void {
  localStorage.setItem(key(roomId, 'spectator'), token);
}

export function loadSpectatorToken(roomId: string): string | null {
  return localStorage.getItem(key(roomId, 'spectator'));
}

/**
 * 이 방에서 내가 쓸 토큰 — 호스트 토큰 우선.
 * 부록 A-22: 호스트가 참가자를 겸하는 방은 hostToken을 그대로 참가자 토큰으로도 쓰므로 하나만 저장돼 있어도 충분하다.
 */
export function loadAnyToken(roomId: string): string | null {
  return loadHostToken(roomId) ?? loadPlayerToken(roomId) ?? loadSpectatorToken(roomId);
}

/** 내가 입력한 이름 — 새로고침 후 로비에서 "내 준비 상태"를 roomState.players에서 찾기 위해 필요하다 */
export function saveMyName(roomId: string, name: string): void {
  localStorage.setItem(key(roomId, 'name'), name);
}

export function loadMyName(roomId: string): string | null {
  return localStorage.getItem(key(roomId, 'name'));
}

/** 방 나가기·방 종료(부록 A-22) 시 이 방에 대한 로컬 토큰을 전부 지운다 — 안 지우면 다음 방문에 유령 재접속이 시도된다 */
export function clearRoomTokens(roomId: string): void {
  localStorage.removeItem(key(roomId, 'player'));
  localStorage.removeItem(key(roomId, 'host'));
  localStorage.removeItem(key(roomId, 'spectator'));
  localStorage.removeItem(key(roomId, 'name'));
}
