/// <reference types="vite/client" />
// 기반 스킬: skills/setup/SKILL.md

// 루트 .env에 정의된 클라이언트 환경변수 타입
interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_SERVER_URL?: string;
  readonly VITE_SOCKET_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
