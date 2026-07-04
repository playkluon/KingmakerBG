---
name: ux-feedback
description: 액션 결과 즉시 피드백, 점수 획득 이유, 내 점수 루트, 라운드 요약, 온보딩
---

# Skill 11 — 플레이어 친화 UX (§26 6단계)

참조: GAME_SPEC.md §22(UI 원칙), §25(문제점 1·8·10·11), §30(가장 중요한 결론)

착수 조건: M4(브라우저 4개 1라운드 완주) 이후.

## 생성 파일
```
apps/client/src/
  components/EffectToast.tsx     # 액션 직후 "무엇이 누구에게" — effects[] 구조화 렌더
  components/ScoreRoute.tsx      # 내 점수 루트: 현재 VP + 이번 라운드 가능 VP 출처 목록 (§30-2)
  components/RoundSummary.tsx    # roundScoring 후 오버레이: 플레이어별 획득 VP와 사유
  components/RoundGoals.tsx      # 라운드 종료까지 남은 조건 (남은 결정·대기자)
  components/FinalResults.tsx    # 최종: 전원 비밀 의제 공개 + 항목 분해 점수 — "무엇이 승패를 갈랐나" (§30-3)
  components/OnboardingHints.tsx # phase 첫 진입 시 1회성 힌트 카드 (localStorage로 본 것 기록)
packages/engine/src/log.ts 보강  # summary 자연어 품질 — 개발자 문구 금지 (§25-10)
```

## 규칙
- 로그를 읽지 않아도 방금 일어난 일이 이해되어야 한다(§22) — EffectToast가 ActionLogEntry.effects를 아이콘+대상+수치로 렌더. 자연어 summary는 보조
- ScoreRoute는 엔진 selector로 계산 (클라이언트 룰 계산 금지): "당선 시 majorBacker +4", "조건지지 성공 시 +1" 등 현재 상태 기준 가능 점수 나열 — 점수 소스가 많아 읽기 어렵다는 문제(§25-8)의 대응
- RoundSummary·FinalResults의 모든 점수는 사유 문자열과 함께 표시 (Skill 7이 남긴 effects 사용)
- 승리 목표(30-45 VP대)와 현재 라운드 n/5를 상시 헤더에 강조 (§25-11)
- 카드 설명·로그 문구 전수 검수: 개발자 용어(`majorBacker` 등) 노출 금지 → 한국어 용어 사전 `terms.ts` (주요 후원자/공동 후원자/조직책)

## 수용 기준
- 플레이테스트 체크리스트: 처음 보는 사람이 로그 없이 ①방금 일어난 일 ②지금 할 일 ③이기는 방법을 말할 수 있음
- 라운드 요약에 VP 사유 없는 항목이 0건
- 최종 화면에서 승패 원인(의제/공개VP/보너스 비중)이 한눈에 보임
