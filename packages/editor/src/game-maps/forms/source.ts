import type { FileSystemItemFormOperations } from '../../filesystem/item-operation-contracts'
import type { MapItem } from '../../game-maps/item-contract'
import type { MapSession } from '../../game-maps/session-contract'
import type { ItemContentLoadState } from '../../filesystem/load-state'

export type MapFormEditState = ItemContentLoadState<MapItem>

export interface MapFormSource {
  updateItemMetadata: FileSystemItemFormOperations['updateItemMetadata']
  updateMapImage: MapSession['updateMapImage']
  validateItemName: FileSystemItemFormOperations['validateItemName']
}
