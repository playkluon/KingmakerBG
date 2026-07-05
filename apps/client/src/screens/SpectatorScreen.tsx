// 기반 스킬: skills/client-lobby-table/SKILL.md
// /room/:id/watch — TableScreen 재사용, 진행 버튼 없음
import { TableScreen } from './TableScreen';

interface SpectatorScreenProps {
  roomId: string;
}

export function SpectatorScreen({ roomId }: SpectatorScreenProps) {
  return <TableScreen roomId={roomId} forceReadOnly />;
}
