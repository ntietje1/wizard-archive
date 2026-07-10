import type { MaybePromise } from '../../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { ResourceCatalog } from '../../../filesystem/catalog'
import type { FileSystemItemCreateOperations } from '../../../filesystem/item-operation-contracts'
import type { FileSystemPermissions } from '../../../filesystem/permissions'

export interface CanvasContextMenuRuntime {
  filesystem: {
    catalog: Pick<ResourceCatalog, 'getKnownItemById' | 'getVisibleChildren'>
    operations: FileSystemItemCreateOperations
    permissions: Pick<FileSystemPermissions, 'canEdit'>
  }
  navigation: {
    openItem: (
      itemId: SidebarItemId,
      options?: { heading?: string; replace?: boolean; target?: 'current' | 'separate' },
    ) => MaybePromise<void>
    openExternalUrl: (url: string) => MaybePromise<void>
  }
}
