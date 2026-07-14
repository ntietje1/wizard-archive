import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testResourceId(label: string): ResourceId {
  return deterministicUuidV7(label) as ResourceId
}
