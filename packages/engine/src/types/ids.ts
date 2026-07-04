// 기반 스킬: skills/engine-core/SKILL.md
// §18 핵심 데이터 모델 — ID 형태

export type PlayerId = `player-${number}`;
export type CandidateId = `candidate-${string}`;
export type PromiseId = `promise-${string}`;
export type VoterId = `voter-${string}`;
export type IssueId = `issue-${string}`;
export type EventId = `event-${string}`;
export type AgendaId = `agenda-${string}`;

/**
 * 유권자 그룹 식별자.
 * 실제 그룹 목록(노동자/중산 등)은 packages/data(Phase 2)가 정의한다.
 * 엔진은 외부 의존성 0 원칙(CLAUDE.md)에 따라 카드 데이터를 import하지 않는다.
 */
export type VoterGroupId = string;

/** 정책 트랙 5종 (§6) — 고정 도메인 개념이라 엔진 상수로 둔다 */
export type PolicyTrackId = 'economy' | 'labor' | 'society' | 'industry' | 'foreign';

/** 정책 이동 방향: -1(§6의 '-' 방향) 또는 1('+' 방향) */
export type PolicyDirection = -1 | 1;

/** 캠프 슬롯 3종 (§3, §8) */
export type CampRole = 'majorBacker' | 'coBacker' | 'organizer';
