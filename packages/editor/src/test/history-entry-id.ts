import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'
import type { HistoryEntryId } from '../resources/domain-id'

export function testHistoryEntryId(label: string): HistoryEntryId {
  return deterministicUuidV7(label) as HistoryEntryId
}
