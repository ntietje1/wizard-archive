import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceKind } from '../workspace/resource-contract'
import type { FileSystemCreateItemResult } from './item-operation-contracts'

export interface CreateItemSource {
  canCreateItems: () => boolean
  createItem: (input: {
    name?: string
    parentId: SidebarItemId | null
    type: ResourceKind
  }) => MaybePromise<FileSystemCreateItemResult>
  openCreateDashboard: () => MaybePromise<unknown>
  openItem: (itemId: SidebarItemId) => MaybePromise<unknown>
}
