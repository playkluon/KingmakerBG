// 기반 스킬: skills/client-player/SKILL.md
// 현재 phase에 내가 할 수 있는 액션만 활성 — phase별로 알맞은 하위 패널을 고른다
import type { GameState, PlayerId } from '@kingmakers/engine';
import { AssignVoter } from './AssignVoter';
import { BidPanel } from './BidPanel';
import { CampaignActions } from './CampaignActions';
import { ElectionEffectPicker } from './ElectionEffectPicker';
import { EventHand } from './EventHand';
import { PromisePicker } from './PromisePicker';
import { SecretPactPanel } from './SecretPactPanel';
import { UnificationPanel } from './UnificationPanel';
import { PartySelectionPanel } from './PartySelectionPanel';
import { CandidateProposalPanel } from './CandidateProposalPanel';
import board from '../board/board.module.css';
import styles from './player.module.css';

interface ActionPanelProps {
  state: GameState;
  myPlayerId: PlayerId;
}

export function ActionPanel({ state, myPlayerId }: ActionPanelProps) {
  switch (state.phase) {
    case 'partySelection':
      return <PartySelectionPanel state={state} myPlayerId={myPlayerId} />;
    case 'candidateProposal':
      return <CandidateProposalPanel state={state} myPlayerId={myPlayerId} />;
    case 'auctionBidding':
      return <BidPanel state={state} myPlayerId={myPlayerId} />;
    case 'promiseSelection':
      return <PromisePicker state={state} myPlayerId={myPlayerId} />;
    case 'campaignActions':
      return (
        <>
          <CampaignActions state={state} myPlayerId={myPlayerId} />
          <AssignVoter state={state} myPlayerId={myPlayerId} />
          <EventHand state={state} myPlayerId={myPlayerId} />
          <SecretPactPanel state={state} myPlayerId={myPlayerId} />
        </>
      );
    case 'unification':
      return <UnificationPanel state={state} myPlayerId={myPlayerId} />;
    case 'electionEffectSelection':
      return <ElectionEffectPicker state={state} myPlayerId={myPlayerId} />;
    case 'gameEnd':
      return (
        <div className={board.section}>
          <h2 className={board.sectionTitle}>게임 종료</h2>
          <p className={styles.hint}>최종 결과를 아래에서 확인하세요.</p>
        </div>
      );
    default:
      return (
        <div className={board.section}>
          <h2 className={board.sectionTitle}>대기</h2>
          <p className={styles.hint}>시스템이 자동으로 진행하는 중입니다…</p>
        </div>
      );
  }
}
