---
name: unification-voting
description: 단일화 제안/수락/거절/스킵 + 투표 해결 + 정책 변화 4순서 + 당선 효과
---

# Skill 6 — 단일화·투표·정책 (§26 3단계)

참조: GAME_SPEC.md §12(단일화), §13(투표), §14(정책 변화), §6(정책 트랙·압박)

## 생성 파일
```
packages/engine/src/rules/unification.ts
packages/engine/src/rules/voting.ts
packages/engine/src/rules/policy.ts
packages/engine/src/rules/electionEffects.ts
packages/engine/test/{unification,voting,policy}.test.ts
```

## 단일화 (unification.ts)
- 흐름(§12): majorBacker가 `proposeUnification`(대표/사퇴 후보 지정) → 사퇴 측 majorBacker가 accept/decline → 거절·미제안 시 해당 제안자는 이번 라운드 스킵 → 전원 스킵 또는 성사 시 투표로 자동 진행
- 이전 비율: 정책 트랙·방향 동일 70% / 지지 그룹 일부 겹침 50% / 성향 비충돌 30% / 직접 충돌 **불가**. 이전 표 = 사퇴 후보 현재 표 × 비율, **내림**
- 비율 판정은 엔진이 자동 계산해 제안 시점에 제안자·수신자에게 표시용으로 제공
- 공개 조건 계약·비밀 pact는 이 스킬 범위 아님 (Skill 12)

## 투표 (voting.ts)
- 최종 표 합산(§13): ①기본 표 ②공약 효과 ③캠페인(광고/스캔들/조건지지) ④유권자 배정 ⑤단일화 이전
- 동점 처리: ①majorBacker reputation → ②총 후원금 → ③표를 준 유권자 그룹 수 → ④후보 id 결정적 순서
- 결과는 RoundResultSummary에 후보별 표 출처 분해 포함 (UI 개표 표시용)

## 정책 변화 (policy.ts + electionEffects.ts)
- 순서(§14): ①당선 공약 정책 이동 → ②당선 후보 카드 당선 효과 → ③공개 단일화 정책 양보(7단계 전까지 no-op) → ④정책 압박 비교
- 압박 비교(§6): 트랙별 −합 vs +합, 큰 쪽으로 1칸. **차이 큰 트랙부터 최대 2개만** 반영. 차이 동률은 트랙 정의 순서로 결정적
- 트랙 범위 `-2..2` 클램프
- 당선 효과 4유형: `fixedPolicyMove`(자동) / `choosePolicyMove`·`flexPolicyMove`(majorBacker가 `selectElectionPolicyMove`, electionEffectSelection phase) / `winningPromisePolicyMove`(공약 이동 반복). majorBacker 부재·옵션 비정상 시 엔진 fallback

## 수용 기준 (§28 해당분)
- 이전 비율 30/50/70% 계산·내림 정확, 직접 충돌 시 제안 불가
- 투표 동점 처리 결정적
- 정책 압박 최대 2개 트랙만 이동
- 선택형 당선 효과가 electionEffectSelection에서 멈추고, fallback 작동
