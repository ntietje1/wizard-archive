import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'
import type { OperationId } from '../resources/domain-id'

export function testOperationId(label: string): OperationId {
  return deterministicUuidV7(label) as OperationId
}
