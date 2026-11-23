export type MatchLogEventType =
  | 'crate_opened'
  | 'base_upgraded'
  | 'trap_triggered'
  | 'player_eliminated';

export interface MatchLogEntry {
  readonly type: MatchLogEventType;
  readonly timestamp: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly teamId?: string;
  readonly detail?: string;
}

export class MatchLog {
  private readonly _entries: MatchLogEntry[] = [];

  get entries(): readonly MatchLogEntry[] {
    return this._entries;
  }

  record(input: Omit<MatchLogEntry, 'timestamp'> & { timestamp?: number }): MatchLogEntry {
    const entry: MatchLogEntry = {
      type: input.type,
      timestamp: typeof input.timestamp === 'number' && input.timestamp > 0 ? input.timestamp : Date.now(),
      x: Number.isFinite(input.x) ? input.x : 0,
      y: Number.isFinite(input.y) ? input.y : 0,
      z: Number.isFinite(input.z) ? input.z : 0,
      actorId: input.actorId,
      targetId: input.targetId,
      teamId: input.teamId,
      detail: input.detail,
    };
    this._entries.push(entry);
    return entry;
  }

  clear(): void {
    this._entries.length = 0;
  }
}
