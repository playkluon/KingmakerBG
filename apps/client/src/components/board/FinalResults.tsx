// 기반 스킬: skills/scoring/SKILL.md (§16 최종 점수), skills/ux-feedback/SKILL.md (§30-3 "무엇이 승패를 갈랐나")
// 게임 종료 시 전원 공개되는 최종 점수 표 (비밀 의제 포함 — §16 규칙상 이 시점엔 더 이상 비밀이 아니다)
import type { FinalScoreEntry, GameState } from '@kingmakers/engine';
import { agendaById, candidateName } from '../../lib/cards';
import styles from './board.module.css';

interface FinalResultsProps {
  state: GameState;
}

/** 이미 확정된 점수 항목끼리 단순 뺄셈만 하는 화면 표시 로직이다 — 새 규칙 계산이 아니다 */
const CATEGORIES: Array<[label: string, key: keyof FinalScoreEntry]> = [
  ['공개 VP', 'baseVp'],
  ['비밀 의제 달성', 'agendaVp'],
  ['자금 보너스', 'moneyBonusVp'],
  ['평판 보너스', 'reputationBonusVp'],
];

/** 단독 승자와 2위의 항목별 차이 중 가장 큰 것을 "승부를 가른 요소"로 고른다 (§30-3) */
function findDecidingFactor(winner: FinalScoreEntry, runnerUp: FinalScoreEntry): { label: string; diff: number } | null {
  let best: { label: string; diff: number } | null = null;
  for (const [label, key] of CATEGORIES) {
    const diff = (winner[key] as number) - (runnerUp[key] as number);
    if (diff > 0 && (!best || diff > best.diff)) best = { label, diff };
  }
  return best;
}

export function FinalResults({ state }: FinalResultsProps) {
  const final = state.finalResult;
  if (!final) return null;

  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const sorted = [...final.entries].sort((a, b) => a.rank - b.rank);
  const decidingFactor =
    final.winners.length === 1 && sorted.length >= 2 ? findDecidingFactor(sorted[0]!, sorted[1]!) : null;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>최종 결과</h2>
      {decidingFactor && (
        <p className={styles.goalsStrip}>
          승부를 가른 요소: <strong>{decidingFactor.label}</strong> 차이 {decidingFactor.diff}점 (
          {nameOf(sorted[0]!.playerId)} 승리)
        </p>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.finalTable}>
          <thead>
            <tr>
              <th>순위</th>
              <th>플레이어</th>
              <th>공개 VP</th>
              <th>비밀 의제</th>
              <th>의제 VP</th>
              <th>자금 보너스</th>
              <th>평판 보너스</th>
              <th>계약 보너스</th>
              <th>총점</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => {
              const agenda = entry.agendaId ? agendaById.get(entry.agendaId) : null;
              const isWinner = final.winners.includes(entry.playerId);
              return (
                <tr key={entry.playerId} className={isWinner ? styles.winnerRow : undefined}>
                  <td>{entry.rank}</td>
                  <td>{nameOf(entry.playerId)}</td>
                  <td>{entry.baseVp}</td>
                  <td>
                    {agenda?.name ?? entry.agendaId ?? '-'} ({entry.agendaMet ? '달성' : '미달성'})
                  </td>
                  <td>{entry.agendaVp}</td>
                  <td>{entry.moneyBonusVp}</td>
                  <td>{entry.reputationBonusVp}</td>
                  <td>{entry.contractBonusVp}</td>
                  <td>{entry.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {state.roundHistory.length > 0 && (
        <p className={`${styles.cardMeta} ${styles.finalSummary}`}>
          라운드별 당선: {state.roundHistory.map((h) => `R${h.round} ${candidateName(h.winnerCandidateId)}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
