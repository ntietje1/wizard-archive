import { describe, expect, it } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('getUserPreferences', () => {
  const t = createTestContext()

  it('returns null when not authenticated', async () => {
    const result = await t.query(api.userPreferences.queries.getUserPreferences, {})
    expect(result).toBeNull()
  })

  it('returns null when no preferences set', async () => {
    const { authed } = await setupUser(t)
    const result = await authed.query(api.userPreferences.queries.getUserPreferences, {})
    expect(result).toBeNull()
  })

  it('returns preferences after setting them', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'dark',
    })

    const result = await authed.query(api.userPreferences.queries.getUserPreferences, {})
    expect(result).not.toBeNull()
    expect(result!.theme).toBe('dark')
  })
})

describe('setUserPreferences', () => {
  const t = createTestContext()

  it('creates preferences when none exist', async () => {
    const { authed } = await setupUser(t)

    const id = await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'light',
    })
    expect(id).toBeDefined()

    const result = await authed.query(api.userPreferences.queries.getUserPreferences, {})
    expect(result!.theme).toBe('light')
  })

  it('updates existing preferences', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'light',
    })

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'dark',
    })

    const result = await authed.query(api.userPreferences.queries.getUserPreferences, {})
    expect(result!.theme).toBe('dark')
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.userPreferences.mutations.setUserPreferences, {
        theme: 'dark',
      }),
    )
  })
})
