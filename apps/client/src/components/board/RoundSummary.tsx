// 기반 스킬: skills/ux-feedback/SKILL.md
// roundScoring 직후 오버레이: 플레이어별 획득 VP와 사유 (§16, §22 "액션 직후 무엇이 누구에게")
import { useState } from 'react';
import type { GameState } from '@kingmakers/engine';
import { effectFieldLabel } from '../../lib/terms';
import styles from './board.module.css';

interface RoundSummaryProps {
  state: GameState;
}

/**
 * lastRoundResult는 다음 라운드로 넘어가도 그대로 남아 있다가 다음 채점 때 덮어써진다.
 * result.round를 기준으로 "아직 안 본 라운드"일 때만 보여주고, 확인을 누르면 그 라운드 번호를 기억해 다시 뜨지 않는다.
 *
 * voting 직후(resolveVoting)에는 vpBreakdown이 아직 빈 객체인 채로 lastRoundResult.round만 먼저
 * 채워진다(roundScoring은 그 뒤 electionEffectSelection 같은 플레이어 결정을 기다린 후에야 실행) —
 * 이 시점에 바로 띄우면 전원 0VP인 가짜 요약이 뜨고, 확인을 누르면 실제 결과가 영영 안 뜬다.
 * roundHistory에 해당 라운드가 실제로 기록된 뒤(=roundScoring까지 끝난 뒤)에만 보여준다.
 */
export function RoundSummary({ state }: RoundSummaryProps) {
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);
  const result = state.lastRoundResult;
  const isScored = result != null && state.roundHistory.some((entry) => entry.round === result.round);
  if (!isScored || !result || result.round === dismissedRound) return null;

  return (
    <div className={styles.overlayBackdrop}>
      <div className={styles.overlayCard}>
        <h2 className={styles.sectionTitle}>{result.round}라운드 결과</h2>
        <div className={styles.roundSummaryList}>
          {state.players.map((player) => {
            const breakdown = result.vpBreakdown[player.id];
            return (
              <div key={player.id} className={styles.roundSummaryRow}>
                <div>
                  {player.name}{' '}
                  {breakdown && breakdown.total !== 0 ? (
                    <span className={styles.roundSummaryAmount}>+{breakdown.total} VP</span>
                  ) : (
                    <span>이번 라운드 획득 VP 없음</span>
                  )}
                </div>
                {breakdown && breakdown.reasons.length > 0 && (
                  <ul className={styles.roundSummaryReasons}>
                    {breakdown.reasons.map((reason, i) => (
                      <li key={i}>
                        {effectFieldLabel(reason.field)}
                        {reason.delta != null && ` +${reason.delta}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <button className={styles.button} onClick={() => setDismissedRound(result.round)}>
          확인
        </button>
      </div>
    </div>
  );
}
