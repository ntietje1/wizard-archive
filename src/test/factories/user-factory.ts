import type { UserProfile } from 'shared/users/types'
import { assertUsername } from 'shared/users/validation'
import { testId } from '~/test/helpers/test-id'

let userCounter = 0

type CreateUserOverrides = Omit<Partial<UserProfile>, 'username'> & {
  username?: string
}

export function createUser(overrides?: CreateUserOverrides): UserProfile {
  userCounter++
  const { username, ...rest } = overrides ?? {}
  return {
    id: testId(`user_${userCounter}`),
    createdAt: 1700000000000,
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
