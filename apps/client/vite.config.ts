// 기반 스킬: skills/setup/SKILL.md
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 워크스페이스 내부 패키지는 빌드 산출물(dist, CJS)이 아니라 TS 소스를 직접 참조한다.
// — CJS named export 인터롭 문제 회피 + 엔진/데이터 수정이 즉시 반영된다.
const engineSrc = fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url));
const dataSrc = fileURLToPath(new URL('../../packages/data/src/index.ts', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// 클라이언트 개발 서버 설정 — .env는 모노레포 루트에서 읽는다
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  return {
    plugins: [react()],
    envDir: '../..',
    base: env.VITE_BASE_PATH ?? '/',
    server: { port: 5173 },
    resolve: {
      alias: {
        '@kingmakers/engine': engineSrc,
        '@kingmakers/data': dataSrc,
      },
    },
  };
});
