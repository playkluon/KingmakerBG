// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
// 밸런스 시뮬레이션용 결정적 봇 난수 — 엔진의 mulberry32(createRng/nextInt)를 그대로 재사용해
// "봇의 선택"도 시뮬레이션 seed 하나로 완전히 재현되게 한다(부록 A-5 결정성 원칙을 시뮬레이션에도 적용).
import { createRng, nextInt } from '@kingmakers/engine';
import type { RngState } from '@kingmakers/engine';

export class BotRng {
  private state: RngState;

  constructor(seed: number) {
    this.state = createRng(seed);
  }

  /** [0, maxExclusive) 정수 */
  int(maxExclusive: number): number {
    const draw = nextInt(this.state, maxExclusive);
    this.state = draw.nextState;
    return draw.value;
  }

  /** 배열에서 무작위 항목 1개 */
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }
}
