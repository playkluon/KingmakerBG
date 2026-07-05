// 기반 스킬: skills/client-lobby-table/SKILL.md
// 카드 내용 조회 — 카드는 "인쇄된 공개 정보"이므로 클라이언트가 data 패키지를 직접 조회해 렌더한다.
// (비밀 여부는 서버 마스킹이 결정한다 — 마스킹된 ID는 애초에 view에 없다.)
import {
  AGENDAS,
  CANDIDATES,
  CANDIDATE_EVENTS,
  ISSUES,
  POLICY_REACTION_TAG_LABELS,
  PROMISES,
  VOTERS,
  VOTER_EVENTS,
  VOTER_GROUP_LABELS,
} from '@kingmakers/data';
import type { PolicyReactionTag, VoterGroupKey } from '@kingmakers/data';
import type { PolicyTrackId } from '@kingmakers/engine';

function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export const candidateById = indexById(CANDIDATES);
export const promiseById = indexById(PROMISES);
export const voterById = indexById(VOTERS);
export const issueById = indexById(ISSUES);
export const agendaById = indexById(AGENDAS);
export const eventById = indexById([...CANDIDATE_EVENTS, ...VOTER_EVENTS]);

/** §6 정책 트랙 한국어 라벨 (− 방향 / + 방향) */
export const TRACK_LABELS: Record<PolicyTrackId, { name: string; minus: string; plus: string }> = {
  economy: { name: '경제', minus: '복지', plus: '시장' },
  labor: { name: '노동', minus: '노동권', plus: '기업 자율' },
  society: { name: '사회', minus: '시민 자유', plus: '질서' },
  industry: { name: '산업', minus: '환경', plus: '성장' },
  foreign: { name: '대외', minus: '개방', plus: '보호' },
};

/** 반응 태그 한국어 라벨 (없는 태그는 원문 유지) */
export function tagLabel(tag: string): string {
  return POLICY_REACTION_TAG_LABELS[tag as PolicyReactionTag] ?? tag;
}

/** 유권자 그룹 한국어 라벨 */
export function groupLabel(group: string): string {
  return VOTER_GROUP_LABELS[group as VoterGroupKey] ?? group;
}

export function candidateName(id: string | null | undefined): string {
  if (!id) return '—';
  return candidateById.get(id)?.name ?? id;
}
