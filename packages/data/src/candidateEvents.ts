// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-17)
// 후보 이벤트 카드 30장 (§4, §5 라운드 수입) — 헤드라인 톤에 맞춰 resourceDelta(자기 자원) 또는
// candidateVotesDelta(사용 시 지정하는 출마 후보에게 적용, useEvent의 targetCandidateId) 효과를 배정했다.
// 헤드라인에 특정 후보가 지목되지 않아 "이 뉴스를 내가 어떻게 활용/방어하는가"로 해석해 자기 자원에 건다.
import type { EventCard, EventEffect } from './schemas';

const HEADLINES: Array<[string, string, EventEffect]> = [
  ['여론조사 발표', '주요 여론조사 기관이 후보 지지율을 발표했다.', { kind: 'resourceDelta', resource: 'organization', amount: 1 }],
  ['후원금 논란', '한 후보의 후원금 출처를 둘러싼 의혹이 제기됐다.', { kind: 'resourceDelta', resource: 'money', amount: -2 }],
  ['TV 토론 화제', '후보 간 TV 토론에서 날선 공방이 오갔다.', { kind: 'resourceDelta', resource: 'reputation', amount: 1 }],
  ['막말 논란', '한 후보의 발언이 막말 논란으로 번졌다.', { kind: 'resourceDelta', resource: 'reputation', amount: -2 }],
  ['지지 선언', '유력 인사가 특정 후보 지지를 선언했다.', { kind: 'candidateVotesDelta', amount: 2 }],
  ['정책 발표회', '한 후보가 대규모 정책 발표회를 열었다.', { kind: 'resourceDelta', resource: 'organization', amount: 2 }],
  ['가짜뉴스 확산', '후보 관련 허위 정보가 온라인에서 빠르게 퍼졌다.', { kind: 'resourceDelta', resource: 'reputation', amount: -1 }],
  ['청년층 간담회', '한 후보가 청년층과의 간담회를 개최했다.', { kind: 'resourceDelta', resource: 'organization', amount: 1 }],
  ['지역 순회 유세', '후보들이 전국 지역 순회 유세를 시작했다.', { kind: 'resourceDelta', resource: 'money', amount: -2 }],
  ['정치자금 감사', '선거관리위원회가 정치자금 감사에 착수했다.', { kind: 'resourceDelta', resource: 'money', amount: -1 }],
  ['언론사 단독 보도', '한 언론사가 후보 관련 단독 보도를 냈다.', { kind: 'resourceDelta', resource: 'reputation', amount: 1 }],
  ['후보 단일화설', '두 후보 간 단일화 협상설이 흘러나왔다.', { kind: 'candidateVotesDelta', amount: 1 }],
  ['과거 발언 재조명', '후보의 과거 발언이 다시 도마에 올랐다.', { kind: 'resourceDelta', resource: 'reputation', amount: -2 }],
  ['지지층 결집 집회', '지지자들이 대규모 결집 집회를 열었다.', { kind: 'candidateVotesDelta', amount: 2 }],
  ['정책 검증 토론회', '시민단체 주최로 정책 검증 토론회가 열렸다.', { kind: 'resourceDelta', resource: 'organization', amount: 1 }],
  ['네거티브 공방', '후보 캠프 간 네거티브 공방이 격화됐다.', { kind: 'resourceDelta', resource: 'reputation', amount: -1 }],
  ['깜짝 유세 동행', '유명 인사가 깜짝 유세에 동행했다.', { kind: 'candidateVotesDelta', amount: 2 }],
  ['해외 언론 보도', '해외 언론이 이번 선거를 주요 뉴스로 다뤘다.', { kind: 'resourceDelta', resource: 'reputation', amount: 1 }],
  ['후보 건강 이상설', '한 후보의 건강 이상설이 돌았다.', { kind: 'candidateVotesDelta', amount: -2 }],
  ['청렴 서약식', '후보들이 공동 청렴 서약식을 가졌다.', { kind: 'resourceDelta', resource: 'reputation', amount: 2 }],
  ['지역 상공인 간담회', '한 후보가 지역 상공인들과 간담회를 열었다.', { kind: 'resourceDelta', resource: 'money', amount: 2 }],
  ['정책 공약집 발간', '한 후보 캠프가 정책 공약집을 발간했다.', { kind: 'resourceDelta', resource: 'money', amount: -1 }],
  ['SNS 라이브 방송', '후보가 SNS 라이브 방송으로 직접 소통에 나섰다.', { kind: 'resourceDelta', resource: 'organization', amount: 1 }],
  ['캠프 인사 잡음', '후보 캠프 내부 인사를 둘러싼 잡음이 새어나왔다.', { kind: 'resourceDelta', resource: 'organization', amount: -2 }],
  ['지지율 역전', '최신 여론조사에서 지지율 순위가 뒤바뀌었다.', { kind: 'candidateVotesDelta', amount: 2 }],
  ['원로 정치인의 조언', '원로 정치인이 공개적으로 조언을 건넸다.', { kind: 'resourceDelta', resource: 'reputation', amount: 1 }],
  ['후보 자서전 출간', '한 후보가 자서전을 출간해 화제를 모았다.', { kind: 'resourceDelta', resource: 'reputation', amount: 1 }],
  ['긴급 기자회견', '한 후보 캠프가 긴급 기자회견을 자청했다.', { kind: 'resourceDelta', resource: 'organization', amount: -1 }],
  ['지역구 민심 탐방', '후보들이 격전지 민심 탐방에 나섰다.', { kind: 'candidateVotesDelta', amount: 1 }],
  ['선거 막판 총력전', '선거일이 가까워지며 각 캠프가 총력전에 돌입했다.', { kind: 'candidateVotesDelta', amount: 3 }],
];

export const CANDIDATE_EVENTS: EventCard[] = HEADLINES.map(([name, description, effect], i) => ({
  id: `event-c-${String(i + 1).padStart(2, '0')}` as EventCard['id'],
  name,
  description,
  category: 'candidate',
  effect,
}));
