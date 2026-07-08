// 기반 스킬: skills/advanced-rules/SKILL.md (코어 루프 개편안 A — 7대 정당)
// passives가 실제 규칙이고, passiveAdvantage/Disadvantage는 화면 표시용 문장이다 — 둘은 항상 같은 내용을 말해야 한다.
// 정당 패시브는 VP를 직접 주지 않는다 — 점수는 당선·주가 배당 등 게임 결과로만 발생한다.
import type { PartyCard } from './schemas';

export const PARTIES: PartyCard[] = [
  {
    id: 'party-01',
    name: '보수국민당',
    description: '안정과 기득권 수호를 중시하는 보수 정당입니다.',
    color: '#1e40af',
    passiveAdvantage: '모금 시 자금을 1 더 얻습니다',
    passiveDisadvantage: '유권자 접촉 비용이 조직력 1 증가합니다',
    passives: [
      { kind: 'fundraiseYieldDelta', delta: 1 },
      { kind: 'actionCostDelta', action: 'contactVoter', resource: 'organization', delta: 1 },
    ],
  },
  {
    id: 'party-02',
    name: '혁신진보당',
    description: '사회 개혁과 평등을 외치는 진보 정당입니다.',
    color: '#dc2626',
    passiveAdvantage: '스캔들 폭로 비용이 자금 1 감소합니다',
    passiveDisadvantage: '정책 압박 비용이 조직력 1 증가합니다',
    passives: [
      { kind: 'actionCostDelta', action: 'reportScandal', resource: 'money', delta: -1 },
      { kind: 'actionCostDelta', action: 'pressurePolicy', resource: 'organization', delta: 1 },
    ],
  },
  {
    id: 'party-03',
    name: '실용중도당',
    description: '이념을 떠나 실리를 추구하는 중도 정당입니다.',
    color: '#eab308',
    passiveAdvantage: '조건부 지지가 성공하면 자금 1을 추가로 받습니다',
    passiveDisadvantage: '광고 비용이 자금 1 증가합니다',
    passives: [
      { kind: 'conditionalSupportBonusMoney', amount: 1 },
      { kind: 'actionCostDelta', action: 'runAd', resource: 'money', delta: 1 },
    ],
  },
  {
    id: 'party-04',
    name: '녹색미래당',
    description: '기후 위기 대응과 환경을 최우선으로 하는 정당입니다.',
    color: '#16a34a',
    passiveAdvantage: '환경 계열 이슈가 공개될 때마다 조직력 1을 얻습니다',
    passiveDisadvantage: '성장 계열 공약을 선택하면 평판 1을 잃습니다',
    passives: [
      { kind: 'issueTagOrganizationGain', targetTag: 'industry-environment', amount: 1 },
      { kind: 'promiseTagReputationLoss', tags: ['industry-growth'], amount: 1 },
    ],
  },
  {
    id: 'party-05',
    name: '신기술연대',
    description: '규제 혁파와 기술 관료주의를 신봉하는 정당입니다.',
    color: '#06b6d4',
    passiveAdvantage: '정책 압박 비용이 조직력 1 감소합니다',
    passiveDisadvantage: '노동권·복지 계열 공약을 선택하면 자금 2를 잃습니다',
    passives: [
      { kind: 'actionCostDelta', action: 'pressurePolicy', resource: 'organization', delta: -1 },
      { kind: 'promiseTagMoneyCost', tags: ['labor-workerRights', 'economy-welfare'], amount: 2 },
    ],
  },
  {
    id: 'party-06',
    name: '민생우선당',
    description: '농어촌과 서민의 삶을 대변하는 포퓰리스트 정당입니다.',
    color: '#ea580c',
    passiveAdvantage: '유권자 접촉 비용이 조직력 1 감소합니다',
    passiveDisadvantage: '모금으로 얻는 자금이 1 감소합니다',
    passives: [
      { kind: 'actionCostDelta', action: 'contactVoter', resource: 'organization', delta: -1 },
      { kind: 'fundraiseYieldDelta', delta: -1 },
    ],
  },
  {
    id: 'party-07',
    name: '국제자유당',
    description: '글로벌 무역과 개방을 주장하는 자유주의 정당입니다.',
    color: '#9333ea',
    passiveAdvantage: '광고 집행 시 평판 1을 얻습니다',
    passiveDisadvantage: '보호무역 계열 공약을 선택할 수 없습니다',
    passives: [
      { kind: 'adReputationGain', amount: 1 },
      { kind: 'promiseTagRestriction', tags: ['foreign-protection'] },
    ],
  },
];
