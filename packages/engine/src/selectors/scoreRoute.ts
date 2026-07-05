// 기반 스킬: skills/ux-feedback/SKILL.md
// §30-2 "그 선택은 어떤 점수 루트로 이어지는가" — 이번 라운드에 내가 얻을 수 있는 VP 출처 목록.
// 실제 발생 여부(당선/조건지지 성공 등)는 라운드 종료 전까지 확정되지 않으므로 전부 "가능성" 목록이다.
// 후보·유권자 이름은 카드 콘텐츠라 여기 담지 않는다 — CardCatalog 없이 계산 가능해야 selector 자격이 있다(CLAUDE.md).
import {
  getPlayerCountConfig,
  SCORE_CO_BACKER_WIN,
  SCORE_CONDITIONAL_SUPPORT_SUCCESS,
  SCORE_KINGMAKER_BONUS,
  SCORE_MAJOR_BACKER_WIN,
  SCORE_ORGANIZER_WIN,
  SCORE_POLICY_PRESSURE_SUCCESS,
  SCORE_PROMISE_BONUS_MAJOR_BACKER,
  SCORE_RUNNER_UP_MAJOR_BACKER,
  SCORE_VOTER_SUPPORT_WINNER,
} from '../constants';
import { getVoterController } from '../rules/voters';
import type { CandidateId, PlayerId } from '../types/ids';
import type { GameState } from '../types/state';

export interface ScoreRouteEntry {
  /** 관련 출마 후보 — 있으면 클라이언트가 카드 이름으로 치환해 보여준다 */
  candidateId?: CandidateId;
  /** 한국어 설명 (후보 이름 제외) */
  label: string;
  amount: number;
}

/** 이번 라운드 내가 얻을 수 있는 VP 출처를 전부 나열한다 (§30-2) */
export function getScoreRoute(state: GameState, playerId: PlayerId): ScoreRouteEntry[] {
  const entries: ScoreRouteEntry[] = [];
  const config = getPlayerCountConfig(state.players.length);

  for (const candidateId of state.round.candidatesRunning) {
    const camp = state.round.camps[candidateId];
    if (!camp) continue;

    if (camp.majorBacker === playerId) {
      entries.push({ candidateId, label: '당선 시 주요 후원자 보너스', amount: SCORE_MAJOR_BACKER_WIN });
      entries.push({ candidateId, label: '당선 시 공약 실행 보너스(주요 후원자)', amount: SCORE_PROMISE_BONUS_MAJOR_BACKER });
      entries.push({ candidateId, label: '2위 후보일 때 주요 후원자 보너스', amount: SCORE_RUNNER_UP_MAJOR_BACKER });
    }
    if (camp.coBacker === playerId) {
      entries.push({ candidateId, label: '당선 시 공동 후원자 보너스', amount: SCORE_CO_BACKER_WIN });
    }
    if (camp.organizer === playerId) {
      entries.push({ candidateId, label: '당선 시 조직책 보너스', amount: SCORE_ORGANIZER_WIN });
    }
    if (state.round.conditionalSupporters[candidateId]?.includes(playerId)) {
      entries.push({ candidateId, label: '조건부 지지 성공 시(이 후보 당선)', amount: SCORE_CONDITIONAL_SUPPORT_SUCCESS });
    }
  }

  // 정책 압박 — 내가 기여한 트랙·방향 중 하나라도 실제로 반영되면
  const contributedPressure = Object.values(state.round.pressureContributors).some((byDirection) =>
    Object.values(byDirection ?? {}).some((contributors) => contributors?.includes(playerId)),
  );
  if (contributedPressure) {
    entries.push({ label: '내가 압박한 정책이 실제로 반영되면', amount: SCORE_POLICY_PRESSURE_SUCCESS });
  }

  // 유권자 지지 — 내가 통제하는 유권자가 있으면(당선 후보 지지 시, 인원수별 라운드 상한까지)
  const controlledVoters = state.round.votersRevealed.filter(
    (voterId) => getVoterController(state.round.voterInfluence, voterId) === playerId,
  );
  if (controlledVoters.length > 0) {
    entries.push({
      label: `내가 통제하는 유권자가 당선 후보를 지지하면(라운드당 최대 ${config.voterSupportVpCap})`,
      amount: SCORE_VOTER_SUPPORT_WINNER,
    });
  }

  // 킹메이커 보너스 — 6-7인 전용. 실제 성립 여부는 투표 결과 확정 후에만 판정 가능해 규칙 설명만 보여준다
  if (config.kingmakerBonusEnabled) {
    entries.push({ label: '내 유권자가 몰린 후보가 근소한 차이로 2위가 되면(킹메이커)', amount: SCORE_KINGMAKER_BONUS });
  }

  return entries;
}
