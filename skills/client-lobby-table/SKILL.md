---
name: client-lobby-table
description: 방 생성/로비 + 공용 table(호스트) 화면 + spectator 화면
---

# Skill 9 — 클라이언트: 로비·테이블 화면 (§26 4단계)

참조: GAME_SPEC.md §21(URL/화면 개념), §22(UI 원칙), §19(시스템 진행 잠금)

## 생성 파일
```
apps/client/src/
  socket/connection.ts      # 소켓 연결, playerToken localStorage, 재연결 백오프
  stores/roomStore.ts  stores/gameStore.ts   # Zustand — 서버 뷰를 그대로 보관
  screens/HomeScreen.tsx    # 방 만들기 / 초대 링크로 입장 (마케팅 페이지 아님 — §22)
  screens/LobbyScreen.tsx   # 참가자 목록 + ready 상태 + 호스트 시작 버튼만
  screens/TableScreen.tsx   # /room/:id/table — 공용 진행 화면
  screens/SpectatorScreen.tsx # /room/:id/watch — TableScreen 재사용, 진행 버튼 없음
  components/PolicyTracks.tsx   # 5트랙 -2..2, 이동 하이라이트
  components/CandidateBoard.tsx # 공개 후보/출마 후보/확정 공약/현재 표
  components/VoterBoard.tsx     # 공개 유권자, controller 표시, 배치 화살표
  components/PlayerPanels.tsx   # 좌석별 공개 자원(money/org/rep/VP), 캠프 슬롯 배지
  components/PhaseHeader.tsx    # 라운드 n/5 · phase · active player · 대기 중인 결정
  components/ActionLog.tsx      # ActionLogEntry.summary 스트림
```

## 라우팅
`/` 홈 → `/room/:id` 로비 → 시작 시 역할별 분기: 참가자는 `/room/:id/play`(Skill 10), 그 외 `/room/:id/table`, 관전 `/room/:id/watch`

## 규칙
- 스토어는 서버 `game:view`를 그대로 보관 — **클라이언트 룰 계산 금지**, 파생 표시값은 engine의 selectors만 사용
- TableScreen의 "진행" 버튼(runUntilPlayerAction)은 플레이어 결정 대기 중 비활성 + "OO의 결정을 기다리는 중" 표시 (§19)
- 시스템 진행과 플레이어 액션 UI를 시각적으로 명확히 분리 (§22)
- 모든 문구 한국어

## 수용 기준
- 브라우저 4개(호스트 table 1 + 참가자 3)로 방 생성→ready→시작→좌석 배정 동작
- 결정 대기 중 진행 버튼이 잠기고 누구를 기다리는지 보임
- table/spectator 화면에 비밀 정보가 렌더링될 데이터 자체가 없음
