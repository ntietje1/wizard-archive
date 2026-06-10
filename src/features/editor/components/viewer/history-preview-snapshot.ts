import type { GameMapSnapshotData } from 'shared/game-maps/types'
import { logger } from '~/shared/utils/logger'

export function readGameMapSnapshot(data: ArrayBuffer): GameMapSnapshotData | null {
  try {
    return JSON.parse(new TextDecoder().decode(data))
  } catch (error) {
    logger.error('Failed to parse game map snapshot data:', error)
    return null
  }
}
