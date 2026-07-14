import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { OperationId } from '@wizard-archive/editor/resources/domain-id'

export function testOperationId(label: string): OperationId {
  return deterministicUuidV7(label) as OperationId
}
