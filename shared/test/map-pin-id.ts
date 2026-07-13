import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { MapPinId } from '@wizard-archive/editor/resources/domain-id'

export function testMapPinId(label: string): MapPinId {
  return deterministicUuidV7(label) as MapPinId
}
