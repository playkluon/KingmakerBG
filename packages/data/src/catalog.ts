// 기반 스킬: skills/card-data/SKILL.md
// @kingmakers/engine의 CardCatalog와 구조적으로 호환되는 조회 테이블을 만든다.
// data는 engine에 의존하지 않는다 — 타입은 구조적 타이핑으로만 맞춘다(§ CLAUDE.md 외부 의존성 0 원칙).
import { AGENDAS } from './agendas';
import { CANDIDATES } from './candidates';
import { CANDIDATE_EVENTS } from './candidateEvents';
import { ISSUES } from './issues';
import { PROMISES } from './promises';
import { VOTERS } from './voters';
import { VOTER_EVENTS } from './voterEvents';
import { PARTIES } from './parties';

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/** packages/engine의 reduce(state, action, catalog)에 그대로 넘길 수 있는 카드 조회 테이블 */
export function buildCardCatalog() {
  return {
    candidates: byId(CANDIDATES),
    promises: byId(PROMISES),
    voters: byId(VOTERS),
    issues: byId(ISSUES),
    candidateEvents: byId(CANDIDATE_EVENTS),
    voterEvents: byId(VOTER_EVENTS),
    agendas: byId(AGENDAS),
    parties: byId(PARTIES),
  };
}
