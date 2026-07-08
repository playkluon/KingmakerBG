// 기반 스킬: skills/card-data/SKILL.md
// 이슈 카드 16장 (개편안 B: 2단계 분할 공개, 라운드당 4장 사용 — cleanup에서 덱 맨 아래로 재순환)
// advantage.targetTag는 tags.ts의 PolicyReactionTag 10종 어휘만 사용한다 — 어휘 밖 태그는 어떤 후보와도
// 매칭되지 않아 조용히 죽은 카드가 된다 (실제로 초기 구현에 잘못된 태그 3건이 있었다).
// VP 보너스는 두지 않는다 — 이슈는 표심(투표 집계)에만 영향을 주고, 점수는 당선 결과로만 발생한다.
import type { IssueCard } from './schemas';

export const ISSUES: IssueCard[] = [
  { id: 'issue-01',
    advantage: { targetTag: 'economy-welfare', voteBonus: 2 }, name: '고령화 가속', description: '저출산·고령화로 인한 인구구조 변화가 이번 라운드의 화두로 떠올랐다.' },
  { id: 'issue-02',
    advantage: { targetTag: 'labor-corporate', voteBonus: 2 }, name: '청년 실업 심화', description: '청년 취업난이 심화되며 여론의 관심이 고용 정책에 집중되고 있다.' },
  { id: 'issue-03',
    advantage: { targetTag: 'economy-market', voteBonus: 2 }, name: '부동산 가격 급등', description: '수도권 집값이 급등하며 주거 불안이 주요 쟁점으로 떠올랐다.' },
  { id: 'issue-04',
    advantage: { targetTag: 'labor-workerRights', voteBonus: 2 }, name: '노동시장 이중구조', description: '정규직과 비정규직 간 처우 격차가 사회 문제로 부상했다.' },
  { id: 'issue-05',
    advantage: { targetTag: 'industry-environment', voteBonus: 2 }, name: '기후 재난 빈발', description: '이상기후로 인한 자연재해가 잦아지며 대응 논의가 활발하다.' },
  { id: 'issue-06',
    advantage: { targetTag: 'industry-growth', voteBonus: 2 }, name: '지방 소멸 위기', description: '지방 인구 유출이 가속화되며 지역 소멸 우려가 커지고 있다.' },
  { id: 'issue-07',
    advantage: { targetTag: 'labor-workerRights', voteBonus: 2 }, name: '플랫폼 노동 확산', description: '배달·운송 등 플랫폼 노동자 보호 문제가 여론의 주목을 받고 있다.' },
  { id: 'issue-08',
    advantage: { targetTag: 'foreign-protection', voteBonus: 2 }, name: '무역 갈등 심화', description: '주요국 간 무역 갈등이 격화되며 수출 기업들의 긴장이 높아지고 있다.' },
  { id: 'issue-09',
    advantage: { targetTag: 'economy-welfare', voteBonus: 2 }, name: '저출생 위기', description: '출생률이 역대 최저치를 기록하며 국가적 위기감이 확산되고 있다.' },
  { id: 'issue-10',
    advantage: { targetTag: 'economy-market', voteBonus: 2 }, name: '에너지 가격 불안', description: '국제 에너지 가격 변동성이 커지며 물가 부담이 가중되고 있다.' },
  { id: 'issue-11',
    advantage: { targetTag: 'society-liberty', voteBonus: 2 }, name: '디지털 격차 확대', description: '세대·지역 간 디지털 접근성 격차가 사회 문제로 떠올랐다.' },
  { id: 'issue-12',
    advantage: { targetTag: 'society-order', voteBonus: 2 }, name: '치안 불안 여론 확산', description: '강력범죄 보도가 이어지며 치안 강화 요구가 커지고 있다.' },
  { id: 'issue-13',
    advantage: { targetTag: 'economy-welfare', voteBonus: 2 }, name: '공공의료 붕괴 우려', description: '지방 공공의료기관의 의료진 부족이 심각한 수준에 이르렀다.' },
  { id: 'issue-14',
    advantage: { targetTag: 'foreign-openness', voteBonus: 2 }, name: '이민자 증가 논쟁', description: '외국인 근로자 유입 확대를 둘러싼 사회적 논쟁이 커지고 있다.' },
  { id: 'issue-15',
    advantage: { targetTag: 'industry-growth', voteBonus: 2 }, name: '산업 구조 재편', description: '자동화·인공지능 확산으로 전통 제조업 일자리가 흔들리고 있다.' },
  { id: 'issue-16',
    advantage: { targetTag: 'society-order', voteBonus: 4 }, name: '초대형 부패 스캔들 터짐', description: '정재계를 뒤흔든 초대형 스캔들이 폭로되며 질서 확립과 부패 척결의 목소리가 극에 달하고 있다.' },
];
