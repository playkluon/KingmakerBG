---
name: auction-promise
description: 동시 비공개 후보 경매 + 캠프 슬롯 배정 + majorBacker 공약 선택
---

# Skill 4 — 경매·공약 (§26 3단계)

참조: GAME_SPEC.md §8(경매), §9(공약 선택), §3(캠프 슬롯), 부록 A-3(마스킹), A-4(generateRandomBids)

## 생성 파일
```
packages/engine/src/rules/auction.ts
packages/engine/src/rules/promise.ts
packages/engine/test/auction.test.ts
packages/engine/test/promise.test.ts
```

## 경매 규칙 (auction.ts)
- `placeBid`: 여러 후보에 money 분할 입찰, 합계 ≤ 보유 money 검증. 확정 전까지 수정 가능
- `confirmAuctionBids`: 전원 확정 시 `resolveAuction` 자동 실행
- 정산: 총 입찰액 상위 **3명** 출마. 동점 처리 순서(§8): ①후원자 수 → ②최고 입찰자 reputation → ③후보 id 결정적 순서
- 돈 처리: 출마 후보 입찰금 전액 소비, 탈락 후보 입찰금 **절반 환급(내림)** — 3 걸었으면 1 환급
- 캠프 슬롯: majorBacker(최고 입찰자) / coBacker(그 외 **2 money 이상** 최고) / organizer(6-7인만, 앞 슬롯 제외 2 이상 최고)
- `setAuctionMode`: 공개 순차 입찰은 튜토리얼/디버그 모드로만 (기본은 동시 비공개)
- `generateRandomBids`: 디버그 전용 — RNG로 전원 입찰 생성

## 공약 규칙 (promise.ts)
- 출마 후보마다 공약 덱에서 3장 제시 → 해당 majorBacker가 `selectPromise`로 1장 선택, 나머지 버림
- majorBacker 없는 후보는 `autoSelectPromises`가 자동 선택. 제시 카드가 비면 남은 덱에서 fallback
- 공약 즉시 효과 5유형(§9) 적용: 추가 표 / 조건부 추가 표(그룹 공개 시) / majorBacker에 money·VP / 그룹 영향력 / 압박 토큰 — **한 후보/공약 조합당 1회만**
- 공약 선택 시 평판 손실 약점(활성분)과 공약 제한 1종 반영 (§11)

## 마스킹 계약 (Skill 8에서 사용)
- `auctionBidding` 중 state에 담긴 타인 입찰은 projectView가 제거하고 "확정 여부"만 남긴다 — 엔진은 마스킹용으로 `bidsConfirmed: Record<PlayerId, boolean>`을 별도 노출

## 수용 기준 (§28 해당분)
- 상위 3명 출마, 동점 처리 결정적
- 소비/절반 환급(내림) 정확
- majorBacker/coBacker/organizer 배정 정확 (2 money 미만은 슬롯 제외, 4-5인은 organizer 없음)
- majorBacker가 공약 선택, fallback 작동
- 공약 효과 중복 적용 없음
