import { normalizeResourceNameForComparison } from '@wizard-archive/editor/resources/resource-contract'

type StoredResourceSnapshot = {
  name: string
  normalizedName?: string
}

type StoredResourceChange = {
  type: string
  before?: unknown
  after?: unknown
}

export function getFileSystemSnapshotNormalizedNameMigrationPatch(row: {
  changes: Array<StoredResourceChange>
}): { changes: Array<StoredResourceChange> } | undefined {
  let changed = false
  const changes = row.changes.map((change) => {
    switch (change.type) {
      case 'insertResource': {
        const after = normalizeSnapshot(change.after)
        if (!after) return change
        changed = true
        return { ...change, after }
      }
      case 'updateResource': {
        const before = normalizeSnapshot(change.before)
        const after = normalizeSnapshot(change.after)
        if (!before && !after) return change
        changed = true
        return {
          ...change,
          before: before ?? change.before,
          after: after ?? change.after,
        }
      }
      case 'removeResource': {
        const before = normalizeSnapshot(change.before)
        if (!before) return change
        changed = true
        return { ...change, before }
      }
      default:
        return change
    }
  })
  return changed ? { changes } : undefined
}

function normalizeSnapshot(value: unknown): StoredResourceSnapshot | null {
  if (!value || typeof value !== 'object' || !('name' in value) || typeof value.name !== 'string') {
    return null
  }
  const snapshot = value as StoredResourceSnapshot
  const normalizedName = normalizeResourceNameForComparison(snapshot.name)
  return snapshot.normalizedName === normalizedName ? null : { ...snapshot, normalizedName }
}
