import type { SidebarOperationRejectionCode } from 'convex/sidebarItems/operations/capabilities'
import { assertNever } from '~/shared/utils/utils'

export type DropRejectionReason =
  | 'self_pin'
  | 'self_link'
  | 'self_embed'
  | 'already_pinned'
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'name_conflict'
  | 'dm_only'
  | 'trashed_item'
  | 'wrong_campaign'
  | 'wrong_trash_state'
  | 'mixed_actions'
  | 'unexpected_action'

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
      return 'Cannot embed canvas into itself'
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
      return 'The item is trashed and cannot be used'
    case 'wrong_campaign':
      return 'Item belongs to another campaign'
    case 'wrong_trash_state':
      return 'Item is not in the expected trash state'
    case 'mixed_actions':
      return 'Cannot move trashed and non-trashed items together'
    case 'unexpected_action':
      return 'Cannot perform that action here'
    default:
      return assertNever(reason)
  }
}

export function toDropRejectionReason(code: SidebarOperationRejectionCode): DropRejectionReason {
  switch (code) {
    case 'no_source_permission':
    case 'no_target_permission':
      return 'no_permission'
    case 'dm_only':
      return 'dm_only'
    case 'circular':
      return 'circular'
    case 'trashed_folder':
      return 'trashed_folder'
    case 'trashed_item':
    case 'already_trashed':
      return 'trashed_item'
    case 'not_trashed':
      return 'wrong_trash_state'
    case 'not_found':
    case 'invalid_target':
      return 'missing_data'
    case 'not_folder':
    case 'different_location':
      return 'not_folder'
    default:
      return assertNever(code)
  }
}
