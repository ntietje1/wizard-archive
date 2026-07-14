import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'
import type { ResourceShareId } from '../resources/domain-id'

export function testResourceShareId(label: string): ResourceShareId {
  return deterministicUuidV7(label) as ResourceShareId
}
