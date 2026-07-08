// 기반 스킬: skills/client-lobby-table/SKILL.md (코어 루프 개편안 B·C)
// 이슈 2단계 공개 현황 + 정당 주가 트랙. 태그는 한국어 라벨로 보여주고(영문 키 노출 금지),
// 이슈 효과는 표 보너스만 — 이슈 카드에 VP를 달지 않는다.
import { CATALOG } from '../../lib/catalog';
import { POLICY_REACTION_TAG_LABELS } from '@kingmakers/data';
import type { GameState, IssueId } from '@kingmakers/engine';
import styles from './board.module.css';

interface IssueAndPartyBoardProps {
  state: GameState;
}

/** 태그 키('industry-growth' 등)를 한국어 라벨('성장')로 바꾼다 — 어휘 밖 값은 그대로 노출해 데이터 오류를 드러낸다 */
function tagLabel(tag: string | undefined): string {
  if (!tag) return '';
  return (POLICY_REACTION_TAG_LABELS as Record<string, string>)[tag] ?? tag;
}

function IssueCardView({ id, late }: { id: IssueId; late: boolean }) {
  const issue = CATALOG.issues[id];
  if (!issue) return null;
  return (
    <div
      style={{
        background: late ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0,0,0,0.3)',
        padding: '12px',
        borderRadius: '8px',
        border: late ? '1px solid var(--accent-warning)' : '1px solid var(--glass-border)',
      }}
    >
      <div style={{ fontWeight: 'bold', color: late ? 'var(--accent-warning)' : 'var(--accent-primary)', marginBottom: '4px' }}>
        {issue.name}
        {late && ' (후반 공개)'}
      </div>
      <div style={{ fontSize: '0.85rem' }}>{issue.description}</div>
      {issue.advantage && (
        <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-warning)' }}>
          {tagLabel(issue.advantage.targetTag)} 계열 후보·공약에 표 +{issue.advantage.voteBonus}
        </div>
      )}
    </div>
  );
}

export function IssueAndPartyBoard({ state }: IssueAndPartyBoardProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>이슈 보드 & 정당 주가 현황</h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginBottom: '8px' }}>
            공개된 이슈
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {state.round.firstIssues.map((id) => (
              <IssueCardView key={id} id={id} late={false} />
            ))}
            {state.round.secondIssues.length > 0
              ? state.round.secondIssues.map((id) => <IssueCardView key={id} id={id} late />)
              : state.round.firstIssues.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.1)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px dashed rgba(255,255,255,0.2)',
                      gridColumn: 'span 2',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>나머지 2장의 이슈는 후보 제안 후 공개됩니다.</span>
                  </div>
                )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <h3 className={styles.sectionTitle} style={{ fontSize: '1rem', marginBottom: '8px' }}>
            정당 주가 현황
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
            후보가 당선되면 그 정당의 주가가 +2 오르고, 다음 당선 때 주요 후원자가 현재 주가만큼 추가 점수를 받습니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.values(CATALOG.parties).map((party) => {
              const val = state.partyValues?.[party.id] ?? 0;
              return (
                <div
                  key={party.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${party.color}`,
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: party.color }}>{party.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem' }}>주가 {val}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
