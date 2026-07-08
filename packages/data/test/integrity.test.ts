// 기반 스킬: skills/card-data/SKILL.md
import { describe, expect, it } from 'vitest';
import { AGENDAS } from '../src/agendas';
import { CANDIDATES } from '../src/candidates';
import { CANDIDATE_EVENTS } from '../src/candidateEvents';
import { ISSUES } from '../src/issues';
import { PARTIES } from '../src/parties';
import { PROMISES } from '../src/promises';
import {
  AgendaConditionSchema,
  CandidateCardSchema,
  EventCardSchema,
  IssueCardSchema,
  PartyCardSchema,
  PromiseCardSchema,
  SecretAgendaCardSchema,
  VoterCardSchema,
} from '../src/schemas';
import { opposingTag, tagFor, VOTER_GROUPS } from '../src/tags';
import { VOTERS } from '../src/voters';
import { VOTER_EVENTS } from '../src/voterEvents';

function expectUniqueIds(items: Array<{ id: string }>, label: string) {
  const ids = items.map((i) => i.id);
  expect(new Set(ids).size, `${label} ID 중복`).toBe(ids.length);
}

describe('§4 카드 수량', () => {
  it('후보 21 / 공약 30 / 유권자 48 / 이슈 16 / 후보이벤트 30 / 유권자이벤트 30 / 의제 16 / 정당 7', () => {
    expect(CANDIDATES).toHaveLength(21);
    expect(PROMISES).toHaveLength(30);
    expect(VOTERS).toHaveLength(48);
    expect(ISSUES).toHaveLength(16);
    expect(CANDIDATE_EVENTS).toHaveLength(30);
    expect(VOTER_EVENTS).toHaveLength(30);
    expect(AGENDAS).toHaveLength(16);
    expect(PARTIES).toHaveLength(7);
  });
});

describe('zod 파싱 + ID 유일성', () => {
  it('모든 후보 카드가 스키마를 통과하고 ID가 유일하다', () => {
    CANDIDATES.forEach((c) => expect(() => CandidateCardSchema.parse(c)).not.toThrow());
    expectUniqueIds(CANDIDATES, 'candidate');
  });

  it('모든 공약 카드가 스키마를 통과하고 ID가 유일하다', () => {
    PROMISES.forEach((p) => expect(() => PromiseCardSchema.parse(p)).not.toThrow());
    expectUniqueIds(PROMISES, 'promise');
  });

  it('모든 유권자 카드가 스키마를 통과하고 ID가 유일하다', () => {
    VOTERS.forEach((v) => expect(() => VoterCardSchema.parse(v)).not.toThrow());
    expectUniqueIds(VOTERS, 'voter');
  });

  it('모든 이슈 카드가 스키마를 통과하고 ID가 유일하다', () => {
    ISSUES.forEach((i) => expect(() => IssueCardSchema.parse(i)).not.toThrow());
    expectUniqueIds(ISSUES, 'issue');
  });

  it('모든 정당 카드가 스키마를 통과하고 ID가 유일하다 (개편안 A)', () => {
    PARTIES.forEach((p) => expect(() => PartyCardSchema.parse(p)).not.toThrow());
    expectUniqueIds(PARTIES, 'party');
  });

  it('후보 21명이 7개 정당에 정확히 3명씩 소속된다 (개편안 A — 손패 균형의 근거)', () => {
    const partyIds = new Set(PARTIES.map((p) => p.id));
    const counts = new Map<string, number>();
    for (const c of CANDIDATES) {
      expect(partyIds.has(c.party), c.id + '의 party가 실존 정당이 아님: ' + c.party).toBe(true);
      counts.set(c.party, (counts.get(c.party) ?? 0) + 1);
    }
    for (const partyId of partyIds) {
      expect(counts.get(partyId), partyId + ' 소속 후보 수').toBe(3);
    }
  });

  it('모든 이벤트 카드(후보+유권자)가 스키마를 통과하고 ID가 유일하다', () => {
    const allEvents = [...CANDIDATE_EVENTS, ...VOTER_EVENTS];
    allEvents.forEach((e) => expect(() => EventCardSchema.parse(e)).not.toThrow());
    expectUniqueIds(allEvents, 'event');
  });

  it('모든 의제 카드가 스키마를 통과하고 ID가 유일하다', () => {
    AGENDAS.forEach((a) => expect(() => SecretAgendaCardSchema.parse(a)).not.toThrow());
    expectUniqueIds(AGENDAS, 'agenda');
  });
});

describe('부록 A-17: 이벤트 카드 효과', () => {
  it('candidateVotesDelta/resourceDelta 효과는 0이 아니다', () => {
    [...CANDIDATE_EVENTS, ...VOTER_EVENTS].forEach((e) => {
      if (e.effect.kind === 'candidateVotesDelta' || e.effect.kind === 'resourceDelta') {
        expect(e.effect.amount).not.toBe(0);
      }
    });
  });

  it('groupInfluence 효과의 group은 실제 유권자 그룹 값이다', () => {
    [...CANDIDATE_EVENTS, ...VOTER_EVENTS].forEach((e) => {
      if (e.effect.kind === 'groupInfluence') {
        expect(VOTER_GROUPS).toContain(e.effect.group);
        expect(e.effect.amount).toBeGreaterThan(0);
      }
    });
  });

  it('유권자 이벤트 30장은 전부 groupInfluence 효과다 (부록 A-17: 헤드라인이 그룹을 명시)', () => {
    VOTER_EVENTS.forEach((e) => expect(e.effect.kind).toBe('groupInfluence'));
  });
});

describe('참조 무결성', () => {
  it('공약의 reactionTag는 자신의 policyMove(track, direction)에서 파생된 태그와 일치한다 (부록 A-9)', () => {
    PROMISES.forEach((p) => {
      expect(p.reactionTag, `${p.id} reactionTag 불일치`).toBe(tagFor(p.policyMove.track, p.policyMove.direction));
    });
  });

  it('유권자의 conflictTag는 preferredTag의 정반대 태그와 일치한다 (부록 A-9)', () => {
    VOTERS.forEach((v) => {
      expect(v.conflictTag, `${v.id} conflictTag 불일치`).toBe(opposingTag(v.preferredTag));
    });
  });

  it('유권자 그룹은 전부 유효한 VOTER_GROUPS 값이다', () => {
    VOTERS.forEach((v) => expect(VOTER_GROUPS).toContain(v.group));
  });

  it('후보의 supportedVoterGroups는 전부 유효한 그룹이다', () => {
    CANDIDATES.forEach((c) => c.supportedVoterGroups.forEach((g) => expect(VOTER_GROUPS).toContain(g)));
  });

  it('공약 효과가 참조하는 유권자 그룹은 전부 유효하다', () => {
    PROMISES.forEach((p) => {
      if (p.effect.kind === 'extraVotesIfGroupRevealed' || p.effect.kind === 'backerInfluence') {
        expect(VOTER_GROUPS).toContain(p.effect.group);
      }
    });
  });

  it('의제가 참조하는 후보 ID는 CANDIDATES에 실재한다', () => {
    const candidateIds = new Set(CANDIDATES.map((c) => c.id));
    AGENDAS.forEach((a) => {
      if (a.condition.kind === 'candidateWon' || a.condition.kind === 'candidateWonAtMost') {
        expect(candidateIds.has(a.condition.candidateId), `${a.id}가 참조하는 후보 없음`).toBe(true);
      }
    });
  });

  it('의제가 참조하는 유권자 그룹은 전부 유효하다', () => {
    AGENDAS.forEach((a) => {
      if (a.condition.kind === 'influenceLeader' || a.condition.kind === 'notInfluenceLeader') {
        expect(VOTER_GROUPS).toContain(a.condition.group);
      }
      if (a.condition.kind === 'influenceLeaderAny') {
        a.condition.groups.forEach((g) => expect(VOTER_GROUPS).toContain(g));
      }
    });
  });
});

describe('§17 의제 조건 유형', () => {
  const VALID_KINDS = [
    'policyAtLeast',
    'policyBetween',
    'noExtremePolicies',
    'influenceLeader',
    'influenceLeaderAny',
    'notInfluenceLeader',
    'candidateWon',
    'candidateWonAtMost',
    'reputationAtLeast',
    'reputationRankAtMost',
    'remainingMoneyAtLeast',
  ] as const;

  it('의제 16장이 §17의 조건 유형만 사용한다', () => {
    AGENDAS.forEach((a) => {
      expect(() => AgendaConditionSchema.parse(a.condition)).not.toThrow();
      expect(VALID_KINDS).toContain(a.condition.kind);
    });
  });

  it('§17의 11가지 조건 유형이 최소 1장씩은 실제로 사용된다', () => {
    const usedKinds = new Set(AGENDAS.map((a) => a.condition.kind));
    VALID_KINDS.forEach((kind) => expect(usedKinds.has(kind), `${kind} 미사용`).toBe(true));
  });

  it('의제 배점은 §17 기준 8-13 VP 범위 안에 있다', () => {
    AGENDAS.forEach((a) => {
      expect(a.points).toBeGreaterThanOrEqual(8);
      expect(a.points).toBeLessThanOrEqual(13);
    });
  });
});

describe('§11 MVP 활성 후보 능력', () => {
  it('모금 보너스·노동자 접촉 할인·압박 할인·공약 제한·평판 손실이 각각 최소 1장에 활성화되어 있다', () => {
    const abilityKinds = CANDIDATES.flatMap((c) => c.abilities.filter((a) => a.active).map((a) => a.kind));
    expect(abilityKinds).toContain('fundraiseBonus');
    expect(abilityKinds).toContain('voterContactDiscount');
    expect(abilityKinds).toContain('policyPressureDiscount');
    expect(abilityKinds).toContain('promiseRestriction');
    expect(abilityKinds).toContain('reputationLossOnPromise');
  });

  it('노동자 접촉 비용 할인은 실제로 laborers 그룹을 대상으로 한다 (§11 원문: "노동자 유권자 접촉 비용 -1")', () => {
    const discount = CANDIDATES.flatMap((c) => c.abilities)
      .filter((a): a is Extract<typeof a, { kind: 'voterContactDiscount' }> => a.kind === 'voterContactDiscount')
      .find((a) => a.active);
    expect(discount?.group).toBe('laborers');
  });
});
