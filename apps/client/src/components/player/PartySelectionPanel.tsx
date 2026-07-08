import { useGameStore } from '../../store/gameStore';
import { CATALOG } from '../../lib/catalog';
import type { GameState, PlayerId, PartyId } from '@kingmakers/engine';
import { getPendingDecision } from '@kingmakers/engine';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface PartySelectionPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function PartySelectionPanel({ state, myPlayerId }: PartySelectionPanelProps) {
  const sendAction = useGameStore((s) => s.sendAction);
  const pending = getPendingDecision(state);
  const myTurn = pending?.actors.includes(myPlayerId) && state.phase === 'partySelection';
  const player = state.players.find((p) => p.id === myPlayerId);

  // 현재 각 정당별 가입자 수 계산
  const counts = new Map<string, number>();
  for (const p of state.players) {
    if (p.party) counts.set(p.party, (counts.get(p.party) ?? 0) + 1);
  }

  if (player?.party) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>정당 선택 완료</h2>
        <p className={styles.hint}>다른 플레이어들의 선택을 기다리는 중입니다.</p>
        <div className={styles.myPartyInfo}>
          <strong>가입한 정당:</strong> {CATALOG.parties[player.party]?.name}
        </div>
      </div>
    );
  }

  if (!myTurn) {
    return (
      <div className={board.section}>
        <h2 className={board.sectionTitle}>정당 선택</h2>
        <p className={styles.hint}>자신의 차례를 기다려주세요.</p>
      </div>
    );
  }

  return (
    <div className={board.section}>
      <h2 className={board.sectionTitle}>가입할 정당 선택</h2>
      <p className={styles.hint}>각 정당은 최대 2명까지만 가입할 수 있습니다. 정당의 패시브 효과를 확인하고 신중히 선택하세요.</p>
      
      <div className={styles.partyList}>
        {Object.values(CATALOG.parties).map((party) => {
          const isFull = (counts.get(party.id) ?? 0) >= 2;
          return (
            <div key={party.id} className={styles.partyCard} style={{ borderColor: party.color }}>
              <div className={styles.partyHeader}>
                <h3 style={{ color: party.color }}>{party.name}</h3>
                <span className={styles.partyCount}>{(counts.get(party.id) ?? 0)} / 2</span>
              </div>
              <p className={styles.partyDesc}>{party.description}</p>
              <ul className={styles.partyPassives}>
                <li className={styles.passiveAdvantage}><strong>[강점]</strong> {party.passiveAdvantage}</li>
                <li className={styles.passiveDisadvantage}><strong>[약점]</strong> {party.passiveDisadvantage}</li>
              </ul>
              <button
                className={board.button}
                disabled={isFull}
                onClick={() => sendAction({ type: 'selectParty', actor: myPlayerId, partyId: party.id })}
              >
                {isFull ? '정원 초과' : '가입하기'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
