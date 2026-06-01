import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'
import type { EditorMode, SortDirection, SortOrder } from '../../shared/editor/types'

export type Editor = ConvexValidatorFields<'editor'> & {
  campaignId: Id<'campaigns'>
  userId: Id<'userProfiles'>
  sortOrder: SortOrder
  sortDirection: SortDirection
  editorMode: EditorMode
}
