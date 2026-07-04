// 기반 스킬: skills/engine-core/SKILL.md
// 엔진 자체 테스트용 공용 fixture. 실제 카드 데이터는 packages/data가 공급하며,
// 엔진은 packages/data를 import하지 않으므로(외부 의존성 0) 테스트는 placeholder ID로 §4 수량을 재현한다.
import { buildPlaceholderIds } from '../src/setup';
import type { DrawPiles } from '../src/types/state';

/** §4 카드 수량(21/30/48/15/30/30/16)을 그대로 따르는 placeholder 덱 */
export function testDecks(): DrawPiles {
  return {
    candidateDeck: buildPlaceholderIds('candidate', 21),
    promiseDeck: buildPlaceholderIds('promise', 30),
    voterDeck: buildPlaceholderIds('voter', 48),
    issueDeck: buildPlaceholderIds('issue', 15),
    candidateEventDeck: buildPlaceholderIds('event-c', 30),
    voterEventDeck: buildPlaceholderIds('event-v', 30),
    agendaDeck: buildPlaceholderIds('agenda', 16),
  };
}
