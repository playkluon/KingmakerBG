import { describe, it, expect } from 'vitest';
import { buildCardCatalog } from '@kingmakers/data';
import { reduce } from '@kingmakers/engine';
import type { GameState, ActionLogEntry, PlayerAction, PlayerId } from '@kingmakers/engine';
import { createInitialRoundState } from '@kingmakers/engine/src/roundState';

const catalog = buildCardCatalog();

describe('Secret Pact Betrayal Evaluation', () => {
  it('should penalize the proposer if pact is not honored', () => {
    let state: GameState = {
      schemaVersion: '0.2',
      seed: 1234,
      rngState: 1,
      phase: 'campaignActions',
      maxRounds: 5,
      round: {
        ...createInitialRoundState(1),
        candidatesRunning: ['candidate-01'],
        campaignTurnOrder: ['player-1' as PlayerId, 'player-2' as PlayerId, 'player-3' as PlayerId, 'player-4' as PlayerId],
        camps: {},
        conditionalSupporters: {},
        voterAssignments: {},
      },
      players: [
        { id: 'player-1', name: 'P1', reputation: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-2', name: 'P2', reputation: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-3', name: 'P3', reputation: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-4', name: 'P4', reputation: 5, voterEventHand: [], candidateEventHand: [] } as any,
      ],
      drawPiles: { voterEventDeck: ['event-v-01', 'event-v-02', 'event-v-03'] } as any,
      actionLog: [],
      roundHistory: [],
      auctionMode: 'simultaneousBlind',
      policyTracks: {} as any,
      partyValues: {},
      lastRoundResult: null,
      finalResult: null,
      nextLogSeq: 1,
    };

    // 1. 밀약 제안
    let res = reduce(state, { type: 'proposeSecretPact', actor: 'player-1' as PlayerId, counterparty: 'player-2' as PlayerId, promise: { kind: 'supportCandidate', candidateId: 'candidate-01' } }, catalog);
    state = (res as any).state as GameState;

    // 2. 밀약 수락
    res = reduce(state, { type: 'acceptSecretPact', actor: 'player-2' as PlayerId, proposer: 'player-1' as PlayerId }, catalog);
    state = (res as any).state as GameState;

    expect(state.round.activeSecretPacts).toHaveLength(1);

    // 3. 점수 정산 (아무 행동도 안 했으므로 배신으로 간주되어야 함)
    state = { ...state, phase: 'roundScoring' };
    res = reduce(state, { type: 'scoreRound' }, catalog);
    state = (res as any).state as GameState;

    // 배신자(player-1) 평판 하락, 피해자(player-2) 유권자 이벤트 2장 획득
    const p1 = state.players.find(p => p.id === 'player-1')!;
    const p2 = state.players.find(p => p.id === 'player-2')!;

    expect(p1.reputation).toBe(3); // 5 - 2
    expect(p1.betrayedSecretPact).toBe(true);
    expect(p2.voterEventHand).toHaveLength(2);
  });

  it('should not penalize if the pact is honored via conditional support', () => {
    let state: GameState = {
      schemaVersion: '0.2',
      seed: 1234,
      rngState: 1,
      phase: 'campaignActions',
      maxRounds: 5,
      round: {
        ...createInitialRoundState(1),
        candidatesRunning: ['candidate-01'],
        campaignTurnOrder: ['player-1' as PlayerId, 'player-2' as PlayerId, 'player-3' as PlayerId, 'player-4' as PlayerId],
        campaignActiveIndex: 0,
        camps: {},
        conditionalSupporters: {},
        voterAssignments: {},
      },
      players: [
        { id: 'player-1', name: 'P1', reputation: 5, money: 5, organization: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-2', name: 'P2', reputation: 5, money: 5, organization: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-3', name: 'P3', reputation: 5, money: 5, organization: 5, voterEventHand: [], candidateEventHand: [] } as any,
        { id: 'player-4', name: 'P4', reputation: 5, money: 5, organization: 5, voterEventHand: [], candidateEventHand: [] } as any,
      ],
      drawPiles: { voterEventDeck: ['event-v-01', 'event-v-02', 'event-v-03'] } as any,
      actionLog: [],
      roundHistory: [],
      auctionMode: 'simultaneousBlind',
      policyTracks: {} as any,
      partyValues: {},
      lastRoundResult: null,
      finalResult: null,
      nextLogSeq: 1,
    };

    // 1. 밀약 제안 및 수락
    state = (reduce(state, { type: 'proposeSecretPact', actor: 'player-1' as PlayerId, counterparty: 'player-2' as PlayerId, promise: { kind: 'supportCandidate', candidateId: 'candidate-01' } }, catalog) as any).state as GameState;
    state = (reduce(state, { type: 'acceptSecretPact', actor: 'player-2' as PlayerId, proposer: 'player-1' as PlayerId }, catalog) as any).state as GameState;

    // 2. 조건지지 실행
    state = (reduce(state, { type: 'conditionalSupport', actor: 'player-1' as PlayerId, candidateId: 'candidate-01' }, catalog) as any).state as GameState;

    // 3. 점수 정산
    state = { ...state, phase: 'roundScoring' };
    state = (reduce(state, { type: 'scoreRound' }, catalog) as any).state as GameState;

    const p1 = state.players.find(p => p.id === 'player-1')!;
    const p2 = state.players.find(p => p.id === 'player-2')!;

    // 배신 아님
    expect(p1.reputation).toBe(5); 
    expect(p1.betrayedSecretPact).toBeFalsy();
    expect(p2.voterEventHand).toHaveLength(0);
  });
});
