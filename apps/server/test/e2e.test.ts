// 기반 스킬: skills/server-rooms/SKILL.md
// M4 서버측 E2E — 실제 Socket.IO 클라이언트 5개(호스트+참가자4)로
// 방 생성→입장→ready→start→1라운드 완주, 마스킹, 권한, 재접속을 검증한다.
import type { AddressInfo } from 'node:net';
import { CANDIDATES } from '@kingmakers/data';
import type { GameAction, GameState, PlayerId } from '@kingmakers/engine';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearRooms } from '../src/rooms';
import { createGameServer, type GameServer } from '../src/server';

let server: GameServer;
let baseUrl = '';
const openSockets: ClientSocket[] = [];

beforeAll(async () => {
  server = createGameServer('*');
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const address = server.httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${address.port}`;
});

afterAll(async () => {
  for (const socket of openSockets) socket.disconnect();
  server.io.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
});

/** 새 클라이언트 소켓을 만들고 연결될 때까지 기다린다 */
function connect(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, { transports: ['websocket'] });
    openSockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** emit + 콜백을 Promise로 감싼다 */
function emitAck<T = Record<string, unknown>>(socket: ClientSocket, event: string, payload: unknown): Promise<T & { ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: T & { ok: boolean; reason?: string }) => resolve(response));
  });
}

/** 다음 game:view 수신을 기다린다 */
function nextView(socket: ClientSocket): Promise<GameState> {
  return new Promise((resolve) => socket.once('game:view', (view: GameState) => resolve(view)));
}

interface Participant {
  socket: ClientSocket;
  token: string;
  name: string;
  playerId: PlayerId;
}

/** 방 생성→4명 입장→전원 ready→start까지 진행하고 참가자·호스트 핸들을 돌려준다 */
async function setupStartedRoom(): Promise<{ roomId: string; hostToken: string; host: ClientSocket; participants: Participant[] }> {
  const host = await connect();
  const created = await emitAck<{ roomId: string; hostToken: string }>(host, 'room:create', { name: '호스트' });
  expect(created.ok).toBe(true);
  const { roomId, hostToken } = created;
  await emitAck(host, 'room:attach', { roomId, token: hostToken });

  const names = ['갑', '을', '병', '정'];
  const joined: Array<{ socket: ClientSocket; token: string; name: string }> = [];
  for (const name of names) {
    const socket = await connect();
    const join = await emitAck<{ playerToken: string }>(socket, 'room:join', { roomId, name });
    expect(join.ok).toBe(true);
    await emitAck(socket, 'room:attach', { roomId, token: join.playerToken });
    joined.push({ socket, token: join.playerToken, name });
  }
  for (const p of joined) {
    const ready = await emitAck(p.socket, 'room:ready', { roomId, token: p.token, ready: true });
    expect(ready.ok).toBe(true);
  }

  // 시작 — 각 참가자는 game:view를 받고, 재접속(attach)으로 자기 좌석을 확인한다
  const viewPromises = joined.map((p) => nextView(p.socket));
  const started = await emitAck(host, 'room:start', { roomId, token: hostToken });
  expect(started.ok).toBe(true);
  await Promise.all(viewPromises);

  const participants: Participant[] = [];
  for (const p of joined) {
    const attach = await emitAck<{ myPlayerId: PlayerId | null }>(p.socket, 'room:attach', { roomId, token: p.token });
    expect(attach.myPlayerId).not.toBeNull();
    participants.push({ ...p, playerId: attach.myPlayerId! });
  }
  return { roomId, hostToken, host, participants };
}

/** playerId로 참가자를 찾는다 */
function byPlayerId(participants: Participant[], playerId: PlayerId): Participant {
  const found = participants.find((p) => p.playerId === playerId);
  if (!found) throw new Error(`참가자를 찾을 수 없습니다: ${playerId}`);
  return found;
}

/** 액션을 보내고 성공을 확인한 뒤, ack에 포함된 "내 액션이 반영된" 요청자 시점 뷰를 돌려받는다 */
async function act(roomId: string, sender: { socket: ClientSocket; token: string }, action: GameAction): Promise<GameState> {
  const result = await emitAck<{ view: GameState }>(sender.socket, 'game:action', { roomId, token: sender.token, action });
  if (!result.ok) throw new Error(`${action.type} 실패: ${result.reason}`);
  return result.view;
}

describe('M4 서버 E2E: 방 흐름·마스킹·권한·재접속', () => {
  it('방 생성→입장→ready→start→1라운드 완주 (경매→공약→캠페인→단일화→투표→정산→2라운드)', async () => {
    clearRooms();
    const { roomId, hostToken, host, participants } = await setupStartedRoom();

    // ── 시작 직후: auctionBidding + 마스킹 검증 ─────────────────
    const attach0 = await emitAck<{ view: GameState }>(participants[0]!.socket, 'room:attach', { roomId, token: participants[0]!.token });
    let view = attach0.view;
    expect(view.phase).toBe('auctionBidding');
    // 덱·seed·RNG는 어느 시점에도 노출되지 않는다
    expect(view.drawPiles.candidateDeck).toHaveLength(0);
    expect(view.seed).toBe(0);
    expect(view.rngState).toBe(0);
    // 내 비밀 의제는 보이고 타인 것은 물리적으로 없다
    const me = view.players.find((p) => p.id === participants[0]!.playerId)!;
    expect(me.secretAgendaId).not.toBeNull();
    for (const other of view.players.filter((p) => p.id !== me.id)) {
      expect(other.secretAgendaId).toBeNull();
    }

    // ── 경매: 서로 다른 후보에 6/4/3/2 입찰 ─────────────────────
    const candidates = view.round.candidatesRevealed;
    const amounts = [6, 4, 3, 2];
    for (let i = 0; i < 4; i += 1) {
      const seatPlayer = byPlayerId(participants, `player-${i}` as PlayerId);
      view = await act(roomId, seatPlayer, {
        type: 'placeBid',
        actor: seatPlayer.playerId,
        allocations: { [candidates[i]!]: amounts[i]! },
      });
    }

    // 경매 중 타인 입찰 마스킹: player-1의 뷰에서 player-0의 배분 내용은 비어 있어야 한다
    const p1 = byPlayerId(participants, 'player-1' as PlayerId);
    const p1Attach = await emitAck<{ view: GameState }>(p1.socket, 'room:attach', { roomId, token: p1.token });
    const p0Bid = p1Attach.view.round.bids['player-0' as PlayerId]!;
    expect(Object.keys(p0Bid.allocations)).toHaveLength(0);
    const p1OwnBid = p1Attach.view.round.bids['player-1' as PlayerId]!;
    expect(Object.keys(p1OwnBid.allocations)).toHaveLength(1); // 자기 입찰은 그대로 보인다

    for (let i = 0; i < 4; i += 1) {
      const seatPlayer = byPlayerId(participants, `player-${i}` as PlayerId);
      view = await act(roomId, seatPlayer, { type: 'confirmAuctionBids', actor: seatPlayer.playerId });
    }
    // 부록 A-13: 서버가 액션 직후 자동 진행 가능한 곳까지 곧바로 이어가므로
    // auctionResolved를 거쳐 곧장 promiseSelection에 도달한다 (수동 runUntilPlayerAction 불필요)
    expect(view.phase).toBe('promiseSelection');

    // ── 공약 선택 (majorBacker 전원) ────────────────────────────
    for (const candidateId of [...view.round.candidatesRunning]) {
      if (view.phase !== 'promiseSelection') break;
      const camp = view.round.camps[candidateId]!;
      if (!camp.majorBacker) continue;
      const backer = byPlayerId(participants, camp.majorBacker);
      view = await act(roomId, backer, {
        type: 'selectPromise',
        actor: camp.majorBacker,
        candidateId,
        promiseId: camp.promiseOptions[0]!,
      });
    }
    if (view.phase === ('promiseSelection' as string)) {
      view = await act(roomId, { socket: host, token: hostToken }, { type: 'autoSelectPromises' });
    }
    // voterReveal도 자동 진행되어 곧장 campaignActions에서 멈춘다
    expect(view.phase).toBe('campaignActions');

    // ── 캠페인: 라운드로빈 8액션 (전원 조건지지) ─────────────────
    const supportTarget = view.round.candidatesRunning[0]!;
    for (let i = 0; i < 8; i += 1) {
      const current = view.round.campaignTurnOrder[view.round.campaignActiveIndex]!;
      const actor = byPlayerId(participants, current);
      view = await act(roomId, actor, { type: 'conditionalSupport', actor: current, candidateId: supportTarget });
    }
    expect(view.phase).toBe('unification');

    // ── 단일화: majorBacker 전원 스킵 ───────────────────────────
    const majorBackers = [
      ...new Set(view.round.candidatesRunning.map((id) => view.round.camps[id]!.majorBacker).filter((id): id is PlayerId => id != null)),
    ];
    for (const backerId of majorBackers) {
      const backer = byPlayerId(participants, backerId);
      view = await act(roomId, backer, { type: 'skipUnification', actor: backerId });
    }

    // ── 투표→정책→정산까지 자동 진행됨 (부록 A-13), 선택형 당선 효과만 실카드 조회로 처리 ──
    if (view.phase === 'electionEffectSelection') {
      const winner = view.round.winnerCandidateId!;
      const card = CANDIDATES.find((c) => c.id === winner)!;
      const backer = byPlayerId(participants, view.round.camps[winner]!.majorBacker!);
      const choice =
        card.electionEffect.kind === 'choosePolicyMove'
          ? { track: card.electionEffect.options[0]!.track, direction: card.electionEffect.options[0]!.direction }
          : { track: 'economy' as const, direction: 1 as const };
      view = await act(roomId, backer, { type: 'selectElectionPolicyMove', actor: backer.playerId, ...choice });
    }

    // 1라운드가 끝나고 2라운드 경매에 도달한다 (풀게임 5라운드 기본)
    expect(view.round.round).toBe(2);
    expect(view.phase).toBe('auctionBidding');
    expect(view.roundHistory).toHaveLength(1);
    expect(view.roundHistory[0]!.winnerCandidateId).not.toBeNull();
  });

  it('§20 권한: 타인 좌석 액션·비호스트 시스템 진행·관전자 액션이 전부 거부된다', async () => {
    clearRooms();
    const { roomId, participants } = await setupStartedRoom();
    const [pA, pB] = participants;

    // 타인 좌석의 액션
    const impersonation = await emitAck(pB!.socket, 'game:action', {
      roomId,
      token: pB!.token,
      action: { type: 'confirmAuctionBids', actor: pA!.playerId },
    });
    expect(impersonation.ok).toBe(false);
    expect(impersonation.reason).toContain('자기 좌석');

    // 비호스트의 시스템 진행
    const systemByPlayer = await emitAck(pA!.socket, 'game:action', {
      roomId,
      token: pA!.token,
      action: { type: 'runUntilPlayerAction' },
    });
    expect(systemByPlayer.ok).toBe(false);
    expect(systemByPlayer.reason).toContain('호스트');

    // 관전자(토큰 없음)의 액션
    const spectator = await connect();
    const spectatorAttach = await emitAck<{ role: string }>(spectator, 'room:attach', { roomId });
    expect(spectatorAttach.role).toBe('spectator');
    const spectatorAction = await emitAck(spectator, 'game:action', {
      roomId,
      token: '',
      action: { type: 'confirmAuctionBids', actor: pA!.playerId },
    });
    expect(spectatorAction.ok).toBe(false);
  });

  it('부록 A-2 재접속: 소켓을 끊고 새 소켓 + playerToken으로 좌석·뷰가 복원된다', async () => {
    clearRooms();
    const { roomId, participants } = await setupStartedRoom();
    const target = participants[0]!;

    target.socket.disconnect();

    const fresh = await connect();
    const reattach = await emitAck<{ role: string; myPlayerId: PlayerId | null; view: GameState | null }>(fresh, 'room:attach', {
      roomId,
      token: target.token,
    });
    expect(reattach.ok).toBe(true);
    expect(reattach.role).toBe('player');
    expect(reattach.myPlayerId).toBe(target.playerId);
    expect(reattach.view).not.toBeNull();
    // 복원된 뷰에도 내 비밀 의제가 보인다
    const mine = reattach.view!.players.find((p) => p.id === target.playerId)!;
    expect(mine.secretAgendaId).not.toBeNull();
  });

  it('spectator 뷰에는 어떤 비밀 의제도 없다', async () => {
    clearRooms();
    const { roomId } = await setupStartedRoom();
    const spectator = await connect();
    const attach = await emitAck<{ view: GameState }>(spectator, 'room:attach', { roomId });
    expect(attach.ok).toBe(true);
    for (const player of attach.view.players) {
      expect(player.secretAgendaId).toBeNull();
      expect(player.candidateEventHand).toHaveLength(0);
    }
  });

  it('부록 A-16: 비밀 pact는 당사자 외 어떤 시점(타 플레이어·호스트·관전자)에도 보이지 않는다', async () => {
    clearRooms();
    const { roomId, hostToken, host, participants } = await setupStartedRoom();

    // campaignActions까지 진입 (경매 → 공약)
    const attach0 = await emitAck<{ view: GameState }>(participants[0]!.socket, 'room:attach', { roomId, token: participants[0]!.token });
    let view = attach0.view;
    const candidates = view.round.candidatesRevealed;
    const amounts = [6, 4, 3, 2];
    for (let i = 0; i < 4; i += 1) {
      const p = byPlayerId(participants, `player-${i}` as PlayerId);
      view = await act(roomId, p, { type: 'placeBid', actor: p.playerId, allocations: { [candidates[i]!]: amounts[i]! } });
    }
    for (let i = 0; i < 4; i += 1) {
      const p = byPlayerId(participants, `player-${i}` as PlayerId);
      view = await act(roomId, p, { type: 'confirmAuctionBids', actor: p.playerId });
    }
    for (const candidateId of [...view.round.candidatesRunning]) {
      if (view.phase !== 'promiseSelection') break;
      const camp = view.round.camps[candidateId]!;
      if (!camp.majorBacker) continue;
      const backer = byPlayerId(participants, camp.majorBacker);
      view = await act(roomId, backer, { type: 'selectPromise', actor: camp.majorBacker, candidateId, promiseId: camp.promiseOptions[0]! });
    }
    expect(view.phase).toBe('campaignActions');

    const proposer = byPlayerId(participants, 'player-0' as PlayerId);
    const counterparty = byPlayerId(participants, 'player-1' as PlayerId);
    const outsider = byPlayerId(participants, 'player-2' as PlayerId);
    const promisedCandidate = view.round.candidatesRunning[0]!;

    view = await act(roomId, proposer, {
      type: 'proposeSecretPact',
      actor: 'player-0' as PlayerId,
      counterparty: 'player-1' as PlayerId,
      promise: { kind: 'supportCandidate', candidateId: promisedCandidate },
    });

    // 당사자(제안자) 시점 — 대기 목록에 보인다
    expect(view.round.pendingSecretPactProposals).toHaveLength(1);
    expect(view.actionLog.some((e) => e.action === 'proposeSecretPact')).toBe(true);

    // 상대(수신자) 시점 — 마찬가지로 보인다
    const counterpartyAttach = await emitAck<{ view: GameState }>(counterparty.socket, 'room:attach', { roomId, token: counterparty.token });
    expect(counterpartyAttach.view!.round.pendingSecretPactProposals).toHaveLength(1);

    // 제3자(당사자 아닌 참가자) 시점 — 데이터도, 로그도 없다
    const outsiderAttach = await emitAck<{ view: GameState }>(outsider.socket, 'room:attach', { roomId, token: outsider.token });
    expect(outsiderAttach.view!.round.pendingSecretPactProposals).toHaveLength(0);
    expect(outsiderAttach.view!.actionLog.some((e) => e.action === 'proposeSecretPact')).toBe(false);

    // 호스트(table) 시점 — 마찬가지로 전부 제거된다
    const hostAttach = await emitAck<{ view: GameState }>(host, 'room:attach', { roomId, token: hostToken });
    expect(hostAttach.view!.round.pendingSecretPactProposals).toHaveLength(0);
    expect(hostAttach.view!.actionLog.some((e) => e.action === 'proposeSecretPact')).toBe(false);

    // 관전자(토큰 없음) 시점 — 마찬가지로 전부 제거된다
    const spectator = await connect();
    const spectatorAttach = await emitAck<{ view: GameState }>(spectator, 'room:attach', { roomId });
    expect(spectatorAttach.view!.round.pendingSecretPactProposals).toHaveLength(0);

    // 수락 이후: activeSecretPacts도 동일하게 당사자 외에는 보이지 않는다
    view = await act(roomId, counterparty, { type: 'acceptSecretPact', actor: 'player-1' as PlayerId, proposer: 'player-0' as PlayerId });
    expect(view.round.activeSecretPacts).toHaveLength(1);
    const outsiderAfterAccept = await emitAck<{ view: GameState }>(outsider.socket, 'room:attach', { roomId, token: outsider.token });
    expect(outsiderAfterAccept.view!.round.activeSecretPacts).toHaveLength(0);
    expect(outsiderAfterAccept.view!.actionLog.some((e) => e.action === 'acceptSecretPact')).toBe(false);
  });
});
