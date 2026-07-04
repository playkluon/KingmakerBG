---
name: card-data
description: 카드 7종 데이터셋(후보21/공약30/유권자48/이슈15/이벤트30+30/의제16) + zod 스키마
---

# Skill 3 — 카드 데이터 (§26 2단계)

참조: GAME_SPEC.md §4(구성물·수량), §9(공약 효과 유형), §10(유권자 태그), §11(MVP 활성 능력), §14(당선 효과 유형), §17(의제 조건 유형), §18(ID 형태)

## 생성 파일
```
packages/data/src/
  schemas.ts            # zod: CandidateCard, PromiseCard, VoterCard, IssueCard,
                        #      EventCard, SecretAgendaCard
  candidates.ts         # 21장: 기본 표, 성향 태그, 당선 효과(4유형 중 1), 능력/약점(설명+활성 플래그)
  promises.ts           # 30장: 정책 트랙/방향, 유권자 반응 태그, 즉시 효과(5유형 §9)
  voters.ts             # 48장: 그룹, 표 수, 선호/싫어함/직접충돌 태그
  issues.ts             # 15장: 공개 정보 중심 (효과 확장은 후순위)
  candidateEvents.ts    # 30장: 데이터만, effect: { todo: true } 플래그
  voterEvents.ts        # 30장: 데이터만, effect: { todo: true } 플래그
  agendas.ts            # 16장: §17 조건 11유형 조합, 배점(이론상 최대 8~13 VP)
  index.ts
packages/data/test/integrity.test.ts
```

## 규칙
- ID는 §18 템플릿 리터럴 형식 준수 (`candidate-xxx` 등), 전체 유일
- 카드 텍스트(이름·설명·로그 문구)는 한국어. 기존 프로토타입 데이터가 없으므로 **정치 브로커 테마에 맞게 신규 창작**하되 수량·구조는 §4 고정
- 태그 어휘를 `tags.ts`로 중앙화 — 공약 반응 태그와 유권자 선호 태그는 같은 어휘 집합 사용
- MVP 활성 능력 3종(모금 +1 / 노동자 접촉 -1 / 압박 -1)과 공약 제한 1종, 평판 손실 약점은 `active: true`, 나머지 능력/약점은 `active: false` (§11)
- 후보 능력·이벤트 효과는 자유 텍스트가 아니라 **판별 가능한 유니온 타입**으로 정의 (7단계에서 스위치만 채우면 되도록)

## 수용 기준 (§28 해당분)
- 수량 검증: 21/30/48/15/30/30/16 정확
- 전 카드 zod 파싱 통과, ID 중복 없음
- 참조 무결성: 공약·유권자·의제가 참조하는 태그/그룹/후보 ID가 실재함
- 의제 16장이 §17의 조건 유형만 사용함
