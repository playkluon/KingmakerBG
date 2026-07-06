#!/usr/bin/env tsx
// 기반 스킬: skills/advanced-rules/SKILL.md (부록 A-19)
import { buildAiTrainingReport, type AiTrainingReport } from '../packages/data/sim/aiReport';
import { heuristicBotPolicy, simulateGameWithPolicy, type BotPolicy } from '../packages/data/sim/aiSimulation';
import { BotRng } from '../packages/data/sim/bot';
import { chooseMonteCarloAction } from '../packages/data/sim/monteCarlo';
import { buildCardCatalog } from '../packages/data/src/catalog';

interface CliOptions {
  games: number;
  seed: number;
  policy: 'heuristic' | 'monte-carlo';
  samples: number;
  depth: number;
  json: boolean;
}

const DEFAULT_OPTIONS: CliOptions = {
  games: 20,
  seed: 1,
  policy: 'heuristic',
  samples: 2,
  depth: 30,
  json: false,
};

function readValue(argv: string[], index: number, name: string): { value: string; nextIndex: number } {
  const current = argv[index]!;
  const inline = current.split('=')[1];
  if (inline != null) return { value: inline, nextIndex: index };
  const next = argv[index + 1];
  if (!next) throw new Error(`${name} 값을 입력하세요.`);
  return { value: next, nextIndex: index + 1 };
}

function readNumber(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} 값은 양의 정수여야 합니다: ${value}`);
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULT_OPTIONS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg.startsWith('--games')) {
      const parsed = readValue(argv, i, '--games');
      options.games = readNumber(parsed.value, '--games');
      i = parsed.nextIndex;
      continue;
    }
    if (arg.startsWith('--seed')) {
      const parsed = readValue(argv, i, '--seed');
      options.seed = readNumber(parsed.value, '--seed');
      i = parsed.nextIndex;
      continue;
    }
    if (arg.startsWith('--samples')) {
      const parsed = readValue(argv, i, '--samples');
      options.samples = readNumber(parsed.value, '--samples');
      i = parsed.nextIndex;
      continue;
    }
    if (arg.startsWith('--depth')) {
      const parsed = readValue(argv, i, '--depth');
      options.depth = readNumber(parsed.value, '--depth');
      i = parsed.nextIndex;
      continue;
    }
    if (arg.startsWith('--policy')) {
      const parsed = readValue(argv, i, '--policy');
      if (parsed.value !== 'heuristic' && parsed.value !== 'monte-carlo') {
        throw new Error('--policy 값은 heuristic 또는 monte-carlo 여야 합니다.');
      }
      options.policy = parsed.value;
      i = parsed.nextIndex;
      continue;
    }
    throw new Error(`알 수 없는 옵션입니다: ${arg}`);
  }
  return options;
}

function policyFor(options: CliOptions): { name: string; policy: BotPolicy } {
  if (options.policy === 'heuristic') return { name: 'heuristic', policy: heuristicBotPolicy };
  return {
    name: `monte-carlo(samples=${options.samples},depth=${options.depth})`,
    policy: ({ state, catalog, actor, rng }) =>
      chooseMonteCarloAction(state, catalog, actor, new BotRng(rng.int(1_000_000_000)), {
        samplesPerAction: options.samples,
        rolloutDepth: options.depth,
      }),
  };
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function printHumanReport(report: AiTrainingReport, elapsedMs: number): void {
  const { winnerScoreStats } = report.balance;
  const winnerTargetRate = winnerScoreStats.inTargetRangeCount / Math.max(1, report.gamesPlayed);
  const coWinnerRate = report.balance.coWinnerGames / Math.max(1, report.gamesPlayed);

  console.log(`[AI self-play] ${report.policyName}`);
  console.log(`games=${report.gamesPlayed} seeds=${report.seedRange.first}-${report.seedRange.last} elapsedMs=${elapsedMs}`);
  console.log(
    `winnerScore min=${winnerScoreStats.min} max=${winnerScoreStats.max} mean=${winnerScoreStats.mean.toFixed(2)} targetRate=${pct(winnerTargetRate)}`,
  );
  console.log(`agendaRate=${pct(report.balance.agendaAchievementRate)} coWinnerRate=${pct(coWinnerRate)}`);
  console.log(`decisions total=${report.decisionSummary.totalDecisions} meanPerGame=${report.decisionSummary.meanDecisionsPerGame}`);
  console.log('objectives:');
  for (const item of report.objectives) {
    console.log(`- ${item.ok ? 'OK' : 'WATCH'} ${item.label}: value=${item.value} target=${item.target}`);
  }
  console.log('topActions:');
  for (const action of report.decisionSummary.actionStats.slice(0, 8)) {
    console.log(`- ${action.actionType}: count=${action.count} meanDelta=${action.meanScoreDelta}`);
  }
  console.log('recommendations:');
  for (const recommendation of report.recommendations) {
    console.log(`- ${recommendation}`);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const catalog = buildCardCatalog();
  const selected = policyFor(options);
  const startedAt = Date.now();
  const seeds = Array.from({ length: options.games }, (_, index) => options.seed + index);
  const results = seeds.map((seed) => simulateGameWithPolicy(seed, catalog, selected.policy));
  const report = buildAiTrainingReport(results, { policyName: selected.name });
  const elapsedMs = Date.now() - startedAt;

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printHumanReport(report, elapsedMs);
}

main();
