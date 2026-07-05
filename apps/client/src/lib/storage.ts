// 기반 스킬: skills/server-rooms/SKILL.md (부록 A-2)
// playerToken/hostToken을 localStorage에 보관 — 새로고침·재접속 시 좌석 복원의 근거

type StorageKind = 'player' | 'host' | 'name';

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

/** 이 방에서 내가 쓸 토큰 — 호스트 토큰 우선 (호스트가 참가자를 겸하지 않는다, §20) */
export function loadAnyToken(roomId: string): string | null {
  return loadHostToken(roomId) ?? loadPlayerToken(roomId);
}

/** 내가 입력한 이름 — 새로고침 후 로비에서 "내 준비 상태"를 roomState.players에서 찾기 위해 필요하다 */
export function saveMyName(roomId: string, name: string): void {
  localStorage.setItem(key(roomId, 'name'), name);
}

export function loadMyName(roomId: string): string | null {
  return localStorage.getItem(key(roomId, 'name'));
}
