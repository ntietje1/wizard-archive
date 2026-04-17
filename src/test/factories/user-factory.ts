import type { UserProfile } from 'convex/users/types'
import { assertUsername } from 'convex/users/validation'
import { testId } from '~/test/helpers/test-id'

let userCounter = 0

type CreateUserOverrides = Omit<Partial<UserProfile>, 'username'> & {
  username?: string
}

export function createUser(overrides?: CreateUserOverrides): UserProfile {
  userCounter++
  const { username, ...rest } = overrides ?? {}
  return {
    _id: testId(`user_${userCounter}`),
    _creationTime: 1700000000000,
    authUserId: `auth_${userCounter}`,
    username: assertUsername(username ?? `testuser${userCounter}`),
    email: `testuser${userCounter}@example.com`,
    emailVerified: true,
    name: `Test User ${userCounter}`,
    imageUrl: null,
    twoFactorEnabled: false,
    ...rest,
  }
}
