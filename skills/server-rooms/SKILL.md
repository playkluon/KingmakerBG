---
name: server-rooms
description: 권위 서버 — 방/초대 링크/좌석, playerToken 재접속, projectView 마스킹, 액션 권한
---

# Skill 8 — 서버: 방·좌석·마스킹 (§26 4단계)

참조: GAME_SPEC.md §20(액션 권한), §21(방/멀티플레이 흐름), §22(비밀 의제 노출), 부록 A-2(계정 없음), A-3(마스킹)

## 생성 파일
```
apps/server/src/
  index.ts        # Express + Socket.IO 부팅, CORS
  rooms.ts        # 방 생성/입장/ready/start, 좌석 랜덤 배정, 메모리 Map 저장
  views.ts        # projectView(state, viewer) — table | player-{seat} | spectator
  sockets.ts      # 소켓 이벤트 핸들러 (엔진 호출 + 뷰 전송만, 룰 로직 금지)
  tokens.ts       # playerToken(uuid) 발급/검증
```

## 방 흐름 (§21 KLUON식)
1. `POST /rooms` 또는 소켓 `room:create` → roomId 발급, 생성자가 호스트
2. 초대 링크 `/room/:roomId` 공유 → 참가자는 이름 입력 후 입장 (계정 없음)
3. 입장 시 playerToken 발급 → 클라이언트 localStorage 저장
4. 전원 `준비 완료` → 호스트 `게임 시작` → 좌석 랜덤 배정 (엔진 setup, seed는 서버 생성 후 기록)
5. 진행 중 재접속: playerToken으로 좌석 복원 + 본인 뷰 전체 1회 재전송

## projectView 마스킹 (views.ts) — 이 스킬의 핵심
- `table`: 공개 정보 전부 + 시스템 진행 가능 표시. 비밀 의제·경매 중 입찰 내용·타인 손패 **제거**
- `player-{seat}`: table 공개분 + **자기** 비밀 의제, 자기 입찰, 자기 손패
- `spectator`: table과 동일하되 시스템 진행 불가
- 경매 중 타인은 `bidsConfirmed`(확정 여부)만 보임 (skills/auction-promise 계약)
- 원칙: 데이터 자체를 빼고 보낸다. 클라이언트 숨김 처리 금지

## 액션 권한 (§20)
- 플레이어 액션: 소켓 세션의 playerToken → 좌석 매칭 검증. 자기 좌석 액션만 허용
- 시스템 액션(runUntilPlayerAction 등): 호스트 또는 table 화면만. 플레이어 결정 대기 중이면 거부
- 관전자: 모든 액션 거부
- 엔진이 `{ ok: false, reason }` 반환 시 해당 소켓에만 `action:rejected { reason }` 회신

## 소켓 이벤트
| 방향 | 이벤트 | 내용 |
|---|---|---|
| C→S | room:create / room:join / room:ready / room:start | 방 흐름 |
| C→S | game:action | GameAction 그대로 (서버가 권한 검증 후 reducer 실행) |
| S→C | room:state | 로비 상태 |
| S→C | game:view | 내 viewer 기준 마스킹 뷰 (전체) |
| S→C | game:log | 새 ActionLogEntry 배열 (마스킹 적용) |
| S→C | action:rejected | 한국어 사유 |

## 수용 기준 (§28 해당분)
- player 뷰 payload에 타인 비밀 의제·입찰 데이터가 물리적으로 없음 (테스트로 검증)
- 재접속 시 좌석·뷰 복원
- 비좌석/비차례 액션, 결정 대기 중 시스템 진행이 서버에서 거부됨
- 서버에 룰 계산 코드가 없음 — 전부 engine 호출
