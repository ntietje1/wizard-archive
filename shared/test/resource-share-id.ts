import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { ResourceShareId } from '@wizard-archive/editor/resources/domain-id'

export function testResourceShareId(label: string): ResourceShareId {
  return deterministicUuidV7(label) as ResourceShareId
}
