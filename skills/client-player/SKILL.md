---
name: client-player
description: 좌석 개인 화면 — 액션 패널, "지금 해야 할 일" 안내, 비밀 의제, 입찰/배치 UI
---

# Skill 10 — 클라이언트: 플레이어 개인 화면 (§26 4단계)

참조: GAME_SPEC.md §20(액션 권한), §22(필수 UI·UX), §8(입찰), §10(배치), §11(액션), §12(단일화)

## 생성 파일
```
apps/client/src/
  screens/PlayerScreen.tsx      # /room/:id/play — 공용 보드 축약 + 내 전용 패널
  components/TodoBanner.tsx     # "지금 해야 할 일" — 최우선 UI (§30-1)
  components/MyResources.tsx    # money/org/rep/VP + 이번 라운드 변화량
  components/SecretAgenda.tsx   # 내 비밀 의제 + 현재 달성 상태 (개인 화면에서만!)
  components/ActionPanel.tsx    # 현재 phase에 내가 할 수 있는 액션만 활성
  components/BidPanel.tsx       # 후보별 입찰 배분(스텝퍼), 합계/잔액, 확정 후 잠금
  components/PromisePicker.tsx  # majorBacker일 때 공약 3장 중 선택
  components/CampaignActions.tsx# 7액션 버튼 + 대상 선택, 남은 액션 수(2개) 표시
  components/AssignVoter.tsx    # 내 통제 유권자 → 출마 후보 배정 ("무료" 라벨)
  components/UnificationPanel.tsx # 제안 작성(비율 자동 표시)/수신 제안 수락·거절/스킵
  components/ElectionEffectPicker.tsx # 선택형 당선 효과 옵션
```

## TodoBanner 규칙 (이 스킬의 핵심 — §30 "이번 단계에서 무엇을 해야 하는가")
- 엔진 selector `getPendingDecision(view, mySeat)`로 도출:
  - 내 결정 차례: "공약을 선택하세요", "캠페인 액션 1/2 남음" 등 구체 문구 + 해당 패널 강조
  - 타인 차례/자동 진행 중: "브로커 C의 액션을 기다리는 중" — 내 액션 전부 잠금
- 액션 결과는 `game:log` 수신 즉시 토스트로 "누구에게 무엇이" 표시 (§22)

## 규칙
- 비밀 의제는 이 화면에서만 렌더 (table/spectator에는 데이터 자체가 없음 — Skill 8)
- 내 차례가 아닌 액션 버튼은 잠금 + 이유 툴팁 (§20)
- 자원 부족 액션은 버튼에 부족분 표시, 클릭 시 서버 거부 사유 그대로 노출
- 입찰 패널은 확정 전 수정 가능, 확정 후 잠금, 타인은 "확정 완료 n/4"만 보임

## 수용 기준
- 4인 1라운드를 개인 화면 4개로 완주 (M4 완료 조건)
- 매 순간 TodoBanner가 비어 있지 않음 (해야 할 일 또는 대기 사유)
- 비차례 액션이 UI에서 잠기고, 우회 전송해도 서버가 거부
