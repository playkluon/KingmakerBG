// 기반 스킬: skills/server-rooms/SKILL.md
import { defineConfig } from 'vitest/config';

// 서버 E2E 테스트 — 실제 Socket.IO 클라이언트로 방 흐름·마스킹·권한을 검증한다
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    testTimeout: 15000,
  },
});
