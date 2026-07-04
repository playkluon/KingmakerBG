// 기반 스킬: skills/setup/SKILL.md
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, SCHEMA_VERSION } from '../src';

// Phase 0 스모크 테스트 — 테스트 러너와 엔진 패키지 연결 확인용
describe('엔진 패키지 스모크', () => {
  it('스키마 버전이 GAME_SPEC.md 기준 0.2다', () => {
    expect(SCHEMA_VERSION).toBe('0.2');
  });

  it('엔진 버전 문자열이 존재한다', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
