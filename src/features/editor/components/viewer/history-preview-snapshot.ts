import type { GameMapSnapshotData } from 'shared/game-maps/types'
import { logger } from '~/shared/utils/logger'

export function readGameMapSnapshot(data: ArrayBuffer): GameMapSnapshotData | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(data))
    if (isGameMapSnapshotData(parsed)) return parsed

    logger.error('Invalid game map snapshot data shape')
    return null
  } catch (error) {
    logger.error('Failed to parse game map snapshot data:', error)
    return null
  }
}

function isGameMapSnapshotData(value: unknown): value is GameMapSnapshotData {
  if (!isRecord(value)) return false
  if (!(typeof value.imageStorageId === 'string' || value.imageStorageId === null)) return false
  if (!Array.isArray(value.pins)) return false

  return value.pins.every(isGameMapSnapshotPinData)
}

function isGameMapSnapshotPinData(value: unknown) {
  if (!isRecord(value)) return false

  return (
    typeof value.itemId === 'string' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.visible === 'boolean' &&
    (typeof value.name === 'string' || value.name === null) &&
    (typeof value.color === 'string' || value.color === null) &&
    (typeof value.iconName === 'string' || value.iconName === null) &&
    (typeof value.itemType === 'string' || value.itemType === null)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
