import type { ResourceOperationRejectionCode } from '../filesystem/domain/operation-capabilities'

export type DropRejectionReason =
  | ResourceOperationRejectionCode
  | 'mixed_actions'
  | 'missing_data'
  | 'unexpected_action'
  | 'self_pin'
  | 'self_link'
  | 'self_embed'
  | 'already_pinned'
  | 'name_conflict'
  | 'wrong_workspace'
  | 'unsupported_target'
  | 'external_file_drops_disabled'

const REJECTION_REASON_MESSAGES = {
  already_pinned: 'Already pinned to this map',
  already_trashed: 'Restore the item before dropping it here',
  circular: 'Cannot move folder into itself',
  dm_only: 'Only the DM can do this',
  external_file_drops_disabled: 'File drops are disabled',
  invalid_target: 'Missing data',
  missing_ancestor_ids: 'Cannot move folder into itself',
  missing_data: 'Missing data',
  mixed_actions: 'Cannot move trashed and non-trashed items together',
  name_conflict: 'An item with this name already exists here',
  no_source_permission: 'No permission to move here',
  no_target_permission: 'No permission to move here',
  not_folder: 'Cannot drop here',
  not_found: 'Missing data',
  not_trashed: 'Item must be trashed for this operation',
  self_embed: 'Cannot embed item into itself',
  self_link: 'Cannot link note to itself',
  self_pin: 'Cannot pin map to itself',
  trashed_folder: 'Trashed folders are uneditable',
  trashed_item: 'Restore the item before dropping it here',
  unexpected_action: 'Cannot perform that action here',
  unsupported_target: 'Cannot drop here',
  wrong_workspace: 'Item belongs to another workspace',
} satisfies Record<DropRejectionReason, string>

export function rejectionReasonMessage(reason: DropRejectionReason): string {
  return REJECTION_REASON_MESSAGES[reason]
}
