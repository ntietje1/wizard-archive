import type { UserProfileId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testUserProfileId(label: string): UserProfileId {
  return deterministicUuidV7(label) as UserProfileId
}
