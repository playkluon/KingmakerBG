// 기반 스킬: skills/client-lobby-table/SKILL.md
// 공개 후보 / 출마 후보 / 확정 공약 / 현재 표 (§22 필수 UI)
import type { CandidateId, GameState } from '@kingmakers/engine';
import { candidateById, candidateName, promiseById } from '../../lib/cards';
import styles from './board.module.css';

interface CandidateBoardProps {
  state: GameState;
}

/** 후보 마켓/출마 후보 카드 그리드 — table/player/spectator 화면이 공유한다 */
export function CandidateBoard({ state }: CandidateBoardProps) {
  const { round, players } = state;
  const nameOf = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? '—';
  const running = round.candidatesRunning;
  const notRunning = round.candidatesRevealed.filter((id) => !running.includes(id));
  const lastVotes = state.lastRoundResult?.round === round.round ? state.lastRoundResult.candidateVotes : null;

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>후보</h2>
      {running.length === 0 ? (
        <div className={styles.cardGrid}>
          {round.candidatesRevealed.map((id) => (
            <RevealedCandidateCard key={id} id={id} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.cardGrid}>
            {running.map((id) => {
              const camp = round.camps[id];
              const isWinner = round.winnerCandidateId === id;
              const isWithdrawn = round.withdrawnCandidates.includes(id);
              const className = [
                styles.card,
                styles.cardRunning,
                isWinner && styles.cardWinner,
                isWithdrawn && styles.cardWithdrawn,
              ]
                .filter(Boolean)
                .join(' ');
              const card = candidateById.get(id);
              const promise = camp?.promiseId ? promiseById.get(camp.promiseId) : null;
              const bonus = round.campaignVotes[id] ?? 0;
              return (
                <div key={id} className={className}>
                  <div className={styles.cardName}>
                    {card?.name ?? id}
                    {isWinner && <span className={`${styles.badge} ${styles.badgeGold}`}>당선</span>}
                    {isWithdrawn && <span className={`${styles.badge} ${styles.badgeRed}`}>사퇴</span>}
                  </div>
                  <div className={styles.cardMeta}>
                    기본표 {card?.baseVotes ?? '?'}
                    {bonus !== 0 && ` · 캠페인 보정 ${bonus > 0 ? '+' : ''}${bonus}`}
                    {lastVotes?.[id] != null && ` · 최종 표 ${lastVotes[id]}`}
                  </div>
                  <div className={styles.cardMeta}>
                    메인 후원자 {nameOf(camp?.majorBacker)}
                    {camp?.coBacker && ` · 공동 후원자 ${nameOf(camp.coBacker)}`}
                    {camp?.organizer && ` · 조직책 ${nameOf(camp.organizer)}`}
                  </div>
                  <div className={styles.cardMeta}>공약: {promise ? promise.name : '선택 대기 중'}</div>
                </div>
              );
            })}
          </div>
          {notRunning.length > 0 && (
            <p className={styles.cardMeta}>경매 탈락: {notRunning.map((id) => candidateName(id)).join(', ')}</p>
          )}
        </>
      )}
    </div>
  );
}

function RevealedCandidateCard({ id }: { id: CandidateId }) {
  const card = candidateById.get(id);
  return (
    <div className={styles.card}>
      <div className={styles.cardName}>{card?.name ?? id}</div>
      <div className={styles.cardMeta}>기본표 {card?.baseVotes ?? '?'}</div>
      <div className={styles.cardMeta}>{card?.description}</div>
    </div>
  );
}
