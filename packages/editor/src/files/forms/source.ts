import type { FileSystemItemFormOperations } from '../../filesystem/item-operation-contracts'
import type { FileSession } from '../session-contract'
import type { FileItem } from '../item-contract'
import type { ItemContentLoadState } from '../../filesystem/load-state'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'

export type FileFormEditState = ItemContentLoadState<FileItem>

export interface FileFormSource {
  createItem: FileSystemItemFormOperations['createItem']
  openItem: (itemId: SidebarItemId) => MaybePromise<void>
  replaceFile: FileSession['replaceFile']
  updateItemMetadata: FileSystemItemFormOperations['updateItemMetadata']
}
