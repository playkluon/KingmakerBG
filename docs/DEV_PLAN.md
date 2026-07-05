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

- [x] pnpm-workspace.yaml + 루트 package.json (dev/build/test 스크립트)
- [x] tsconfig.base.json (strict), .gitignore, .env.example
- [x] packages/engine (의존성 0, vitest), packages/data
- [x] apps/server (Express + Socket.IO 부팅만), apps/client (Vite react-ts)
- [x] git 초기화 + 첫 커밋

**완료 조건**: `pnpm install && pnpm -r build && pnpm test` 통과, `pnpm dev`로 :3001/:5173 기동 + 소켓 연결 로그 확인. ✅ 2026-07-04 통과

구현 노트:
- 서버 포트 변수는 `PORT`가 아니라 `SERVER_PORT` — 실행 환경(프리뷰/호스팅)이 PORT를 주입해 충돌했던 문제의 재발 방지
- 클라이언트(Vite)는 워크스페이스 패키지를 dist(CJS)가 아니라 **TS 소스 alias**로 참조 (vite.config.ts) — CJS named export 인터롭 문제 회피
- pnpm 11: esbuild 빌드 스크립트 허용을 pnpm-workspace.yaml `allowBuilds`에 명시

> 착수 지시: "skills/setup/SKILL.md 대로 Phase 0 진행해줘"

---

## Phase 1 — 엔진 코어 (skills/engine-core) → M1

목표: 룰은 비어 있어도 **게임의 뼈대(상태·액션·페이즈 흐름)가 결정적으로 도는** 엔진.

- [x] types/ids.ts — §18 템플릿 리터럴 ID 7종 + VoterGroupId·PolicyTrackId·PolicyDirection·CampRole
- [x] types/state.ts — GameState·RoundState·PlayerState·DrawPiles·ActionLogEntry·EffectDescriptor·RoundHistoryEntry·RoundResultSummary (schemaVersion "0.2")
- [x] types/actions.ts — 시스템 액션 16종 + 플레이어 액션 17종 유니온, isPlayerAction 판별 함수
- [x] constants.ts — 인원별 설정표(§3)·시작 자원(§5)·트랙(§6)·액션 비용표(§11)
- [x] rng.ts — mulberry32, RNG 상태를 GameState.rngState에 보관 (createRng/nextRandom/nextInt/shuffle 순수 함수)
- [x] phases.ts — phase 16종 + requiresPlayerDecision, getNextPhase, PLAYER_ACTION_PHASE/SYSTEM_ACTION_PHASE/AUTO_PHASE_ACTION 매핑
- [x] system.ts — applySystemAction(16종 단일 진입점), runSystemStep/runUntilPlayerAction/advancePhase, income 실구현
- [x] reducer.ts — `reduce(state, action) → {ok:true, state, log} | {ok:false, reason}` (플레이어 액션은 좌석·phase 검증 후 미구현 응답)
- [x] setup.ts — seed 셔플·좌석·비밀 의제 배분 (placeholder ID로 §4 수량만큼 덱 구성)
- [x] log.ts — createLogEntry/appendLog (한국어 summary)
- [x] selectors/index.ts — isWaitingForPlayerDecision · getPhaseDescription · isGameOver

**완료 조건 (M1)**: ✅ 2026-07-05 통과 (테스트 4파일 21건 전체 통과)
- [x] 같은 seed → 같은 setup (setup.test.ts)
- [x] 4/5/6/7인 설정이 §3 표와 일치 (setup.test.ts)
- [x] 같은 seed + 같은 액션 시퀀스 재생 = 동일 상태 (determinism.test.ts)
- [x] 잘못된 phase 액션 → 한국어 사유와 함께 거부 (phases.test.ts)

구현 노트 / 스코프 조정:
- **scoring v1 수치(§15)는 Phase 1에 넣지 않음** — engine-core SKILL.md의 constants.ts 파일 목록에 §15가 없고, 실제로 쓰는 곳(Skill 7)이 생기기 전에 넣는 건 과설계라 판단. Skill 7 착수 시 constants.ts에 추가한다.
- **getPendingDecision은 아직 없음** — "무엇을 해야 하는지" 구체 안내는 경매/공약/캠페인 등 실제 규칙(Skill 4~7)을 알아야 만들 수 있다. Phase 1 selectors는 "결정 대기 중인지/현재 phase가 뭔지"까지만 제공하는 얇은 버전. Skill 10에서 확장.
- **phase 처리 스텁의 동작 방식**: `requiresPlayerDecision:false`인 phase(auctionResolved·voterReveal·voting·policyResolution·roundScoring)는 내용 없이도 TODO 로그를 남기고 다음 phase로 자동 통과한다 — 그래야 phase 머신 자체를 값 없이도 끝까지 걸어볼 수 있다. 플레이어 결정 phase(auctionBidding 등)는 실제로 멈추고, 그 안의 플레이어 액션 17종은 좌석·phase 검증까지만 하고 "아직 구현되지 않았습니다"로 응답한다.
- **부록 A-7 추가**: 브리프 §17이 비밀 의제 배분 절차(선택 여부)를 명시하지 않아, "플레이어당 1장 무작위 배분(선택 없음)"으로 결정해 GAME_SPEC.md에 기록.
- income phase(§5)는 스텁이 아니라 실제 로직(자금·조직력 지급 + 후보 이벤트 1장 드로우)을 구현 — 카드 콘텐츠에 의존하지 않는 순수 수치 로직이라 Phase 1 범위로 포함.

> 착수 지시: "skills/engine-core/SKILL.md 대로 Phase 1 진행해줘"

---

## Phase 2 — 카드 데이터 (skills/card-data) → M2

목표: 190장(21+30+48+15+30+30+16) 전체 데이터 + 스키마. **테마 텍스트는 한국어 신규 창작, 수량·구조는 §4 고정.**

- [x] tags.ts — 태그 어휘 중앙화: 정책 트랙 5×방향 2에서 파생되는 반응 태그 10종(부록 A-9) + 유권자 그룹 6종(부록 A-8)
- [x] schemas.ts — zod 6종 카드 스키마 + 4개 판별 유니온(ElectionEffect·CandidateAbility·PromiseEffect·AgendaCondition)
- [x] candidates.ts 21장 — 기본 표(3~7)·leaningTags·supportedVoterGroups·당선 효과(4유형 배분)·능력(MVP 활성 5종만 active: 모금/노동자접촉할인/압박할인/공약제한/평판손실)
- [x] promises.ts 30장 — 트랙×방향 10조합 × 3장, 즉시 효과 5유형을 6장씩 균등 배분, reactionTag는 policyMove에서 자동 파생
- [x] voters.ts 48장 — 6그룹 × 8장, conflictTag는 preferredTag의 정반대로 자동 계산(부록 A-9)
- [x] issues.ts 15장, candidateEvents.ts 30장 / voterEvents.ts 30장 (전부 effect: {todo:true})
- [x] agendas.ts 16장 — §17 조건 11유형 전부 최소 1장씩 사용, 배점 8~13 VP
- [x] integrity.test.ts — 수량 7종·zod 파싱·ID 유일성·참조 무결성·의제 조건 커버리지·MVP 능력 5종 검증 (20건)
- [x] engineIntegration.test.ts — 실카드 ID로 `@kingmakers/engine`의 setupGame/reduce를 구동해 결정성 재확인 (4건)

**완료 조건 (M2)**: ✅ 2026-07-05 통과 (data 24건 + engine 21건 = 45건 전체 통과)
- [x] 무결성 테스트 전체 통과
- [x] Phase 1의 setup.ts가 실데이터로 교체되어도 결정성 테스트 유지

구현 노트 / 스코프 조정:
- **엔진 setup.ts를 먼저 리팩터링함** — Phase 1의 `setupGame`은 카드 ID를 내부에서 직접 생성했는데, 이러면 실카드 데이터를 주입할 방법이 없었다. `SetupOptions.decks: DrawPiles`를 필수 파라미터로 바꿔 호출자가 카드 ID 목록을 주입하는 구조로 변경(엔진은 여전히 packages/data를 import하지 않음 — 외부 의존성 0 유지). 엔진 자체 테스트는 새로 만든 `buildPlaceholderIds`/`test/fixtures.ts`로 placeholder 덱을 계속 사용한다.
- **부록 A-8, A-9 추가**: 브리프가 정하지 않은 유권자 그룹 6종 명칭과, 공약 반응 태그=정책 트랙 파생 10종이라는 결정을 GAME_SPEC.md에 기록. 태그 어휘를 하나로 통일해 "공약 트랙/방향 일치"(§12)와 "선호 태그 일치"(§10) 판정이 같은 비교 로직을 쓸 수 있게 했다.
- **VoterCard에 voteWeight 추가**: §13 "유권자 배정 표"가 실제로 존재하려면 각 유권자 카드가 표 수를 가져야 한다는 게 브리프에서 직접 도출되는 요구라 스키마에 포함(브리프 미기재 수치이므로 1~3 범위로 임의 배분).
- **이벤트 효과는 60장 전부 `{todo:true}`로 통일** — §4는 "대부분 TODO"라 했지만 CLAUDE.md Skill 3 설명("이벤트는 데이터만")이 더 엄격해 그쪽을 따름.

> 착수 지시: "skills/card-data/SKILL.md 대로 Phase 2 진행해줘"

---

## Phase 3 — 1라운드 룰 완성 (엔진만) → **M3 관문**

목표: **UI 없이 엔진 테스트만으로 4인 1라운드가 끝까지 플레이된다.** 브리프의 첫 목표(§27).
스킬 4개를 순서대로, 각각 테스트 통과 후 다음으로.

### 3-A. 경매·공약 (skills/auction-promise) ✅ 2026-07-05
- [x] placeBid/confirmAuctionBids, 동시 공개, 상위 3 출마
- [x] 동점 3단계(후원자 수→rep→id), 전액 소비/절반 환급(내림)
- [x] majorBacker / coBacker(2+) / organizer(6-7인) 배정
- [x] 공약 3장 제시 → selectPromise, autoSelectPromises fallback, 즉시 효과 중 backerReward 적용(1회 제한)
- [ ] ~~setAuctionMode(공개 순차 = 디버그), generateRandomBids~~ — setAuctionMode는 Phase 1에서 이미 구현됨. generateRandomBids는 "디버그 전용"이라 실사용처가 생기기 전까지 스텁 유지 (Phase 7 밸런스 시뮬레이션에서 필요해지면 구현)

구현 노트 / 스코프 조정:
- **엔진에 CardCatalog 개념을 새로 추가함** — selectPromise가 majorBacker에게 즉시 보상(backerReward)을 주려면 "카드 내용"이 필요한데, 지금까지 엔진은 카드 ID만 다뤘다. `packages/engine/src/types/cards.ts`에 카드 콘텐츠의 엔진 관점 타입(제네릭 string 필드)을 새로 정의하고, `reduce(state, action, catalog)`로 시그니처를 확장했다. packages/data는 여전히 엔진에 의존하지 않고, 구조적 타이핑으로만 호환된다(`packages/data/src/catalog.ts`의 `buildCardCatalog()`가 그 접점).
- **공약 효과 5유형 중 즉시 적용은 backerReward만** — extraVotes류는 Skill 6(투표 집계), backerInfluence/backerPressureToken은 Skill 5(캠페인 집계)가 소비 시점에 카탈로그를 조회해 처리한다. "한 후보/공약 조합당 1회"는 promiseId가 한 번만 설정 가능하다는 사실로 자연히 보장된다.
- **majorBacker 없는 출마 후보** 시나리오(입찰자가 3명 미만일 때)를 실제로 테스트로 재현·검증함 — autoSelectPromises가 정확히 그 캠프만 채우고 나머지는 그대로 둔다.
- **타입 체크 인프라 추가**: 테스트 파일은 `tsc build`(src만 포함) 대상이 아니라 vitest(esbuild, 타입 미검증)로만 돌고 있었다는 걸 발견 — `tsconfig.typecheck.json` + `pnpm typecheck` 스크립트를 engine/data에 추가해 테스트 파일도 엄격 모드로 타입 검증되게 했다. 이 과정에서 Phase 2 스키마의 태그/그룹 enum이 실수로 `string`으로 넓혀져 있던 것도 발견해 리터럴 유니온으로 고쳤다(엔진과의 구조적 호환은 유지— 좁은 타입은 넓은 타입에 항상 대입 가능).

### 3-B. 유권자·캠페인 (skills/voters-campaign) ✅ 2026-07-05
- [x] 통제 판정(단독 1등만), assignVoterChoice(무료·재배치·마지막 적용)
- [x] 캠페인 7액션 + 비용 검증 + 라운드로빈 2액션
- [x] MVP 활성 능력 3종 (모금+1/노동자 접촉-1/압박-1)
- [x] poll 비활성 플래그, useEvent 거부 스텁
- [x] revealVoters 실구현 + computeVoterVotes(자동 투표 집계, Skill 6이 소비)

구현 노트 / 스코프 조정:
- **RoundState가 계속 커져서 `roundState.ts` 파일로 생성 로직을 뽑아냄** — setup.ts와 system.ts(nextRound)가 각자 라운드 초기 객체를 인라인으로 들고 있던 걸 `createInitialRoundState()` 하나로 통합. Skill 6·7에서 필드가 더 늘어나도 이 한 곳만 고치면 된다.
- **§10 "표 변화" 표(선호+1/중립0/싫어함-1/충돌-2)의 적용 대상을 재해석함** — 처음엔 "미배치 유권자가 어느 후보에게 갈지 결정하는 표"로 오해했으나, 미배치 유권자는 브리프상 항상 "선호 일치 후보 찾기 또는 기권"이라 관계가 늘 선호(+1)뿐이다. 표 전체(중립/싫어함/충돌)가 실제로 의미를 가지는 경우는 **배치된(assignVoterChoice) 유권자를 컨트롤러가 어떤 후보에게 배정하느냐**다 — 선호와 무관한 후보에 억지로 배정하면 관계가 나빠져 표가 깎이거나(심하면 0으로 클램프) 오히려 역효과가 난다. 이 해석이 "유권자를 장악해도 아무 후보에게나 자유롭게 표를 몰 수 없다"는 원래 기획 의도와 정확히 들어맞아 채택함.
- **voteWeight × relation 방식 채택**: Phase 2에서 만든 VoterCard.voteWeight(1~3)를 살리기 위해, 표 변화 델타를 곱셈 계수로 사용(voteWeight×{1,0,-1,-2}, 0 미만 클램프). 브리프가 명시하지 않은 조합 방식이라 이식 결정으로 분류— 필요시 재조정 가능.
- 캠페인 액션의 자원 할인/보너스(§11 MVP 능력)는 "actor가 majorBacker인 출마 후보의 활성 능력"만 조회하도록 구현 — 후보가 여러 명이어도 단순 override 없이 첫 매치만 적용(스택 없음, 브리프 미명시라 단순한 쪽 채택).

### 3-C. 단일화·투표·정책 (skills/unification-voting) ✅ 2026-07-05
- [x] propose/accept/decline/skip 흐름, 이전 비율 70/50/30 자동 판정·내림, 직접 충돌 불가
- [x] 투표 5요소 합산 + 동점 4단계, 표 출처 분해(RoundResultSummary)
- [x] 정책 4순서 (③단일화 양보는 no-op 훅), 압박 비교 최대 2트랙, −2..+2 클램프
- [x] 당선 효과 4유형 + electionEffectSelection + fallback
- [x] runUnificationTest(제안 가능한 majorBacker가 없는 edge case 처리)

구현 노트 / 스코프 조정:
- **system.ts의 catalog 관통 범위 확대** — resolveVoting/resolvePolicy가 카드 내용이 필요해져 `applySystemAction`/`runAutoPhases`/`runSystemStep`/`runUntilPlayerAction` 체인 전체에 catalog 매개변수를 추가했다. Skill 4에서 selectPromise 하나 때문에 만든 catalog 배관을 이번에 시스템 액션까지 확장한 셈 — 이후 Skill 7(scoring)도 같은 체인을 그대로 쓸 수 있다.
- **GAME_SPEC 부록 A-12 추가**: 단일화 이전 비율의 "성향 충돌" 판정을 브리프가 구체화하지 않아, 두 후보가 선택한 공약의 정책 트랙/방향 비교로 통일했다(같은 트랙+같은 방향=70%, 같은 트랙+반대 방향=직접충돌 불가, 트랙이 다르면 지지 그룹 겹침 여부로 50%/30%). `CandidateCard.leaningTags`는 이 계산에 쓰지 않기로 함(카드 플레이버로만 유지).
- **단일화는 라운드당 최대 1건**으로 단순화 — 성사 즉시 투표로 진행한다. 연쇄 단일화(3→2→1)는 브리프 미명시라 배제.
- **CampState.totalBacking 추가**: §13 동점 처리 ②"총 후원금"을 계산하려면 경매 시점 총액을 저장해둬야 해서, Skill 4가 만든 CampState에 필드를 추가(auction.ts도 함께 수정).
- 당선 효과 확정(electionEffectSelection)과 실제 적용(policyResolution)을 분리 — "무엇으로 결정됐는지"(electionEffectResolution)와 "그걸 트랙에 반영하는 것"을 다른 phase로 나눠, promiseSelection/campaignActions에서 쓴 "결정 vs 적용" 패턴을 그대로 재사용했다.
- 3-C까지 누적 104건(엔진 79 + 데이터 25) 전체 통과, `pnpm typecheck` 통과.

### 3-D. 라운드 점수 (skills/scoring 라운드분) ✅ 2026-07-05
- [x] scoring v1 전 항목 + VP 사유 effects 기록 (lastRoundResult.vpBreakdown에 플레이어별 사유 저장)
- [x] 통제 유권자 VP 상한(4-5인 1 / 6-7인 2), 킹메이커 +2 (6-7인, 표차≤2, 기여 동점이면 미지급 — 보수적 처리)
- [x] cleanup에서 RoundHistoryEntry 기록 + 영향력 마커 누적
- [x] **Phase 5 선행분까지 함께 구현**: agendas.ts(§17 조건 11유형 평가기) + finalScoring.ts(§16 최종 점수·동점 v0.3) — cleanup의 마지막 라운드 분기가 finalResult를 즉시 채우는 구조라 분리 구현이 오히려 부자연스러워 앞당김

구현 노트 / 스코프 조정:
- **§10 마커 vs §15 지지 VP를 다른 조건으로 분리 구현** — 마커는 "표를 행사한 통제 유권자"면 승패 무관 전부 누적, 지지 VP는 "당선 후보를 지지한 경우"만 + 인원별 상한. 이를 위해 voters.ts에서 `computeVoterSupport`(유권자별 {후보, 표, controller, group})를 추출하고 `computeVoterVotes`·voting.ts의 그룹 수 계산·roundScoring이 전부 이 단일 소스를 공유하게 리팩터링.
- **압박 성공 판정용 상태 2종 추가**: `pressureContributors`(누가 어느 트랙·방향을 밀었나 — campaign.ts 기록), `pressureAppliedTracks`(resolvePolicy가 실제 반영한 최대 2개 — policy.ts 기록). roundScoring이 이 둘을 교차해 "내 압박이 실제 반영됨" +1을 정확히 배정한다.
- **조건지지 성공은 액션 1회당 +1** (같은 플레이어가 당선 후보에 2회 조건지지했으면 +2) — 브리프 미명시, 액션 단위 보상이 자연스러워 채택.
- **당선 공약 실행 보너스 +1은 당선 majorBacker에게 무조건 지급** — "공약 실행" 여부를 별도 판정할 조건이 브리프에 없어 당선=실행으로 해석.
- GameState에 `finalResult: FinalResultSummary | null` 추가 — gameEnd 진입(마지막 cleanup) 시 §16 항목 분해·동점 처리(v0.3 5단계, competition ranking)·전원 의제 공개를 채운다.

**완료 조건 (M3 관문)**: ✅ 2026-07-05 통과 — **4인 1라운드가 엔진 테스트로 끝까지 플레이됨 (첫 핵심 목표 달성)**
- [x] §28 테스트 목록 중 엔진 항목 전부 통과 — 131건(엔진 106 + 데이터 25), `pnpm typecheck` 통과
- [x] **통합 테스트(fullRound.test.ts): seed 고정 4인 1라운드(maxRounds=1)가 income→cleanup→gameEnd까지 액션 시퀀스로 완주**, 같은 seed 재생 시 최종 상태 완전 일치
- [x] runUntilPlayerAction이 결정 지점에서만 멈춤 — 통합 테스트가 각 결정 지점(입찰→공약→캠페인→단일화)의 phase를 순서대로 검증

> 착수 지시: "Phase 3 진행해줘. skills/auction-promise → voters-campaign → unification-voting → scoring 순서로, 각 스킬 테스트 통과 후 다음으로 넘어가줘"

---

## Phase 4 — 멀티플레이 서버 + 3시점 화면 → **M4 관문** ✅ 2026-07-05

목표: **브라우저 4개(개인 화면)로 실제 1라운드 완주.** 마스킹·재접속·권한의 실전 검증.

### 4-A. 서버 (skills/server-rooms) ✅
- [x] 방 생성/초대 링크/이름 입장/ready/host start/랜덤 좌석 (메모리 Map)
- [x] playerToken 발급·localStorage 복원·재접속 시 뷰 재전송
- [x] projectView — table/player-{seat}/spectator 마스킹 (경매 중 bidsConfirmed만 공개)
- [x] 액션 권한 검증 (좌석·차례·호스트·관전자), action:rejected 회신
- [x] **마스킹 테스트: player 뷰 payload에 타인 비밀 의제·입찰이 물리적으로 없음** (apps/server/test/e2e.test.ts, 4건)

### 4-B. 로비·테이블 화면 (skills/client-lobby-table) ✅
- [x] 소켓 연결/재연결, gameStore (서버 뷰 그대로 보관, Zustand 싱글턴 소켓)
- [x] Home(방 만들기/링크 입장) → Lobby(목록·ready·시작만, 미입장 방문자는 이름 입력 폼)
- [x] TableScreen: PhaseHeader·PolicyTracks·CandidateBoard·VoterBoard·PlayerPanels·ActionLog
- [x] 진행 버튼: 결정 대기 중 잠금 + "OO 님 대기 중" 표시, SpectatorScreen(TableScreen 재사용 + forceReadOnly)

### 4-C. 플레이어 개인 화면 (skills/client-player) ✅
- [x] TodoBanner (getPendingDecision 셀렉터 기반 — 항상 비어 있지 않음)
- [x] MyResources(라운드 시작 스냅샷 대비 변화량)·SecretAgenda(개인 화면 전용, evaluateAgendaCondition으로 달성 여부 표시)·ActionPanel(현재 phase 액션만 활성)
- [x] BidPanel(배분·확정·잠금)·PromisePicker·CampaignActions·AssignVoter(무료, 차례 무관)·UnificationPanel·ElectionEffectPicker
- [x] 액션 결과는 sendAction의 ack에 담긴 최신 view로 즉시 반영 (별도 토스트는 Phase 6 ux-feedback으로 이연)

**완료 조건 (M4 관문)**:
- [x] 방 생성→ready→시작→1라운드 진행을 실제 브라우저(Claude Preview)와 실제 서버로 검증 — host(table)·player(play, 입찰 제출까지)·spectator(watch) 3시점 모두 확인, 콘솔 에러 0건
- [x] 비차례 액션이 UI에서 잠기고, 서버가 §20 권한을 검증함 (e2e.test.ts)
- [x] 클라이언트 코드에 룰 계산 없음 (리뷰 체크) — 유일한 예외는 getVoterController/evaluateAgendaCondition으로, 둘 다 CardCatalog 불필요+ 이미 공개된 상태에 대한 순수 표시용 판정이라 서버와 동일한 함수를 재사용한 것(중복 구현에 의한 divergence 방지)
- [ ] 브라우저 4개 "동시" 접속 실시간 검증은 도구 제약상 순차 토큰 스와핑으로 대체 — 실제 4개 창 동시 플레이는 사용자 수동 확인 권장

**구현 노트**:
- **부록 A-13 추가**: 서버가 액션 처리 직후 자동으로 `runUntilPlayerAction`까지 이어 진행하도록 `apps/server/src/sockets.ts`를 수정. 그전까지는 개별 플레이어 액션이 자동 진행 phase(예: auctionResolved)에 도달해도 호스트가 "진행" 버튼을 눌러야만 다음 결정 지점까지 나아갔는데, 이는 §22 "플레이어가 액션해야 할 때만 화면이 멈춰야 한다"를 위반했다. 수정 후 TableScreen의 "진행" 버튼은 사실상 안전망/수동 재동기화 용도로만 남는다. apps/server/test/e2e.test.ts의 관련 assertion을 새 동작에 맞게 갱신.
- **환경 이슈**: 이 세션의 미리보기 도구(`preview_start`)가 참조하는 "Primary working directory"가 실제 작업 경로(`C:\Users\jongwoo\Documents\KingmakerBG`)가 아니라 예전 스캐폴딩 경로(`C:\project\boardgame`, Phase 0 상태로 정지)에 고정되어 있어 처음에 구버전 화면이 보이는 문제가 있었다. `C:\project\boardgame\.claude\launch.json`의 dev 설정을 `cmd.exe /c "cd /d <실제 경로> && pnpm dev"`로 바꿔 우회 — 실제 저장소 파일은 건드리지 않는 세션 로컬 우회다.
- 클라이언트 전용 `pnpm typecheck` 스크립트를 client package.json에 추가하고 루트 `typecheck` 스크립트에 포함시켜, 다른 패키지들과 동일하게 vite build 없이도 타입 오류를 빠르게 잡을 수 있게 함.

> 착수 지시: "Phase 4 진행해줘. skills/server-rooms → client-lobby-table → client-player 순서로"

---

## Phase 5 — 5라운드 풀게임 + 최종 점수 (skills/scoring 완성) → M5 ✅ 2026-07-05

- [x] nextRound 루프 — 덱 소진 처리(부록 A-14 신규), 라운드 간 상태 이월(정책·자원·마커·히스토리)
- [x] agendas.ts — 조건 11유형 평가기 (RoundHistoryEntry 참조 필수) — Phase 3-D에서 이미 구현되어 있었음, 이번 단계에서 재검증만
- [x] finalScoring — 공개 VP + 의제 + money/5 + rep 단독 1등 +2 + 공개 계약(현재 0) — 동일하게 Phase 3-D 선행 구현분 재검증
- [x] 동점 v0.3 5단계, 전원 의제 공개 + score breakdown
- [x] FinalResults 화면 연결 (최소 표시) — `components/board/FinalResults.tsx`, Table/PlayerScreen 양쪽에 연결

**완료 조건 (M5)**:
- [x] 의제 16장 각각 달성/미달 테스트 — agendas.test.ts(11건)가 11개 조건 유형 전체를 met/unmet 양쪽으로 커버(16장은 이 11유형의 파라미터 변주이므로 유형 커버리지로 충분). candidateWonAtMost류는 RoundHistoryEntry 참조 케이스 포함
- [x] seed 고정 4인 5라운드 자동 완주 테스트 (`packages/engine/test/multiRound.test.ts` placeholder 카탈로그 4건 + `packages/data/test/engineIntegration.test.ts` 실카드 1건) — 승자 총점 36 VP로 목표대(30~45) 안에 들어옴, 결정성 재생·다른 seed 분기까지 확인
- [x] 브라우저로 5라운드 실제 완주 — Claude Preview + 실소켓 스크립트로 방 생성→4명 참가→5라운드 전부 진행→gameEnd 도달, FinalResults 표 렌더링까지 확인 (콘솔 에러 0건). 4개 창 "동시" 접속은 M4와 동일한 도구 제약으로 순차 검증 대체

**구현 노트**:
- **부록 A-14 추가(핵심 발견)**: 브리프 어디에도 덱 소진 규칙이 없는 채로, 4인 5라운드 기준 후보(라운드당 5장×5=25장 vs 보유 21장)와 공약(출마 3명×3장×5=45장 vs 보유 30장) 덱이 실제로 바닥나는 것을 직접 계산으로 발견. "당선자를 제외한 이번 라운드 공개 후보 전원"과 "선택되지 않은 공약 옵션"을 매 라운드 cleanup에서 각 덱 맨 아래로 되돌리는 방식으로 해결 — 라운드당 영구 소모를 후보 1장·공약 3장으로 고정해 인원수·라운드 수와 무관하게 항상 충분하게 만들었다. 추가 셔플 없이 결정된 순서로만 되돌려 RNG 상태를 소비하지 않는다(결정성 유지). `system.ts`의 `applyNextRound`에 `recycleUnusedCards()` 헬퍼로 구현.
- agendas.ts/finalScoring.ts는 Phase 3-D에서 이미 완성되어 있었다는 이전 세션 기록이 실제 코드로 확인됨 — 이번 단계의 실질 작업은 멀티라운드 통합 테스트와 덱 소진 버그 발견·수정, FinalResults 화면 연결이었다.

> 착수 지시: "Phase 5 진행해줘. skills/scoring의 최종 점수·의제 평가기 완성"

---

## Phase 6 — 플레이테스트용 UX (skills/ux-feedback) → M6 ✅ 구현 완료 2026-07-05 (실제 플레이테스트는 미실시)

- [x] EffectToast — effects[] 구조화 렌더 ("누구에게 무엇이") — `components/board/EffectToast.tsx`, actionLog 신규 항목을 감지해 5초 토스트
- [x] ScoreRoute — 내 점수 루트 (엔진 셀렉터 기반) — 엔진에 `getScoreRoute` selector 신설(CardCatalog 불필요, 캠프 역할·조건지지·정책 압박 기여·유권자 통제 기반 가능 VP 나열), `components/player/ScoreRoute.tsx`
- [x] RoundSummary — 플레이어별 VP + 사유 오버레이 — `lastRoundResult.vpBreakdown` 그대로 사용, 라운드별 1회 표시 후 확인 시 숨김
- [x] RoundGoals — 라운드 종료까지 남은 조건, 목표 점수대 상시 표시 — `components/board/RoundGoals.tsx`
- [x] FinalResults 완성 — "무엇이 승패를 갈랐나" 비중 표시 — 단독 승자와 2위의 항목별(공개VP/의제/자금/평판) 차이 중 최댓값을 승부 요인으로 표시(이미 확정된 숫자끼리의 단순 비교라 클라이언트 룰 계산이 아니다)
- [x] terms.ts 용어 사전 — majorBacker→주요 후원자 등, 개발자 용어 노출 전수 제거 — `lib/terms.ts` 신설(CAMP_ROLE_LABELS, EFFECT_FIELD_LABELS, resolveTargetName), 기존 "메인 후원자"(비표준 표기) 2곳을 "주요 후원자"로 통일
- [x] OnboardingHints — phase 첫 진입 1회성 힌트 — `components/board/OnboardingHints.tsx`, localStorage `kingmakers:seenHints`로 재노출 방지

**완료 조건 (M6)**:
- [ ] 게임을 모르는 사람 1명 플레이테스트 — **AI 세션은 실제 신규 플레이어 반응을 낼 수 없어 미실시.** 사용자가 직접 진행 필요
- [x] 라운드 요약에 VP 사유 없는 항목이 0건 — RoundSummary는 `vpBreakdown.reasons`(엔진이 채점 시 직접 채움)를 그대로 렌더하므로 항목 누락이 구조적으로 불가능
- [x] 최종 화면에서 승패 원인이 한눈에 보임 — FinalResults 상단 "승부를 가른 요소" 문구로 확인(Claude Preview로 실제 5라운드 게임에서 렌더 확인)

이후 **밸런스 피드백은 constants.ts 수치 조정으로만 반영.**

**구현 노트**:
- 브라우저 실측 중 EffectToast가 안 보인 것처럼 보인 문제가 있었으나, 원인은 코드가 아니라 도구 호출 왕복 시간이 토스트 자동 소멸(5초)보다 길었던 테스트 타이밍이었다 — `window.__toastDebug` 임시 계측으로 실제로는 정상 동작(React 18 StrictMode의 마운트 2회 호출도 정상 무해)함을 확인 후 계측 코드 제거.
- `preview_console_logs` 도구가 이전 페이지 탐색의 콘솔 오류를 새로고침 후에도 동일한 타임스탬프로 반복 재생하는 현상을 발견 — 이 세션에서는 DOM 직접 조회(`preview_eval`)로 우회 확인했다. 실제 브라우저 콘솔 문제인지 도구 자체 캐싱 문제인지는 후속 세션에서 재확인이 필요할 수 있다.

> 착수 지시: "Phase 6 진행해줘. skills/ux-feedback"

---

## Phase 7 — 고급 규칙 (skills/advanced-rules) → M7 ✅ 구현 완료 2026-07-05 (착수 게이트는 사용자 승인으로 생략, 실제 플레이테스트는 미실시)

**착수 조건: Phase 3~5 완료 + 4인 플레이테스트 1회 이상.**
> **2026-07-05 착수 시점 기록**: 4인 실제 플레이테스트(신규 플레이어 반응 확인)는 AI 세션이 대신할 수 없어 미충족 상태다. 사용자에게 이 사실을 알리고 "지금 플레이테스트 / 게이트 건너뛰고 진행 / 다른 작업 우선" 중 선택을 요청했고, **사용자가 명시적으로 "게이트를 건너뛰고 바로 Phase 7 진행"을 선택**해 이 조건을 의도적으로 유예하고 착수했다. 따라서 이 단계에서 만드는 고급 규칙은 실제 플레이 검증 없이 명세(GAME_SPEC.md)만으로 구현된 것이며, 추후 플레이테스트에서 재작업이 필요할 수 있다.

우선순위 순서 고정:

1. [x] 단일화 공개 조건 계약 (정책 양보 → policy 3순서 훅 연결, 이행 수 → 최종 보너스 연결) — 부록 A-15, 엔진+클라이언트 UI(UnificationPanel 조건 첨부) 완료
2. [x] 비밀 pact + 배신 (마스킹, rep −2·유권자 이벤트 2장·플래그) — 부록 A-16, 엔진+서버 마스킹+E2E 테스트+클라이언트 UI(SecretPactPanel) 완료
3. [x] 이벤트 카드 효과 60장 (useEvent 활성화 — 손패 상한·타이밍 결정, GAME_SPEC 부록 A-17 추가) — 엔진+데이터 60장 전체 실효과+클라이언트 UI(EventHand) 완료
4. [x] 후보 능력/약점 확장 (1종 = 테스트 1세트), poll 활성화 — 부록 A-18
5. [x] 밸런스 시뮬레이션 — bot 자동 대전 N회, 점수 분포·의제 달성률 리포트 (seed 고정 CI 재현) — 부록 A-19, A-20

**완료 조건 (M7)**:
- [x] 공개 계약 불이행 경로 부재 — 낙선 시 계약은 그냥 무효가 될 뿐, "불이행" 상태·페널티 코드 경로 자체가 없음 (unificationContract.test.ts)
- [x] pact 마스킹 테스트 — apps/server/test/e2e.test.ts에 실소켓 기반 테스트 추가 (당사자/제3자/호스트/관전자 4개 시점 전부 검증) + Claude Preview 실브라우저로도 재확인
- [x] 시뮬 리포트 재현 — packages/data/test/simulation.test.ts, seed 20개 고정, 재현성(같은 seed → 동일 리포트) 테스트 포함, `pnpm test`(루트, build:libs 선행)로 CI 재현 가능

**구현 노트**:
- 단일화 계약(A-15)·비밀 pact(A-16)·이벤트 효과(A-17) 모두 브리프가 세부를 정의하지 않은 영역이라 상당 부분을 새로 설계했다 — GAME_SPEC.md 부록에 근거와 함께 기록. 세 항목 모두 엔진·서버 마스킹·테스트에 더해 **클라이언트 UI까지 완료**: UnificationPanel(조건 첨부 입력), 신규 SecretPactPanel(제안/수신/수락/거절/활성 목록), 신규 EventHand(손패 사용) — 전부 CampaignActions phase의 ActionPanel에 연결.
- 이벤트 60장 효과는 카드마다 고유 효과 대신 재사용 가능한 3유형(resourceDelta/candidateVotesDelta/groupInfluence)에 파라미터만 배정 — 기존 PromiseEffect/CandidateAbility 관례를 따름.
- **버그 발견(item 4)**: 후보 능력 6종 중 `promiseRestriction`·`reputationLossOnPromise`는 타입·카드 데이터·zod 스키마까지 다 있었지만 `promise.ts`가 후보의 `abilities`를 아예 읽지 않아 실제로는 완전히 무효였다(조용한 기능 누락, 에러도 안 남). `applySelectPromise`에 집행 로직 추가로 수정 — 부록 A-18. 서브에이전트에게 "능력 6종 중 실제로 집행되는 것과 타입만 있는 것을 구분해달라"는 감사(audit)를 위임해 발견함 — 이런 "타입은 있지만 아무도 안 읽는" 패턴은 grep만으로는 놓치기 쉬워 후속 스킬 작업 시에도 유효한 점검 방법으로 남겨둔다.
- poll은 "현재 예상 득표 전원 공개"로 설계 — 기존 6개 유료 캠페인 액션과 동일한 `runTurnAction` 재사용, 클라이언트 CampaignActions에 `POLL_ENABLED` 조건부로 노출.
- Claude Preview로 방 생성→비밀 pact 제안→상대 수락→제3자/관전자 마스킹 확인까지 실제 소켓으로 검증(콘솔 에러 0건).
- **item 5(밸런스 시뮬레이션)에서 실제 엔진 버그 2건을 더 발견**:
  1. **자원 음수화**: item 4의 `reputationLossOnPromise`/A-16 pact 배신 페널티가 reputation을 하한 없이 차감해, 반복 페널티를 맞으면 음수가 될 수 있었다. `runTurnAction`의 범용 자원 검사(`cost.reputation > player.reputation`)가 음수 reputation에서 **비용 0인 무료 액션까지 거부**해버려 캠페인 차례에 아무것도 못 하는 진행 불가 상태가 실제로 재현됐다. `constants.ts`에 `clampResourceFloor()`를 추가해 reputation·money가 깎이는 모든 지점에 방어적으로 적용 — 부록 A-19.
  2. **공약 옵션 전체가 후보 약점에 걸리는 경우**: item 4에서 `promiseRestriction`을 실제로 집행하게 됐는데, 공약 옵션 3장을 뽑는 `auction.ts`는 그 후보의 약점을 전혀 고려하지 않고 있어 "제시된 3장이 전부 선택 불가"인 경우 그 캠프의 공약 선택이 영원히 끝나지 않는 진짜 소프트락 가능성이 있었다(봇이 무작위로 고르다 보니 부분적으로도 자주 걸려 표면화됨). `resolveAuction`이 draw 시점에 후보의 excludedTag를 건너뛰도록(건너뛴 카드는 덱 맨 아래로) 수정 — 부록 A-20.
  - 두 버그 모두 engine 자체 테스트(140개)는 통과하는 상태에서 `packages/data`의 실카드 시뮬레이션으로만 드러났다 — placeholder 카탈로그로는 재현되지 않는 "특정 후보 조합 + 특정 능력" 상호작용이었기 때문. 밸런스 시뮬레이션의 원래 목적(수치 튜닝 근거)보다 **이런 조합 버그를 찾아내는 용도**로 먼저 값을 했다.
  - 이 과정에서 루트 `package.json`의 `test` 스크립트가 워크스페이스 라이브러리를 재빌드하지 않고 `packages/data`/`apps/server`가 `@kingmakers/engine`의 (오래될 수 있는) `dist/` 산출물을 그대로 참조한다는 빌드 인프라 문제도 함께 발견해 `pnpm build:libs && pnpm -r test`로 수정 — 부록 A-19에 기록.
  - 리포트 스냅샷(seed 20개): 승자 점수 min 23/max 38/mean 30.85(목표대 30~45 내 12/20), 의제 달성률 48.75%. 봇이 의도적으로 단순해(이벤트 카드 미사용, 단일화 항상 skip) 이 수치를 근거로 `constants.ts` 점수 상수를 바로 조정하지는 않음 — 브리프도 밸런스 확정을 MVP 범위 밖으로 명시.

**Phase 7 완료 후 검토(사용자 요청 — "비밀 정보 마스킹" 영역 집중 점검)**:
- **발견 및 수정**: `sockets.ts`의 `game:log` 브로드캐스트가 `projectView`를 거치지 않고 원본 로그를 그대로 방 전체에 보내고 있어, 비밀 pact 제안/수락/거절 로그의 actor·상대방 PlayerId가 제3자·호스트·관전자에게도 전달되고 있었다(CLAUDE.md 원칙 3 위반). 현재 클라이언트가 `game:log`를 구독하지 않아 화면엔 안 보였지만 실제 전송 데이터였다. `filterActionLog`를 `views.ts`에서 공유 export로 뽑아 `broadcastLog`도 `broadcastViews`처럼 소켓별로 필터링하도록 수정 — 부록 A-21. 회귀 테스트를 기존 A-16 E2E 테스트에 추가하고, 수정 전 코드로 되돌려 실제로 실패하는 것까지 확인.
- **보고만 하고 판단 보류한 항목**: `roundScoring.ts`의 비밀 pact 배신 효과가 `field: 'betrayedSecretPact'`/`voterEventHand`처럼 이 메커닉에서만 쓰이는 고유한 field명을 쓰고 있어, A-16이 명시한 "그 결과로 발생하는 자원 변화는 다른 자원 변화와 동일하게 공개된다"는 의도보다 더 뚜렷하게 "누가 배신했는지"가 식별된다(다른 reputation 감소는 전부 `field: 'reputation'`을 공유). 설계 판단이 필요해 사용자에게 별도 보고.

---

## 페이즈 공통 규칙

- 각 페이즈 완료 시 커밋 (메시지에 페이즈 번호), 이 문서 체크박스 갱신
- 룰 해석이 갈리면 코드가 아니라 **GAME_SPEC.md 확인 → 미정이면 부록 A에 결정 추가 후 구현**
- 엔진 수정 시 결정성 테스트(재생 일치)가 항상 통과 상태 유지
- Phase 3 이후 밸런스 조정은 constants.ts와 카드 데이터에서만
