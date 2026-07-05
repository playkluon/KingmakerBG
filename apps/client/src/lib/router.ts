// 기반 스킬: skills/client-lobby-table/SKILL.md
// 초소형 경로 라우터 — /room/:id(/table|/play|/watch) 4개 경로면 충분해 라우터 라이브러리를 쓰지 않는다.
import { useEffect, useState } from 'react';

export interface Route {
  screen: 'home' | 'room-entry' | 'table' | 'play' | 'watch' | 'not-found';
  roomId: string | null;
}

/** pathname을 Route로 해석한다 */
export function parsePath(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { screen: 'home', roomId: null };
  const match = /^\/room\/([A-Za-z0-9]+)(?:\/(table|play|watch))?\/?$/.exec(pathname);
  if (!match) return { screen: 'not-found', roomId: null };
  const roomId = match[1]!;
  const suffix = match[2];
  if (suffix === 'table') return { screen: 'table', roomId };
  if (suffix === 'play') return { screen: 'play', roomId };
  if (suffix === 'watch') return { screen: 'watch', roomId };
  return { screen: 'room-entry', roomId };
}

/** history API로 이동하고 라우트 구독자에게 알린다 */
export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** 현재 라우트를 구독하는 훅 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname));
  useEffect(() => {
    const onChange = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return route;
}
