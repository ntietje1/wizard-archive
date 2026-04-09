import type { UserProfile } from 'convex/users/types'
import { testId } from '~/test/helpers/test-id'

let userCounter = 0

export function createUser(overrides?: Partial<UserProfile>): UserProfile {
  userCounter++
  return {
    _id: testId(`user_${userCounter}`),
    _creationTime: 1700000000000,
    authUserId: `auth_${userCounter}`,
    username: `testuser${userCounter}`,
    email: `testuser${userCounter}@example.com`,
    emailVerified: true,
    name: `Test User ${userCounter}`,
    imageUrl: null,
    twoFactorEnabled: false,
    ...overrides,
  }
}
