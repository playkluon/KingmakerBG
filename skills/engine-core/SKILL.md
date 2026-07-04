---
name: engine-core
description: 순수 룰 엔진 코어 — GameState/GameAction/reducer, phase 상태 머신, seed RNG, 액션 로그
---

# Skill 2 — 엔진 코어 (§26 1단계)

참조: GAME_SPEC.md §2(원칙), §3(인원별 설정), §5(자원), §7(라운드 흐름), §18(데이터 모델), §19-20(액션), 부록 A-5(결정성), A-6(로그)

## 생성 파일
```
packages/engine/src/
  types/ids.ts          # PlayerId, CandidateId 등 템플릿 리터럴 타입 (§18)
  types/state.ts        # GameState, RoundState, PlayerState, DrawPiles,
                        # ActionLogEntry, RoundHistoryEntry, RoundResultSummary
  types/actions.ts      # GameAction = SystemAction(16종 §19) | PlayerAction(17종 §20)
  constants.ts          # 인원별 설정표(§3), 시작 자원(§5), 정책 트랙(§6), 액션 비용표(§11)
  rng.ts                # mulberry32 seed RNG — 상태를 GameState에 보관, 호출마다 next 반환
  phases.ts             # phase 16종 정의 + 각 phase의 (허용 액션, 자동 진행 가능 여부)
  reducer.ts            # reduce(state, action) -> { state, log: ActionLogEntry[] }
                        #   또는 { ok: false, reason } (검증 실패)
  system.ts             # runSystemStep, runUntilPlayerAction, advancePhase
  log.ts                # ActionLogEntry 생성 헬퍼 (summary 한국어 문장 생성)
  setup.ts              # seed 기반 초기화: 덱 셔플, 좌석, 비밀 의제 배분
  selectors/index.ts    # UI용 파생값 계산 (클라이언트가 import 허용되는 유일한 로직)
packages/engine/test/
  setup.test.ts  phases.test.ts  determinism.test.ts
```

## 핵심 규칙
- reducer는 순수·불변: 입력 state를 절대 변형하지 않고 새 객체 반환. `structuredClone` 대신 스프레드 기반 부분 갱신
- `Date.now()`/`Math.random()` 금지. RNG 상태는 `state.rngState`로 보관 (부록 A-5)
- `runUntilPlayerAction`: 자동 처리 가능한 phase를 연쇄 진행하고 플레이어 결정 지점에서 멈춘다 (§19). 이 스킬에서는 각 phase 처리를 스텁(빈 구현 + TODO)으로 두고 Skill 4~7이 채운다
- 모든 상태 변화는 ActionLogEntry 동반: `{ seq, phase, actor, action, summary(한국어), effects[] }`
- schemaVersion `0.2`를 GameState에 명시

## 수용 기준 (§28 해당분)
- seed가 같으면 setup 결과가 같다
- 4/5/6/7인 설정(공개 후보 수, 캠프 슬롯, 킹메이커 유무)이 §3 표와 일치한다
- 같은 seed + 같은 액션 시퀀스 재생 = 동일 최종 상태 (determinism.test.ts)
- 잘못된 phase의 액션은 `{ ok: false, reason(한국어) }` 반환
