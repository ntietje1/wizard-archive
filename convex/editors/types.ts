import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'
import type {
  SortDirection,
  SortOrder,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type { WorkspaceMode } from '../../shared/workspace/workspace-mode'

export type Editor = ConvexValidatorFields<'editor'> & {
  campaignId: Id<'campaigns'>
  userId: Id<'userProfiles'>
  sortOrder: SortOrder
  sortDirection: SortDirection
  editorMode: WorkspaceMode
}
