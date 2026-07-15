import type { UserProfile } from 'shared/users/types'
import { assertUsername } from 'shared/users/validation'
import { testDomainId } from 'shared/test/domain-id'

let userCounter = 0

type CreateUserOverrides = Omit<Partial<UserProfile>, 'username'> & {
  username?: string
}

export function createUser(overrides?: CreateUserOverrides): UserProfile {
  userCounter++
  const { username, ...rest } = overrides ?? {}
  return {
    id: testDomainId('userProfile', `user_${userCounter}`),
    createdAt: 1700000000000,
    username: assertUsername(username ?? `testuser${userCounter}`),
    email: `testuser${userCounter}@example.com`,
    emailVerified: true,
    name: `Test User ${userCounter}`,
    imageUrl: null,
    twoFactorEnabled: false,
    ...rest,
  }
}
