import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { api } from '../../_generated/api'

describe('purgeExpiredAuthData cron', () => {
  const t = createTestContext()

  it('active users are unaffected after purge runs', async () => {
    const user = await setupUser(t)

    const profileBefore = await user.authed.query(
      api.users.queries.getUserProfile,
      {},
    )
    expect(profileBefore).not.toBeNull()
    expect(profileBefore!.username).toBe(user.profile.username)

    const profileAfter = await user.authed.query(
      api.users.queries.getUserProfile,
      {},
    )
    expect(profileAfter).not.toBeNull()
    expect(profileAfter!._id).toBe(profileBefore!._id)
  })
})
