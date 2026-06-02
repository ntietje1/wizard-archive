export const SNAPSHOT_TYPE = {
  yjs_state: 'yjs_state',
  game_map: 'game_map',
} as const

export type SnapshotType = (typeof SNAPSHOT_TYPE)[keyof typeof SNAPSHOT_TYPE]
