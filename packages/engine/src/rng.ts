// 기반 스킬: skills/engine-core/SKILL.md
// mulberry32 seed RNG — 부록 A-5: Date.now()/Math.random() 금지, 상태를 GameState.rngState로 보관해 주입한다.
// 모든 함수는 순수하다: 이전 상태를 변형하지 않고 (결과값, 다음 상태)를 함께 반환한다.

/** RNG 내부 상태 — 32비트 정수 하나로 표현된다 */
export type RngState = number;

/** seed로부터 초기 RNG 상태를 만든다 */
export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/**
 * mulberry32 한 스텝 진행.
 * 표준 구현의 클로저 변수 `a`에 해당하는 값을 다음 상태로 반환하고,
 * 그 값을 스크램블한 결과를 [0,1) 실수로 반환한다.
 */
export function nextRandom(state: RngState): { value: number; nextState: RngState } {
  const nextState = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState };
}

/** [0, maxExclusive) 범위의 정수 난수 */
export function nextInt(state: RngState, maxExclusive: number): { value: number; nextState: RngState } {
  const { value, nextState } = nextRandom(state);
  return { value: Math.floor(value * maxExclusive), nextState };
}

/** Fisher-Yates 셔플 — 원본 배열은 변경하지 않는다 */
export function shuffle<T>(state: RngState, items: readonly T[]): { items: T[]; nextState: RngState } {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const draw = nextInt(current, i + 1);
    current = draw.nextState;
    const j = draw.value;
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return { items: result, nextState: current };
}
