import type { MaybePromise } from '../../../../../shared/common/async'
import type { CampaignMemberId } from '../../resources/domain-id'
import type { AnyItem } from '../../workspace/items'
import type { ItemCardSource } from '../cards/source'
import type { ResourceCommandResult } from '../transaction-contract'

export type TrashStatus = 'pending' | 'error' | 'success'

export interface TrashSource extends ItemCardSource {
  canDeleteItemForever: (item: AnyItem) => boolean
  canEmptyTrash: () => boolean
  canRestoreItem: (item: AnyItem) => boolean
  getDeletedByName: (deletedById: CampaignMemberId | null) => string | undefined
  getError: () => Error | null
  getItemCount: () => number
  getRootItems: () => ReadonlyArray<AnyItem>
  getStatus: () => TrashStatus
  isTrashActive: () => boolean
  openTrash: () => MaybePromise<unknown>
  refresh: () => Promise<unknown>
  requestDeleteItemsForever: (itemIds: Array<AnyItem['id']>) => MaybePromise<void>
  requestEmptyTrash: () => MaybePromise<void>
  restoreItems: (
    itemIds: Array<AnyItem['id']>,
    targetParentId: AnyItem['id'] | null,
  ) => MaybePromise<ResourceCommandResult>
}
