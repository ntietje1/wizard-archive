import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('getUserPreferences', () => {
  const t = createTestContext()

  it('returns null when not authenticated', async () => {
    const result = await t.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).toBeNull()
  })

  it('returns null when no preferences set', async () => {
    const { authed } = await setupUser(t)
    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).toBeNull()
  })

  it('returns preferences after setting them', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      sidebarWidth: 300,
      isSidebarExpanded: true,
      theme: 'dark',
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).not.toBeNull()
    expect(result!.sidebarWidth).toBe(300)
    expect(result!.isSidebarExpanded).toBe(true)
    expect(result!.theme).toBe('dark')
  })

  it('returns expected shape with all fields', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      sidebarWidth: 250,
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('_creationTime')
    expect(result).toHaveProperty('userId')
    expect(result!.sidebarWidth).toBe(250)
    expect(result!.isSidebarExpanded).toBeNull()
    expect(result!.theme).toBeNull()
  })
})

describe('setUserPreferences', () => {
  const t = createTestContext()

  it('creates preferences when none exist', async () => {
    const { authed } = await setupUser(t)

    const id = await authed.mutation(
      api.userPreferences.mutations.setUserPreferences,
      { sidebarWidth: 400 },
    )
    expect(id).toBeDefined()

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.sidebarWidth).toBe(400)
    expect(result!.isSidebarExpanded).toBeNull()
    expect(result!.theme).toBeNull()
  })

  it('updates existing preferences', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      sidebarWidth: 300,
      theme: 'light',
    })

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'dark',
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.sidebarWidth).toBe(300)
    expect(result!.theme).toBe('dark')
    expect(result!.isSidebarExpanded).toBeNull()
  })

  it('partial update only changes provided fields', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      sidebarWidth: 350,
      isSidebarExpanded: true,
      theme: 'system',
    })

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      sidebarWidth: 200,
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.sidebarWidth).toBe(200)
    expect(result!.isSidebarExpanded).toBe(true)
    expect(result!.theme).toBe('system')
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.userPreferences.mutations.setUserPreferences, {
        sidebarWidth: 300,
      }),
    )
  })
})
