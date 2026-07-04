// 기반 스킬: skills/card-data/SKILL.md
// 유권자 카드 48장 (§10) — 6개 그룹 × 8장. conflictTag는 preferredTag의 정반대로 자동 계산한다(부록 A-9).
import { opposingTag } from './tags';
import type { PolicyReactionTag, VoterGroupKey } from './tags';
import type { VoterCard } from './schemas';

let sequence = 0;
function voter(
  name: string,
  description: string,
  group: VoterGroupKey,
  voteWeight: number,
  preferredTag: PolicyReactionTag,
  dislikedTag?: PolicyReactionTag,
): VoterCard {
  sequence += 1;
  const id = `voter-${String(sequence).padStart(2, '0')}` as VoterCard['id'];
  return { id, name, description, group, voteWeight, preferredTag, conflictTag: opposingTag(preferredTag), dislikedTag };
}

export const VOTERS: VoterCard[] = [
  // ── 노동자 (laborers) ──────────────────────────────────────
  voter('제조업 노동자', '공장에서 오래 일해 온 생산직 노동자.', 'laborers', 2, 'labor-workerRights', 'industry-environment'),
  voter('택배 노동자', '배송 물량에 시달리는 특수고용 노동자.', 'laborers', 1, 'labor-workerRights', 'economy-market'),
  voter('건설 노동자', '현장을 옮겨 다니며 일하는 일용직 노동자.', 'laborers', 1, 'labor-workerRights'),
  voter('콜센터 상담사', '감정노동에 시달리는 상담직 노동자.', 'laborers', 1, 'economy-welfare', 'foreign-openness'),
  voter('청소 노동자', '공공시설 미화를 담당하는 노동자.', 'laborers', 1, 'economy-welfare'),
  voter('택시 기사', '장시간 운행하는 개인·법인 택시 기사.', 'laborers', 2, 'labor-workerRights', 'economy-market'),
  voter('물류센터 노동자', '야간 교대 근무가 잦은 물류센터 노동자.', 'laborers', 1, 'labor-workerRights'),
  voter('돌봄 노동자', '요양·보육 현장에서 일하는 돌봄 노동자.', 'laborers', 3, 'economy-welfare', 'industry-growth'),

  // ── 중산층 (middleClass) ────────────────────────────────────
  voter('회사원', '대기업에 다니는 평범한 직장인.', 'middleClass', 1, 'economy-market'),
  voter('공무원', '안정적인 신분을 중시하는 공무원.', 'middleClass', 2, 'society-order', 'labor-corporate'),
  voter('교사', '공교육 현장에서 일하는 교사.', 'middleClass', 1, 'economy-welfare', 'society-order'),
  voter('은행원', '금융권에서 일하는 사무직 노동자.', 'middleClass', 1, 'economy-market'),
  voter('중견기업 관리자', '중견기업 중간관리직으로 일하는 직장인.', 'middleClass', 2, 'labor-corporate', 'foreign-openness'),
  voter('아파트 입주민 대표', '거주 지역 치안과 시세에 민감한 주민 대표.', 'middleClass', 1, 'society-order'),
  voter('프리랜서 디자이너', '자유로운 근무 방식을 선호하는 프리랜서.', 'middleClass', 1, 'society-liberty', 'labor-corporate'),
  voter('맞벌이 부부', '육아와 생계를 함께 책임지는 맞벌이 가정.', 'middleClass', 3, 'economy-welfare', 'society-order'),

  // ── 자영업자 (smallBusiness) ─────────────────────────────────
  voter('동네 식당 사장', '골목상권에서 식당을 운영하는 자영업자.', 'smallBusiness', 1, 'economy-market'),
  voter('편의점 점주', '24시간 편의점을 운영하는 가맹점주.', 'smallBusiness', 2, 'labor-corporate'),
  voter('카페 사장', '개인 카페를 운영하는 소상공인.', 'smallBusiness', 1, 'economy-market', 'industry-environment'),
  voter('미용실 원장', '동네 미용실을 운영하는 자영업자.', 'smallBusiness', 1, 'labor-corporate'),
  voter('소규모 제조업체 대표', '영세 제조업체를 운영하는 사업주.', 'smallBusiness', 2, 'industry-growth', 'foreign-openness'),
  voter('전통시장 상인', '전통시장에서 오래 장사해 온 상인.', 'smallBusiness', 1, 'foreign-protection'),
  voter('스타트업 창업자', '초기 스타트업을 운영하는 청년 창업가.', 'smallBusiness', 1, 'industry-growth', 'labor-workerRights'),
  voter('프랜차이즈 가맹점주', '여러 지점을 운영하는 프랜차이즈 가맹점주.', 'smallBusiness', 3, 'economy-market'),

  // ── 청년층 (youth) ──────────────────────────────────────────
  voter('취업준비생', '첫 직장을 구하고 있는 취업준비생.', 'youth', 1, 'labor-workerRights'),
  voter('대학생', '대학에 재학 중인 청년.', 'youth', 1, 'society-liberty'),
  voter('신입사원', '입사한 지 얼마 안 된 사회초년생.', 'youth', 2, 'economy-welfare', 'labor-corporate'),
  voter('청년 창업가', '기술 창업에 도전하는 청년 사업가.', 'youth', 1, 'industry-growth', 'labor-workerRights'),
  voter('프리랜서 크리에이터', '온라인 콘텐츠로 생계를 꾸리는 청년.', 'youth', 1, 'society-liberty'),
  voter('대학원생', '연구실에서 연구하는 대학원생.', 'youth', 2, 'industry-environment', 'foreign-protection'),
  voter('군 복무 예정자', '입대를 앞두고 있는 청년.', 'youth', 1, 'foreign-openness'),
  voter('1인 가구 청년', '혼자 생계를 꾸리는 청년 가구주.', 'youth', 3, 'economy-welfare', 'society-order'),

  // ── 노년층 (seniors) ────────────────────────────────────────
  voter('은퇴 공무원', '퇴직 후 연금으로 생활하는 전직 공무원.', 'seniors', 1, 'society-order'),
  voter('독거노인', '홀로 생활하는 저소득 노년층.', 'seniors', 2, 'economy-welfare'),
  voter('참전 유공자', '병역과 안보를 중시하는 참전 유공자.', 'seniors', 1, 'foreign-protection', 'society-liberty'),
  voter('소상공인 은퇴자', '가게를 접고 은퇴한 전직 자영업자.', 'seniors', 1, 'economy-market'),
  voter('노인정 회장', '지역 경로당을 이끄는 어르신 대표.', 'seniors', 2, 'society-order', 'foreign-openness'),
  voter('농촌 출신 어르신', '농촌에서 도시로 이주한 노년층.', 'seniors', 1, 'foreign-protection'),
  voter('재취업 노년층', '은퇴 후 다시 일자리를 구하는 노년층.', 'seniors', 1, 'economy-welfare'),
  voter('지역 원로', '지역 사회에서 영향력이 큰 원로 인사.', 'seniors', 3, 'society-order'),

  // ── 농어촌 (farmers) ────────────────────────────────────────
  voter('벼농사 농민', '쌀농사를 짓는 전업 농민.', 'farmers', 2, 'foreign-protection'),
  voter('과수원 농민', '과수 농사를 짓는 농민.', 'farmers', 1, 'economy-welfare'),
  voter('어민', '연근해에서 조업하는 어민.', 'farmers', 1, 'foreign-protection', 'industry-growth'),
  voter('축산업 종사자', '가축을 사육하는 축산 농가.', 'farmers', 1, 'industry-growth', 'foreign-openness'),
  voter('농협 조합원', '지역 농협에 소속된 조합원 농민.', 'farmers', 2, 'economy-welfare'),
  voter('귀농 청년', '도시에서 귀농한 청년 농부.', 'farmers', 1, 'industry-environment'),
  voter('임업 종사자', '산림을 관리하는 임업 종사자.', 'farmers', 1, 'industry-environment', 'industry-growth'),
  voter('지역 이장', '마을을 대표하는 이장.', 'farmers', 3, 'foreign-protection'),
];
