---
name: voters-campaign
description: 유권자 통제·배치·자동 투표 + 캠페인 액션 7종 라운드로빈
---

# Skill 5 — 유권자·캠페인 액션 (§26 3단계)

참조: GAME_SPEC.md §10(유권자와 영향력), §11(캠페인 액션), §3(인원별 캠페인 액션 수), 부록 A-4(poll/useEvent 잠정 처리)

## 생성 파일
```
packages/engine/src/rules/voters.ts
packages/engine/src/rules/campaign.ts
packages/engine/test/voters.test.ts
packages/engine/test/campaign.test.ts
```

## 유권자 규칙 (voters.ts)
- `revealVoters`: 인원별 공개 수(§3)만큼 공개
- 통제 판정: 영향력 **단독 1등**만 controller. 공동 1등·영향력 0이면 controller 없음
- `assignVoterChoice`(배치): 캠페인 액션 단계에서만, 단독 controller만, **액션 미소모** 무료 보조 권한, 투표 전까지 재배치 가능 — 마지막 배치가 적용
- 자동 투표: 배치된 유권자 → 배치 후보. 미배치 유권자 → 선호 태그와 맞는 공약 후보, 없으면 기권
- 표 변화(§10): 선호 +1 / 중립 0 / 싫어함 -1 / 직접 충돌 -2, **표는 0 미만 불가**
- 라운드 종료 시 표를 행사한 통제 유권자는 controller에게 그룹 영향력 마커를 남긴다 (최종 의제 점수용 — Skill 7이 누적 사용)

## 캠페인 액션 규칙 (campaign.ts)
- 플레이어당 라운드 2액션, 좌석 순 라운드로빈 (§11)
- 비용·효과 표(constants.ts):

| 액션 | 비용 | 소모 | 효과 |
|---|---|---|---|
| contactVoter | org 1 | O | 유권자 1명에 내 영향력 +2 |
| runAd | money 2 | O | 출마 후보 +2표 |
| pressurePolicy | org 2 | O | 트랙/방향에 내 압박 +1 |
| fundraise | rep 1 | O | money +4 |
| reportScandal | money 2 + rep 1 | O | 출마 후보 -2표 |
| conditionalSupport | 없음 | O | 후보 +1표, 당선 시 나 +1 VP |
| assignVoterChoice | 없음 | **X** | 통제 유권자 배치 |

- MVP 활성 후보 능력 반영(§11): 모금 money +1 / 노동자 유권자 접촉 비용 -1 / 정책 압박 비용 -1 — 능력 보유 후보의 **majorBacker에게** 적용
- `poll`: 액션 타입·constants 자리만, `enabled: false` (부록 A-4)
- `useEvent`: 손패 표시까지만, 실행 시 "효과 미구현" 사유로 거부 (7단계에서 활성)

## 수용 기준 (§28 해당분)
- 단독 1등만 controller, 공동 1등은 controller 없음
- 배치는 액션 미소모, 재배치 시 마지막 것 적용
- 캠페인 액션 정확히 2회, 자원 부족 시 거부(한국어 사유)
- 광고/스캔들/조건지지 표 변화 반영, 표 0 미만 없음
