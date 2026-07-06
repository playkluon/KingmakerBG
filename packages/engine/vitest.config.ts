// 기반 스킬: skills/setup/SKILL.md
import { defineConfig } from 'vitest/config';

// 엔진 단위 테스트 설정 — GAME_SPEC.md §28 최소 테스트 목록을 이 러너로 커버한다
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
});
