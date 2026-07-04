---
name: setup
description: pnpm 모노레포 초기 구조 — engine/data 패키지 + server/client 앱 골격
---

# Skill 1 — 모노레포 초기 설정 (§26 1단계 준비)

## 생성 파일
```
pnpm-workspace.yaml           # packages/*, apps/*
package.json                  # 루트: dev/build/test 스크립트
tsconfig.base.json            # strict: true, 공통 옵션
.gitignore  .env.example
packages/engine/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts                # 공개 API 배럴
packages/data/
  package.json  tsconfig.json
  src/index.ts
apps/server/
  package.json  tsconfig.json
  src/index.ts                # Express + Socket.IO 부팅 골격
apps/client/                  # pnpm create vite (react-ts)
  src/main.tsx  src/App.tsx
  src/stores/  src/screens/  src/components/  src/socket/
```

## 규칙
- `packages/engine`은 dependencies **0개** (devDependencies로 vitest/typescript만). zod조차 넣지 않는다 — 스키마 검증은 packages/data 담당
- `apps/server`는 engine·data를 workspace 의존으로 참조
- `apps/client`는 engine의 **타입·셀렉터만** import (reducer 호출 금지 — CLAUDE.md 코딩 규칙)
- 루트 스크립트: `pnpm dev`(server+client 동시), `pnpm test`(전체 vitest), `pnpm build`

## 수용 기준
- `pnpm install && pnpm -r build && pnpm test` 통과 (빈 테스트 1개 포함)
- `pnpm dev`로 서버(:3001)와 클라이언트(:5173) 동시 기동, 소켓 연결 로그 확인
