// 기반 스킬: skills/card-data/SKILL.md
import { defineConfig } from 'vitest/config';

// 카드 데이터 무결성 테스트 설정 — GAME_SPEC.md §28, §4 수량/참조 무결성을 이 러너로 커버한다
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
});
