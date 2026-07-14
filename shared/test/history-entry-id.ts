import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { HistoryEntryId } from '@wizard-archive/editor/resources/domain-id'

export function testHistoryEntryId(label: string): HistoryEntryId {
  return deterministicUuidV7(label) as HistoryEntryId
}
