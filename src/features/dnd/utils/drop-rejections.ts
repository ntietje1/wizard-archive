import { assertNever } from '~/shared/utils/utils'
import type { FileSystemGlobalDropRejectionReason } from '~/features/filesystem/filesystem-drop-planner'

export type DropRejectionReason =
  | FileSystemGlobalDropRejectionReason
  | 'unexpected_action'
  | 'self_pin'
  | 'self_link'
  | 'self_embed'
  | 'already_pinned'
  | 'name_conflict'
  | 'wrong_campaign'

export function rejectionReasonMessage(reason: DropRejectionReason): string {
  switch (reason) {
    case 'no_permission':
      return 'No permission to move here'
    case 'circular':
      return 'Cannot move folder into itself'
    case 'self_pin':
      return 'Cannot pin map to itself'
    case 'self_link':
      return 'Cannot link note to itself'
    case 'self_embed':
      return 'Cannot embed item into itself'
    case 'already_pinned':
      return 'Already pinned to this map'
    case 'not_folder':
      return 'Cannot drop here'
    case 'missing_data':
      return 'Missing data'
    case 'trashed_folder':
      return 'Trashed folders are uneditable'
    case 'name_conflict':
      return 'An item with this name already exists here'
    case 'dm_only':
      return 'Only the DM can do this'
    case 'trashed_item':
      return 'Restore the item before dropping it here'
    case 'wrong_campaign':
      return 'Item belongs to another campaign'
    case 'wrong_trash_state':
      return 'Item must be trashed for this operation'
    case 'mixed_actions':
      return 'Cannot move trashed and non-trashed items together'
    case 'unexpected_action':
      return 'Cannot perform that action here'
    default:
      return assertNever(reason)
  }
}
