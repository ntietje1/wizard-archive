import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'
import type { MapPinId } from '../resources/domain-id'

export function testMapPinId(label: string): MapPinId {
  return deterministicUuidV7(label) as MapPinId
}
