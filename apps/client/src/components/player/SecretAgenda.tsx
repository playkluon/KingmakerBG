// 기반 스킬: skills/client-player/SKILL.md
// 내 비밀 의제 + 현재 달성 상태 (개인 화면에서만! table/spectator에는 데이터 자체가 없다)
import { evaluateAgendaCondition } from '@kingmakers/engine';
import type { GameState, PlayerId } from '@kingmakers/engine';
import { agendaById } from '../../lib/cards';
import styles from './player.module.css';

interface SecretAgendaProps {
  state: GameState;
  myPlayerId: PlayerId;
}

/**
 * evaluateAgendaCondition은 CardCatalog 없이 공개 상태(+본인 정보)만으로 판정하는 개인 진행률 표시라
 * 클라이언트에서 직접 호출해도 CLAUDE.md 원칙(표 계산·점수 예측 금지)에 저촉되지 않는다 —
 * 다른 플레이어의 액션에 영향을 주지 않고, 본인 화면에만 노출되는 참고 정보이기 때문이다.
 */
export function SecretAgenda({ state, myPlayerId }: SecretAgendaProps) {
  const me = state.players.find((p) => p.id === myPlayerId);
  if (!me?.secretAgendaId) return null;
  const agenda = agendaById.get(me.secretAgendaId);
  const met = agenda ? evaluateAgendaCondition(agenda.condition, myPlayerId, state, state.roundHistory) : false;

  return (
    <div className={met ? `${styles.agendaBox} ${styles.agendaMet}` : styles.agendaBox}>
      <div className={styles.agendaTitle}>비밀 의제</div>
      <div className={styles.agendaName}>{agenda?.name ?? me.secretAgendaId}</div>
      <div className={styles.hint}>{agenda?.description}</div>
      <div className={styles.hint}>
        달성 시 {agenda?.points ?? '?'} VP · 현재 {met ? '달성 중' : '미달성'}
      </div>
    </div>
  );
}
