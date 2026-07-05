// 기반 스킬: skills/ux-feedback/SKILL.md
// §30-2 getScoreRoute 단위 테스트 — 캠프 역할·정책 압박 기여·유권자 통제에 따라 가능한 VP 출처가 달라진다
import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { getScoreRoute } from '../src/selectors/scoreRoute';
import {
  SCORE_CONDITIONAL_SUPPORT_SUCCESS,
  SCORE_MAJOR_BACKER_WIN,
  SCORE_POLICY_PRESSURE_SUCCESS,
  SCORE_PROMISE_BONUS_MAJOR_BACKER,
  SCORE_RUNNER_UP_MAJOR_BACKER,
  SCORE_VOTER_SUPPORT_WINNER,
} from '../src/constants';
import { emptyCatalog, setupAtCampaign } from './fixtures';

describe('§30-2 getScoreRoute', () => {
  it('출마 후보의 majorBacker면 당선·공약·2위 보너스 3종이 나열된다', () => {
    const state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    const winningCandidate = state.round.candidatesRunning[0]!;
    const majorBacker = state.round.camps[winningCandidate]!.majorBacker!;

    const entries = getScoreRoute(state, majorBacker);
    const amounts = entries.map((e) => e.amount).sort((a, b) => a - b);
    expect(amounts).toContain(SCORE_MAJOR_BACKER_WIN);
    expect(amounts).toContain(SCORE_PROMISE_BONUS_MAJOR_BACKER);
    expect(amounts).toContain(SCORE_RUNNER_UP_MAJOR_BACKER);
    entries.forEach((e) => expect(e.candidateId).toBe(winningCandidate));
  });

  it('경매에서 탈락해 캠프 역할이 없으면 캠프 기반 출처가 없다', () => {
    const state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    // 4인 기준 입찰 6/4/3/2 중 최저 입찰자(player-3)는 출마 후보 3명 중 어느 캠프에도 들지 못한다
    const isInAnyCamp = state.round.candidatesRunning.some((id) => {
      const camp = state.round.camps[id]!;
      return camp.majorBacker === 'player-3' || camp.coBacker === 'player-3' || camp.organizer === 'player-3';
    });
    expect(isInAnyCamp).toBe(false);
    expect(getScoreRoute(state, 'player-3')).toHaveLength(0);
  });

  it('조건부 지지를 실행하면 그 후보 몫으로 출처가 추가된다', () => {
    let state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    const target = state.round.candidatesRunning[1]!;
    const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
    const result = reduce(state, { type: 'conditionalSupport', actor, candidateId: target }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    state = result.state;

    const entries = getScoreRoute(state, actor);
    expect(entries.some((e) => e.amount === SCORE_CONDITIONAL_SUPPORT_SUCCESS && e.candidateId === target)).toBe(true);
  });

  // 여러 점수 출처가 우연히 같은 배점(1 VP)을 공유하므로 amount만으로는 구분할 수 없다 — label로 특정한다
  const isPressureEntry = (e: { label: string; amount: number }) =>
    e.label.includes('압박') && e.amount === SCORE_POLICY_PRESSURE_SUCCESS;
  const isVoterSupportEntry = (e: { label: string; amount: number }) =>
    e.label.includes('유권자가 당선 후보를 지지') && e.amount === SCORE_VOTER_SUPPORT_WINNER;

  it('정책을 압박하면 압박 성공 출처가 추가된다', () => {
    let state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
    expect(getScoreRoute(state, actor).some(isPressureEntry)).toBe(false);

    const result = reduce(state, { type: 'pressurePolicy', actor, track: 'economy', direction: 1 }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    state = result.state;

    expect(getScoreRoute(state, actor).some(isPressureEntry)).toBe(true);
  });

  it('유권자를 단독 통제하면 유권자 지지 출처가 추가된다', () => {
    let state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    const actor = state.round.campaignTurnOrder[state.round.campaignActiveIndex]!;
    expect(getScoreRoute(state, actor).some(isVoterSupportEntry)).toBe(false);

    const voterId = state.round.votersRevealed[0]!;
    const result = reduce(state, { type: 'contactVoter', actor, voterId }, emptyCatalog());
    if (!result.ok) throw new Error(result.reason);
    state = result.state;

    expect(getScoreRoute(state, actor).some(isVoterSupportEntry)).toBe(true);
  });

  it('4-5인 게임에는 킹메이커 보너스 출처가 없다', () => {
    const state = setupAtCampaign(1, ['A', 'B', 'C', 'D']);
    expect(getScoreRoute(state, 'player-0').some((e) => e.label.includes('킹메이커'))).toBe(false);
  });
});
