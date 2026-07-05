// 기반 스킬: skills/ux-feedback/SKILL.md
// 승리 목표(30~45 VP대)와 라운드 종료까지 남은 조건을 상시 강조한다 (§25-11)
import type { GameState, PhaseId } from '@kingmakers/engine';
import styles from './board.module.css';

interface RoundGoalsProps {
  state: GameState;
}

/** phase별 "무엇이 끝나야 다음으로 넘어가는지" 안내 — 결정 대기 phase에서만 의미가 있다 */
const PHASE_END_CONDITIONS: Partial<Record<PhaseId, string>> = {
  auctionBidding: '모든 플레이어가 입찰을 확정하면 경매가 정산됩니다',
  promiseSelection: '출마 후보 전원의 공약이 정해지면 다음 단계로 넘어갑니다',
  campaignActions: '전원이 캠페인 액션 2회씩을 모두 사용하면 단일화로 넘어갑니다',
  unification: '모든 주요 후원자가 단일화를 넘기거나 성사되면 투표로 넘어갑니다',
  electionEffectSelection: '당선 후보의 주요 후원자가 당선 효과를 선택하면 정책이 반영됩니다',
};

export function RoundGoals({ state }: RoundGoalsProps) {
  const hint = PHASE_END_CONDITIONS[state.phase];
  return (
    <div className={styles.goalsStrip}>
      <span>
        승리 목표 <strong>30~45 VP대</strong>
      </span>
      <span>
        라운드 {state.round.round}/{state.maxRounds}
      </span>
      {hint && <span className={styles.goalsHint}>{hint}</span>}
    </div>
  );
}
