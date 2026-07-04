# 킹메이커스: 민심 경매 — 페이즈별 개발 계획

기준 문서: `docs/GAME_SPEC.md`(룰 단일 진실), `CLAUDE.md`(스택·원칙), `skills/*/SKILL.md`(작업 명세)
진행 규칙: **페이즈는 순서대로. 각 페이즈의 완료 조건을 통과하기 전에는 다음 페이즈 착수 금지.**
체크박스는 진행하면서 갱신한다.

| 페이즈 | 내용 | 스킬 | 규모 | 관문 |
|---|---|---|---|---|
| 0 | 모노레포 스캐폴딩 | setup | S | |
| 1 | 엔진 코어 (타입·reducer·phase 머신) | engine-core | M | M1 |
| 2 | 카드 데이터 187장 | card-data | M | M2 |
| 3 | 1라운드 룰 완성 (엔진만) | auction-promise → voters-campaign → unification-voting → scoring(라운드분) | **L** | **M3 관문** |
| 4 | 멀티플레이 서버 + 3시점 화면 | server-rooms → client-lobby-table → client-player | **L** | **M4 관문** |
| 5 | 5라운드 풀게임 + 최종 점수 | scoring(최종분) | M | M5 |
| 6 | 플레이테스트용 UX | ux-feedback | M | M6 |
| 7 | 고급 규칙 (계약·pact·이벤트·시뮬) | advanced-rules | L | M7 |

규모: S=한 세션, M=2~3세션, L=여러 세션 (한 세션 = Claude Code 작업 한 호흡)

---

## Phase 0 — 모노레포 스캐폴딩 (skills/setup)

목표: `pnpm dev` 한 번으로 서버+클라이언트가 뜨고, 빈 테스트가 도는 뼈대.

- [ ] pnpm-workspace.yaml + 루트 package.json (dev/build/test 스크립트)
- [ ] tsconfig.base.json (strict), .gitignore, .env.example
- [ ] packages/engine (의존성 0, vitest), packages/data
- [ ] apps/server (Express + Socket.IO 부팅만), apps/client (Vite react-ts)
- [ ] git 초기화 + 첫 커밋

**완료 조건**: `pnpm install && pnpm -r build && pnpm test` 통과, `pnpm dev`로 :3001/:5173 기동 + 소켓 연결 로그 확인.

> 착수 지시: "skills/setup/SKILL.md 대로 Phase 0 진행해줘"

---

## Phase 1 — 엔진 코어 (skills/engine-core) → M1

목표: 룰은 비어 있어도 **게임의 뼈대(상태·액션·페이즈 흐름)가 결정적으로 도는** 엔진.

- [ ] types/ids.ts — §18 템플릿 리터럴 ID 7종
- [ ] types/state.ts — GameState·RoundState·PlayerState·DrawPiles·ActionLogEntry·RoundHistoryEntry·RoundResultSummary (schemaVersion "0.2")
- [ ] types/actions.ts — 시스템 액션 16종 + 플레이어 액션 17종 유니온
- [ ] constants.ts — 인원별 설정표(§3)·시작 자원(§5)·트랙(§6)·액션 비용표(§11)·scoring v1 수치(§15)
- [ ] rng.ts — mulberry32, RNG 상태를 GameState에 보관
- [ ] phases.ts — phase 16종: 허용 액션 집합 + 자동 진행 가능 여부
- [ ] reducer.ts — `reduce(state, action) → { state, log } | { ok:false, reason }` 골격 (각 phase 처리는 TODO 스텁)
- [ ] system.ts — runSystemStep / runUntilPlayerAction / advancePhase
- [ ] setup.ts — seed 셔플·좌석·비밀 의제 배분 (임시 카드 데이터로)
- [ ] log.ts — ActionLogEntry 생성 헬퍼 (한국어 summary)
- [ ] selectors/ — getPendingDecision 등 UI용 파생값 (골격)

**완료 조건 (M1)**:
- [ ] 같은 seed → 같은 setup (테스트)
- [ ] 4/5/6/7인 설정이 §3 표와 일치 (테스트)
- [ ] 같은 seed + 같은 액션 시퀀스 재생 = 동일 상태 (테스트)
- [ ] 잘못된 phase 액션 → 한국어 사유와 함께 거부 (테스트)

> 착수 지시: "skills/engine-core/SKILL.md 대로 Phase 1 진행해줘"

---

## Phase 2 — 카드 데이터 (skills/card-data) → M2

목표: 187장 전체 데이터 + 스키마. **테마 텍스트는 한국어 신규 창작, 수량·구조는 §4 고정.**

- [ ] tags.ts — 태그 어휘 중앙화 (공약 반응 태그 = 유권자 선호 태그 동일 어휘)
- [ ] schemas.ts — zod 6종 카드 스키마 (효과는 판별 유니온 타입)
- [ ] candidates.ts 21장 — 기본 표·성향·당선 효과(4유형 배분)·능력/약점(MVP 활성 3종만 active)
- [ ] promises.ts 30장 — 트랙/방향 + 즉시 효과 5유형 배분
- [ ] voters.ts 48장 — 그룹·표 수·선호/싫어함/직접충돌 태그
- [ ] issues.ts 15장, candidateEvents.ts 30장 / voterEvents.ts 30장 (effect: todo)
- [ ] agendas.ts 16장 — §17 조건 11유형 조합, 배점 8~13 VP
- [ ] integrity.test.ts — 수량·ID 유일성·태그 참조 무결성

**완료 조건 (M2)**: 무결성 테스트 전체 통과 + Phase 1의 setup.ts가 실데이터로 교체되어도 결정성 테스트 유지.

> 착수 지시: "skills/card-data/SKILL.md 대로 Phase 2 진행해줘"

---

## Phase 3 — 1라운드 룰 완성 (엔진만) → **M3 관문**

목표: **UI 없이 엔진 테스트만으로 4인 1라운드가 끝까지 플레이된다.** 브리프의 첫 목표(§27).
스킬 4개를 순서대로, 각각 테스트 통과 후 다음으로.

### 3-A. 경매·공약 (skills/auction-promise)
- [ ] placeBid/confirmAuctionBids, 동시 공개, 상위 3 출마
- [ ] 동점 3단계(후원자 수→rep→id), 전액 소비/절반 환급(내림)
- [ ] majorBacker / coBacker(2+) / organizer(6-7인) 배정
- [ ] 공약 3장 제시 → selectPromise, autoSelectPromises fallback, 즉시 효과 5유형(1회 제한)
- [ ] setAuctionMode(공개 순차 = 디버그), generateRandomBids

### 3-B. 유권자·캠페인 (skills/voters-campaign)
- [ ] 통제 판정(단독 1등만), assignVoterChoice(무료·재배치·마지막 적용)
- [ ] 캠페인 7액션 + 비용 검증 + 라운드로빈 2액션
- [ ] MVP 활성 능력 3종 (모금+1/노동자 접촉-1/압박-1)
- [ ] poll 비활성 플래그, useEvent 거부 스텁

### 3-C. 단일화·투표·정책 (skills/unification-voting)
- [ ] propose/accept/decline/skip 흐름, 이전 비율 70/50/30 자동 판정·내림, 직접 충돌 불가
- [ ] 투표 5요소 합산 + 동점 4단계, 표 출처 분해(RoundResultSummary)
- [ ] 정책 4순서 (③단일화 양보는 no-op 훅), 압박 비교 최대 2트랙, −2..+2 클램프
- [ ] 당선 효과 4유형 + electionEffectSelection + fallback

### 3-D. 라운드 점수 (skills/scoring 라운드분)
- [ ] scoring v1 전 항목 + VP 사유 effects 기록
- [ ] 통제 유권자 VP 상한(4-5인 1 / 6-7인 2), 킹메이커 +2
- [ ] cleanup에서 RoundHistoryEntry 기록 + 영향력 마커 누적

**완료 조건 (M3 관문)**:
- [ ] §28 테스트 목록 중 엔진 항목 전부 통과
- [ ] **통합 테스트: seed 고정 4인 1라운드 시나리오가 income→cleanup까지 액션 시퀀스로 완주**, 최종 상태 스냅샷 일치
- [ ] runUntilPlayerAction이 결정 지점 6곳에서만 멈춤을 검증하는 테스트

> 착수 지시: "Phase 3 진행해줘. skills/auction-promise → voters-campaign → unification-voting → scoring 순서로, 각 스킬 테스트 통과 후 다음으로 넘어가줘"

---

## Phase 4 — 멀티플레이 서버 + 3시점 화면 → **M4 관문**

목표: **브라우저 4개(개인 화면)로 실제 1라운드 완주.** 마스킹·재접속·권한의 실전 검증.

### 4-A. 서버 (skills/server-rooms)
- [ ] 방 생성/초대 링크/이름 입장/ready/host start/랜덤 좌석 (메모리 Map)
- [ ] playerToken 발급·localStorage 복원·재접속 시 뷰 재전송
- [ ] projectView — table/player-{seat}/spectator 마스킹 (경매 중 bidsConfirmed만 공개)
- [ ] 액션 권한 검증 (좌석·차례·호스트·관전자), action:rejected 회신
- [ ] **마스킹 테스트: player 뷰 payload에 타인 비밀 의제·입찰이 물리적으로 없음**

### 4-B. 로비·테이블 화면 (skills/client-lobby-table)
- [ ] 소켓 연결/재연결, roomStore/gameStore (서버 뷰 그대로 보관)
- [ ] Home(방 만들기/링크 입장) → Lobby(목록·ready·시작만)
- [ ] TableScreen: PhaseHeader·PolicyTracks·CandidateBoard·VoterBoard·PlayerPanels·ActionLog
- [ ] 진행 버튼: 결정 대기 중 잠금 + "OO을 기다리는 중", SpectatorScreen(진행 버튼 없음)

### 4-C. 플레이어 개인 화면 (skills/client-player)
- [ ] TodoBanner (getPendingDecision 셀렉터 기반 — 항상 비어 있지 않음)
- [ ] MyResources·SecretAgenda(개인 화면 전용)·ActionPanel(현재 phase 액션만 활성)
- [ ] BidPanel(배분·확정·잠금)·PromisePicker·CampaignActions·AssignVoter·UnificationPanel·ElectionEffectPicker
- [ ] 액션 결과 즉시 토스트 (game:log 기반, 최소 구현)

**완료 조건 (M4 관문)**:
- [ ] 브라우저 4개 + table 1개로 방 생성→ready→시작→1라운드 완주 (수동 검증)
- [ ] 게임 중 새로고침 → 좌석·화면 복원
- [ ] 비차례 액션이 UI에서 잠기고, 우회 전송해도 서버가 거부
- [ ] 클라이언트 코드에 룰 계산 없음 (리뷰 체크)

> 착수 지시: "Phase 4 진행해줘. skills/server-rooms → client-lobby-table → client-player 순서로"

---

## Phase 5 — 5라운드 풀게임 + 최종 점수 (skills/scoring 완성) → M5

- [ ] nextRound 루프 — 덱 소진 처리, 라운드 간 상태 이월(정책·자원·마커·히스토리)
- [ ] agendas.ts — 조건 11유형 평가기 (RoundHistoryEntry 참조 필수)
- [ ] finalScoring — 공개 VP + 의제 + money/5 + rep 단독 1등 +2 + 공개 계약(현재 0)
- [ ] 동점 v0.3 5단계, 전원 의제 공개 + score breakdown
- [ ] FinalResults 화면 연결 (최소 표시)

**완료 조건 (M5)**:
- [ ] 의제 16장 각각 달성/미달 테스트 (히스토리 참조 케이스 포함)
- [ ] seed 고정 4인 5라운드 자동 완주 테스트 + 승자 점수 30~45 VP 목표대 확인(±10, 벗어나면 리포트만 남기고 통과)
- [ ] 브라우저 4개로 5라운드 실제 완주 1회

> 착수 지시: "Phase 5 진행해줘. skills/scoring의 최종 점수·의제 평가기 완성"

---

## Phase 6 — 플레이테스트용 UX (skills/ux-feedback) → M6

- [ ] EffectToast — effects[] 구조화 렌더 ("누구에게 무엇이")
- [ ] ScoreRoute — 내 점수 루트 (엔진 셀렉터 기반)
- [ ] RoundSummary — 플레이어별 VP + 사유 오버레이
- [ ] RoundGoals — 라운드 종료까지 남은 조건, 목표 점수대 상시 표시
- [ ] FinalResults 완성 — "무엇이 승패를 갈랐나" 비중 표시
- [ ] terms.ts 용어 사전 — majorBacker→주요 후원자 등, 개발자 용어 노출 전수 제거
- [ ] OnboardingHints — phase 첫 진입 1회성 힌트

**완료 조건 (M6)**: 게임을 모르는 사람 1명 플레이테스트 — 로그를 읽지 않고 ①방금 일어난 일 ②지금 할 일 ③이기는 방법을 말할 수 있으면 통과. 이후 **밸런스 피드백은 constants.ts 수치 조정으로만 반영.**

> 착수 지시: "Phase 6 진행해줘. skills/ux-feedback"

---

## Phase 7 — 고급 규칙 (skills/advanced-rules) → M7

**착수 조건: Phase 3~5 완료 + 4인 플레이테스트 1회 이상.** 우선순위 순서 고정:

1. [ ] 단일화 공개 조건 계약 (정책 양보 → policy 3순서 훅 연결, 이행 수 → 최종 보너스 연결)
2. [ ] 비밀 pact + 배신 (마스킹, rep −2·유권자 이벤트 2장·플래그)
3. [ ] 이벤트 카드 효과 60장 (useEvent 활성화 — 손패 상한·타이밍 먼저 확정해 GAME_SPEC 부록 추가)
4. [ ] 후보 능력/약점 확장 (1종 = 테스트 1세트), poll 활성화
5. [ ] 밸런스 시뮬레이션 — bot 자동 대전 N회, 점수 분포·의제 달성률 리포트 (seed 고정 CI 재현)

**완료 조건 (M7)**: 공개 계약 불이행 경로 부재, pact 마스킹 테스트, 시뮬 리포트 재현.

---

## 페이즈 공통 규칙

- 각 페이즈 완료 시 커밋 (메시지에 페이즈 번호), 이 문서 체크박스 갱신
- 룰 해석이 갈리면 코드가 아니라 **GAME_SPEC.md 확인 → 미정이면 부록 A에 결정 추가 후 구현**
- 엔진 수정 시 결정성 테스트(재생 일치)가 항상 통과 상태 유지
- Phase 3 이후 밸런스 조정은 constants.ts와 카드 데이터에서만
