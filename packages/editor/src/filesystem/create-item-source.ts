import type { ResourceId } from '../resources/domain-id'
import type { MaybePromise } from '../../../../shared/common/async'

import type { ResourceKind } from '../workspace/resource-contract'
import type { FileSystemCreateItemResult } from './item-operation-contracts'

export interface CreateItemSource {
  canCreateItems: () => boolean
  createItem: (input: {
    name?: string
    parentId: ResourceId | null
    type: ResourceKind
  }) => MaybePromise<FileSystemCreateItemResult>
  openCreateDashboard: () => MaybePromise<unknown>
  openItem: (itemId: ResourceId) => MaybePromise<unknown>
}
