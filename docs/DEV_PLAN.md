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
