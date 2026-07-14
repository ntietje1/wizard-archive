import type { ResourceId } from '../../resources/domain-id'
import type { FileSystemItemFormOperations } from '../../filesystem/item-operation-contracts'
import type { FileSession } from '../session-contract'
import type { FileItem } from '../item-contract'
import type { ItemContentLoadState } from '../../filesystem/load-state'
import type { MaybePromise } from '../../../../../shared/common/async'

export type FileFormEditState = ItemContentLoadState<FileItem>

export interface FileFormSource {
  createItem: FileSystemItemFormOperations['createItem']
  openItem: (itemId: ResourceId) => MaybePromise<void>
  replaceFile: FileSession['replaceFile']
  updateItemMetadata: FileSystemItemFormOperations['updateItemMetadata']
}
