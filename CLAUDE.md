# 킹메이커스: 민심 경매 — CLAUDE.md

## 프로젝트 개요
정치 브로커 온라인 보드게임의 새 스택 이식 프로젝트.
플레이어는 후보자가 아니라 브로커로서 후보 경매 → 공약 선택 → 유권자 조작 → 캠페인 액션 → 단일화 → 투표 → 정책 변화 → 점수 정산 루프를 4~7인(1차 기준 4인), 5라운드로 플레이한다.

> **룰의 단일 진실은 `docs/GAME_SPEC.md`다** (룰 v0.3 / scoring v1 / schemaVersion 0.2).
> 이 파일이나 스킬 문서가 GAME_SPEC.md와 충돌하면 GAME_SPEC.md가 우선한다.
> 규칙 관련 작업 전에 반드시 GAME_SPEC.md의 해당 장을 읽는다.

## 기술 스택
- **언어**: TypeScript 5.x 단일 언어 (엔진 타입·로직을 서버와 클라이언트가 공유)
- **모노레포**: pnpm workspaces
  - `packages/engine` — 순수 룰 엔진: GameState, GameAction, reducer, phase 진행. **외부 의존성 0**
  - `packages/data` — 카드 데이터(후보 21, 공약 30, 유권자 48, 이슈 15, 이벤트 30+30, 비밀 의제 16) + zod 스키마
  - `apps/server` — Node 20+, Express + Socket.IO. 권위 서버, 방/좌석 관리, 뷰 마스킹
  - `apps/client` — React 18 + Vite, Zustand, socket.io-client, CSS Modules (UI 라이브러리 금지)
- **테스트**: Vitest — GAME_SPEC.md §28 최소 테스트 목록 전체를 엔진 단위 테스트로 커버
- **저장소**: MVP는 서버 메모리(Map). 계정/DB 없음 — KLUON식 초대 링크 + playerToken(uuid) 재접속

## 아키텍처 원칙 (GAME_SPEC.md §2, §19-20, 부록 A — 반드시 준수)
1. **UI는 룰을 계산하지 않는다**: GameState를 표시하고 GameAction을 dispatch만 한다. 표 계산·점수 예측을 클라이언트에서 구현하지 않는다.
2. **모든 룰 계산은 순수 reducer**: `reduce(state, action) -> { state, log }`. 불변 업데이트, 소켓/네트워크 코드와 절대 섞지 않는다.
3. **권위 서버 + 뷰 마스킹**: reducer는 서버에서만 실행. 클라이언트에는 `projectView(state, viewer)` 결과만 전송 (viewer: `table` | `player-{seat}` | `spectator`). 비밀 정보(타인 비밀 의제, 경매 중 타인 입찰, 타인 손패)는 CSS 숨김이 아니라 **데이터 자체를 보내지 않는다**.
4. **시스템/플레이어 액션 분리**: 자동 처리 가능한 단계는 `runUntilPlayerAction`으로 자동 진행하고, 플레이어 결정 지점에서만 멈춘다. 플레이어 결정 중에는 시스템 진행이 잠긴다.
5. **결정성**: 엔진 내 `Date.now()`, `Math.random()` 금지. RNG는 seed 기반(mulberry32) 주입. 모든 동점 처리는 id 기준 결정적 순서로 끝난다. 같은 seed + 같은 액션 시퀀스 = 같은 상태.
6. **액션 로그가 UX의 근거**: 모든 처리 결과는 `ActionLogEntry { seq, phase, actor, action, summary(한국어), effects[] }`로 남긴다. "방금 무슨 일이 일어났는지"는 UI가 이 로그로 보여준다.
7. **액션 권한**: 참가자는 자기 좌석의 액션만, 호스트는 시스템 진행과 방 관리만, 관전자는 액션 불가. 서버가 소켓 세션의 playerToken으로 검증한다.

## 코딩 규칙
- 모든 함수에 한국어 주석 포함
- 파일 상단에 `// 기반 스킬: skills/<name>/SKILL.md` 주석 추가
- 게임 수치·인원별 설정표·비용표는 전부 `packages/engine/src/constants.ts` 한 곳에 정의 (카드 데이터는 packages/data)
- 엔진 코드는 GAME_SPEC.md 장 번호를 주석으로 인용 (예: `// §8 출마 후보 동점 처리`)
- 사용자 노출 문구(로그 summary, UI, 에러)는 전부 한국어
- 액션 검증 실패는 throw가 아니라 `{ ok: false, reason }` 반환 — 서버가 해당 플레이어에게만 사유 회신
- 클라이언트에서 `innerHTML` 금지, 엔진 함수 import는 타입·셀렉터·포매터만 허용 (reducer 호출 금지)

## 라운드 흐름 요약 (상세는 GAME_SPEC.md §7, §18)
```
income → issueReveal → candidateReveal → auctionBidding → auctionResolved
→ promiseSelection → voterReveal → campaignActions → unification → voting
→ electionEffectSelection → policyResolution → roundScoring → cleanup
→ (다음 라운드 income 또는 gameEnd)
```
플레이어 결정 단계: 입찰, 공약 선택, 캠페인 액션(2회, 라운드로빈), 유권자 배치, 단일화 제안/수락/거절/스킵, 선택형 당선 효과. 나머지는 전부 시스템 자동 진행.

## 스킬 요구사항 (GAME_SPEC.md §26 이식 우선순위 기준)

### Skill 1 — 모노레포 초기 설정 (skills/setup/SKILL.md) — 1단계 준비
pnpm workspaces, packages/engine·data + apps/server·client 골격, tsconfig, Vitest, 개발 스크립트.

### Skill 2 — 엔진 코어 (skills/engine-core/SKILL.md) — 1단계
GameState/GameAction 타입, reducer 골격, phase 상태 머신 16종, seed RNG, runUntilPlayerAction, 액션 로그, 인원별 설정표.

### Skill 3 — 카드 데이터 (skills/card-data/SKILL.md) — 2단계
카드 7종 데이터셋(21/30/48/15/30/30/16) + zod 스키마 + 무결성 테스트. 이벤트는 데이터만.

### Skill 4 — 경매·공약 (skills/auction-promise/SKILL.md) — 3단계
동시 비공개 입찰, 상위 3명 출마, 동점 처리, 절반 환급, 캠프 슬롯 배정, majorBacker 공약 선택 + fallback.

### Skill 5 — 유권자·캠페인 액션 (skills/voters-campaign/SKILL.md) — 3단계
유권자 통제/배치/자동 투표, 캠페인 액션 7종 + 라운드로빈 2액션, MVP 활성 후보 능력 3종.

### Skill 6 — 단일화·투표·정책 (skills/unification-voting/SKILL.md) — 3단계
단일화 제안/수락/거절/스킵 + 이전 비율 70/50/30, 투표 합산·동점 처리, 정책 변화 4순서 + 당선 효과 4유형.

### Skill 7 — 점수·비밀 의제 (skills/scoring/SKILL.md) — 3단계+5단계
scoring v1 라운드 점수, 라운드 히스토리 누적, 비밀 의제 조건 11유형 평가기, 최종 점수·동점 판정.

### Skill 8 — 서버: 방·좌석·마스킹 (skills/server-rooms/SKILL.md) — 4단계
방 생성/초대 링크/ready/host start/랜덤 좌석, playerToken 재접속, projectView 마스킹, 액션 권한 검증.

### Skill 9 — 클라이언트: 로비·테이블 화면 (skills/client-lobby-table/SKILL.md) — 4단계
방 생성/입장/로비, table(호스트) 공용 화면, spectator 화면.

### Skill 10 — 클라이언트: 플레이어 개인 화면 (skills/client-player/SKILL.md) — 4단계
좌석 개인 화면: 액션 패널, "지금 해야 할 일" 안내, 비밀 의제, 입찰 UI, 배치 UI.

### Skill 11 — 플레이어 친화 UX (skills/ux-feedback/SKILL.md) — 6단계
액션 결과 즉시 피드백, 점수 획득 이유, 내 점수 루트, 라운드 종료 조건 표시, 온보딩 힌트.

### Skill 12 — 고급 규칙 (skills/advanced-rules/SKILL.md) — 7단계 (후순위)
단일화 계약, 비밀 pact/배신, 이벤트 카드 효과, 후보 능력 확장, 밸런스 시뮬레이션. 3~5단계 완료 전 착수 금지.

## 마일스톤 (GAME_SPEC.md §26 매핑)
- **M1** = Skill 1~2: 엔진 골격 + seed 결정성 테스트 통과
- **M2** = Skill 3: 카드 데이터 완비
- **M3** = Skill 4~7: **4인 1라운드가 엔진 테스트로 끝까지 플레이됨** (첫 핵심 목표)
- **M4** = Skill 8~10: 브라우저 4개로 방 생성→좌석 배정→1라운드 완주
- **M5** = 5라운드 풀게임 + 최종 점수 (Skill 7 완성분 연결)
- **M6** = Skill 11: 플레이테스트 가능한 UX
- **M7** = Skill 12: 고급 규칙

## MVP에서 일부러 미룰 것 (GAME_SPEC.md §29)
이벤트 카드 효과 전체, 후보 능력/약점 전체, 정교한 협상 UI, 비밀 pact UX, 애니메이션, AI/bot, 밸런스 확정. `poll` 액션은 타입만 만들고 비활성 플래그(부록 A-4).

## 환경변수 (.env)
PORT, CORS_ORIGIN, VITE_SERVER_URL
