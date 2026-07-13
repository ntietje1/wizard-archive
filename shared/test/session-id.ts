import { deterministicUuidV7 } from './deterministic-uuid-v7'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

export function testSessionId(label: string): SessionId {
  return deterministicUuidV7(label) as SessionId
}
