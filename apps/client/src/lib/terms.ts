// 기반 스킬: skills/ux-feedback/SKILL.md
// 개발자 용어(majorBacker 등) 노출 금지(§25-10) — 화면에 보이는 모든 캠프 역할·효과 필드명은 이 사전을 거친다.
import { POLICY_TRACKS } from '@kingmakers/engine';
import type { CampRole, GameState, PolicyTrackId } from '@kingmakers/engine';
import { candidateName, TRACK_LABELS, voterById } from './cards';

/** §3, §8 캠프 슬롯 3종의 한국어 명칭 */
export const CAMP_ROLE_LABELS: Record<CampRole, string> = {
  majorBacker: '주요 후원자',
  coBacker: '공동 후원자',
  organizer: '조직책',
};

/**
 * ActionLogEntry.effects[].field → 한국어 라벨.
 * packages/engine의 모든 rules/*.ts가 실제로 쓰는 field 값과 1:1 대응한다(EffectToast·RoundSummary 공용).
 * 'pressure-plus'/'pressure-minus'처럼 동적으로 만들어지는 값은 EFFECT_FIELD_PREFIX_LABELS에서 접두어로 처리한다.
 */
export const EFFECT_FIELD_LABELS: Record<string, string> = {
  money: '자금',
  organization: '조직력',
  reputation: '평판',
  victoryPoints: 'VP',
  influence: '유권자 영향력',
  campaignVotes: '캠페인 표 보정',
  policyTrack: '정책 트랙',
  electionEffect: '당선 효과',
  promiseId: '공약 확정',
  withdrawn: '단일화 사퇴',
  unificationTransfer: '단일화 이전 표',
  assignedTo: '유권자 배정',
  winner: '당선',
  issueId: '이슈 공개',
  candidatesRevealed: '후보 공개',
  candidatesRunning: '출마 확정',
  votersRevealed: '유권자 공개',
  // §16 roundScoring.ts의 사유 키
  majorBackerWin: '주요 후원자 당선 보너스',
  promiseBonus: '공약 실행 보너스',
  coBackerWin: '공동 후원자 당선 보너스',
  organizerWin: '조직책 당선 보너스',
  conditionalSupportSuccess: '조건부 지지 성공',
  runnerUpMajorBacker: '2위 후보 주요 후원자 보너스',
  policyPressureSuccess: '정책 압박 성공',
  voterSupportWinner: '유권자 지지 보너스',
  kingmaker: '킹메이커 보너스',
};

/** 'pressure-plus' / 'pressure-minus'처럼 접두어+동적 값으로 만들어지는 field를 위한 접두어 매칭 */
const EFFECT_FIELD_PREFIX_LABELS: Array<[prefix: string, label: string]> = [['pressure-', '정책 압박']];

/** effects[].field를 한국어 라벨로 변환한다. 등록되지 않은 값은 원문을 그대로 보여준다(로그로 새 필드 발견용) */
export function effectFieldLabel(field: string): string {
  if (EFFECT_FIELD_LABELS[field]) return EFFECT_FIELD_LABELS[field];
  const prefixed = EFFECT_FIELD_PREFIX_LABELS.find(([prefix]) => field.startsWith(prefix));
  return prefixed ? prefixed[1] : field;
}

const POLICY_TRACK_SET = new Set<string>(POLICY_TRACKS);

/** EffectDescriptor.target(플레이어/후보/유권자/정책 트랙/'game' 중 하나)을 화면에 보여줄 이름으로 바꾼다 */
export function resolveTargetName(state: GameState, target: string): string {
  if (target === 'game') return '게임';
  const player = state.players.find((p) => p.id === target);
  if (player) return player.name;
  if (POLICY_TRACK_SET.has(target)) return TRACK_LABELS[target as PolicyTrackId].name;
  if (target.startsWith('voter-')) return voterById.get(target)?.name ?? target;
  if (target.startsWith('candidate-')) return candidateName(target);
  return target;
}
