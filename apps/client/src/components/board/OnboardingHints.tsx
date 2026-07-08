// 기반 스킬: skills/ux-feedback/SKILL.md
// phase 첫 진입 시 1회성 힌트 카드 — localStorage로 "본 것"을 기록해 두 번째부터는 뜨지 않는다 (§25-1 온보딩 부족)
import { useEffect, useState } from 'react';
import type { PhaseId } from '@kingmakers/engine';
import styles from './board.module.css';

const STORAGE_KEY = 'kingmakers:seenHints';

/** 처음 보는 사람이 로그 없이 이해할 수 있도록, 결정이 필요한 phase마다 한 줄 설명을 붙인다 */
const HINTS: Partial<Record<PhaseId, string>> = {
  partySelection: '자신과 성향이 맞는 정당을 선택해 가입하세요. 정당의 패시브 효과는 게임 내내 지속되며, 당선 시 소속 정당의 가치(주가)가 오릅니다.',
  candidateProposal: '먼저 공개된 이슈 2장을 보고 자신의 손패에서 가장 유리한 후보를 1명 제안(어필)하세요. 제안 후 나머지 이슈 2장이 공개됩니다.',
  auctionBidding:
    '공개된 후보들에게 자금을 나눠 입찰하세요. 가장 많이 낸 사람이 그 후보의 주요 후원자가 되어 당선 시 가장 큰 점수를 얻습니다.',
  promiseSelection: '주요 후원자는 후보에게 제시된 공약 3장 중 1장을 고릅니다. 공약은 정책 트랙을 움직이고 즉시 보상을 주기도 합니다.',
  campaignActions:
    '차례가 오면 유권자 접촉·광고·정책 압박 등으로 후보를 밀어줄 수 있습니다. 상황이 불리하다면 평판을 소모하여 다른 정당으로 탈당할 수도 있습니다.',
  unification: '출마 후보의 주요 후원자는 다른 후보에게 사퇴를 제안하거나(단일화) 그냥 넘길 수 있습니다.',
  electionEffectSelection: '당선 후보의 주요 후원자가 당선 효과로 어떤 정책을 움직일지 고릅니다.',
};

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markSeen(phase: PhaseId): void {
  const seen = loadSeen();
  seen.add(phase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

interface OnboardingHintsProps {
  phase: PhaseId;
}

/** 개인 화면 전용 — table/spectator는 액션 주체가 아니라 힌트가 필요 없다 */
export function OnboardingHints({ phase }: OnboardingHintsProps) {
  const [dismissed, setDismissed] = useState(false);
  const hint = HINTS[phase];

  useEffect(() => {
    setDismissed(false);
  }, [phase]);

  if (!hint || dismissed || loadSeen().has(phase)) return null;

  return (
    <div className={styles.hintCard}>
      <span>{hint}</span>
      <button
        className={styles.hintDismiss}
        onClick={() => {
          markSeen(phase);
          setDismissed(true);
        }}
      >
        확인했어요
      </button>
    </div>
  );
}
