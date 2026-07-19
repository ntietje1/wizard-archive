import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type {
  HistoryEntryId,
  NoteBlockId,
  SnapshotId,
} from '@wizard-archive/editor/resources/domain-id'

export const assetIdValidator = v.string()
export const historyEntryIdValidator = v.string() as Validator<HistoryEntryId>
export const importJobIdValidator = v.string()
export const mapPinIdValidator = v.string()
export const noteBlockIdValidator = v.string() as Validator<NoteBlockId>
export const operationIdValidator = v.string()
export const resourceIdValidator = v.string()
export const snapshotIdValidator = v.string() as Validator<SnapshotId>
