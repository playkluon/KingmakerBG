---
name: scoring
description: scoring v1 라운드 점수 + 라운드 히스토리 + 비밀 의제 평가기 + 최종 점수·동점 판정
---

# Skill 7 — 점수·비밀 의제 (§26 3단계 + 5단계)

참조: GAME_SPEC.md §15(라운드 점수), §16(최종 점수), §17(비밀 의제), §3(킹메이커·VP 상한)

## 생성 파일
```
packages/engine/src/rules/roundScoring.ts
packages/engine/src/rules/finalScoring.ts
packages/engine/src/rules/agendas.ts      # 조건 11유형 평가기
packages/engine/test/{roundScoring,finalScoring,agendas}.test.ts
```

## 라운드 점수 (roundScoring.ts) — scoring v1 (§15)
| 조건 | VP |
|---|---:|
| 당선 majorBacker / coBacker / organizer | +4 / +2 / +1 |
| 당선 공약 실행 보너스 (majorBacker) | +1 |
| 2위 후보 majorBacker | +1 |
| 조건지지 성공 | +1 |
| 내 정책 압박이 실제 반영됨 | +1 |
| 내 통제 유권자가 당선 후보 지지 | +1 (상한: 4-5인 라운드 1 / 6-7인 2) |
| 킹메이커 (6-7인, 표차 ≤2, 비-majorBacker 최다 유권자 표 제공) | +2 |

- **모든 VP에 획득 사유를 ActionLogEntry.effects로 기록** — "라운드 점수 이유가 플레이어별로 남는다"(§28)
- 정산 후 표를 행사한 통제 유권자의 그룹 영향력 마커를 플레이어별로 누적 (RoundHistoryEntry)

## 라운드 히스토리 (cleanup 시 기록)
`RoundHistoryEntry`: 라운드 번호, 당선 후보, 후보별 표, 정책 스냅샷, 플레이어별 획득 VP·사유, 누적 영향력 마커. **비밀 의제 평가의 유일한 근거 데이터** — 현재 라운드 상태만 보고 평가하는 구현 금지 (§17)

## 비밀 의제 평가기 (agendas.ts)
- §17 조건 11유형 각각을 `evaluate(condition, finalState, history) -> { met, score }` 판별 함수로 구현: policyAtLeast / policyBetween / noExtremePolicies / influenceLeader / influenceLeaderAny / notInfluenceLeader / candidateWon / candidateWonAtMost / reputationAtLeast / reputationRankAtMost / remainingMoneyAtLeast
- 순위형 조건(influenceLeader, reputationRank)의 동점 규칙 명시: 공동 1위는 "1위"로 인정하되 notInfluenceLeader는 불충족으로 처리 *(스펙 미정 — 잠정 결정, constants 주석에 표기)*

## 최종 점수 (finalScoring.ts) (§16)
1. 공개 VP 누계 + 2. 비밀 의제 점수 + 3. 남은 money 5마다 +1 + 4. reputation **단독** 1등 +2 + 5. 공개 계약 이행 수 **단독** 1등 +2 (7단계 전까지 0)
- 동점 v0.3: VP → reputation → money → 영향력 마커 총합 → 공동 승리
- 결과는 플레이어별 항목 분해(score breakdown)로 GAME_ENDED 요약에 포함, 전원 비밀 의제 공개

## 수용 기준 (§28 해당분)
- 통제 유권자 VP 상한이 인원별로 적용됨
- 의제 16장 각각 달성/미달성 케이스 테스트 (히스토리 참조 필수 케이스 포함: candidateWonAtMost 등)
- 최종 money/reputation 보너스 적용, 단독 1등 아닐 때 미지급
- 동점 판정 5단계가 순서대로 작동, 4인 5라운드 시뮬레이션 총점이 30-45 VP 목표대에 근접(±10 허용, 밸런스 리포트 출력)
