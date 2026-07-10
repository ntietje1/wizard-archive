// time AFTER update that a snapshot is made
export const SNAPSHOT_IDLE_MS = 10 * 1000
// minimum time between snapshots
export const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000
const COMPACT_INTERVAL = 20

export function shouldCompact(seq: number): boolean {
  return seq > 0 && seq % COMPACT_INTERVAL === 0
}
