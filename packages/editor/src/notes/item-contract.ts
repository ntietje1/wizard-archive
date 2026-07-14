import type { ShareStatus } from '../../../../shared/block-shares/share-status'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { NoteBlock } from './document/model'
import type { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { CampaignMemberId, ResourceId } from '../resources/domain-id'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
} from '../workspace/resource-contract'

export type BlockMeta = {
  myPermissionLevel: PermissionLevel
  shareStatus: ShareStatus
  sharedWith: Array<CampaignMemberId>
  hiddenFrom?: Array<CampaignMemberId>
}

export type BlockShareAccessWarning = {
  campaignMemberId: CampaignMemberId
  blockCount: number
}

export type NoteItemRow = BaseResourceRow<typeof RESOURCE_TYPES.notes>

export type NoteItem = BaseResource<typeof RESOURCE_TYPES.notes>

export type NoteItemWithContent = BaseResourceWithContent<typeof RESOURCE_TYPES.notes> & {
  id: ResourceId
  content: Array<NoteBlock>
  blockMeta: Record<string, BlockMeta>
  blockShareAccessWarnings: Array<BlockShareAccessWarning>
}
