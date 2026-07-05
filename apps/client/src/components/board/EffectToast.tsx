// 기반 스킬: skills/ux-feedback/SKILL.md
// 액션 직후 "무엇이 누구에게" — ActionLogEntry.effects[]를 구조화 렌더한다 (§22: 로그를 읽지 않아도 이해되어야 한다)
import { useEffect, useRef, useState } from 'react';
import type { ActionLogEntry, GameState } from '@kingmakers/engine';
import { effectFieldLabel, resolveTargetName } from '../../lib/terms';
import styles from './board.module.css';

interface EffectToastProps {
  state: GameState;
}

interface VisibleToast {
  entry: ActionLogEntry;
  key: number;
}

const DISMISS_MS = 5000;

/** effects[] 1건을 "대상: 필드 +값" 형태의 짧은 한국어 구절로 만든다 */
function describeEffect(state: GameState, effect: ActionLogEntry['effects'][number]): string {
  const targetName = resolveTargetName(state, String(effect.target));
  const fieldLabel = effectFieldLabel(effect.field);
  if (effect.delta != null) {
    const sign = effect.delta > 0 ? '+' : '';
    return `${targetName}: ${fieldLabel} ${sign}${effect.delta}`;
  }
  if (effect.after != null) {
    return `${targetName}: ${fieldLabel} → ${effect.after}`;
  }
  return `${targetName}: ${fieldLabel}`;
}

/** 최근 액션 로그를 감지해 잠깐 떴다 사라지는 토스트로 보여준다 — table/player 화면이 공유한다 */
export function EffectToast({ state }: EffectToastProps) {
  const [visible, setVisible] = useState<VisibleToast[]>([]);
  const lastSeenSeq = useRef<number | null>(null);

  useEffect(() => {
    const entries = state.actionLog;
    if (entries.length === 0) return;
    const latestSeq = entries[entries.length - 1]!.seq;
    if (lastSeenSeq.current === null) {
      // 최초 마운트 시점엔 과거 로그 전체를 토스트로 쏟아내지 않는다
      lastSeenSeq.current = latestSeq;
      return;
    }
    const fresh = entries.filter((e) => e.seq > lastSeenSeq.current!);
    if (fresh.length === 0) return;
    lastSeenSeq.current = latestSeq;

    const additions = fresh.map((entry) => ({ entry, key: entry.seq }));
    setVisible((prev) => [...prev, ...additions]);
    additions.forEach(({ key }) => {
      setTimeout(() => setVisible((prev) => prev.filter((t) => t.key !== key)), DISMISS_MS);
    });
    // state.actionLog 자체(배열 참조)가 매 뷰 갱신마다 바뀌므로 길이 변화만 트리거로 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.actionLog.length]);

  if (visible.length === 0) return null;

  return (
    <div className={styles.toastStack}>
      {visible.map(({ entry, key }) => (
        <div key={key} className={styles.toast}>
          <div className={styles.toastSummary}>{entry.summary}</div>
          {entry.effects.length > 0 && (
            <div className={styles.toastEffects}>
              {entry.effects.map((effect, i) => (
                <span key={i} className={styles.toastEffect}>
                  {describeEffect(state, effect)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
