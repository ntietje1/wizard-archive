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
      theme: 'dark',
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).not.toBeNull()
    expect(result!.theme).toBe('dark')
    expect(result!.panelPreferences).toBeNull()
  })

  it('returns expected shape with all fields', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'system',
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('_creationTime')
    expect(result).toHaveProperty('userId')
    expect(result!.theme).toBe('system')
    expect(result!.panelPreferences).toBeNull()
  })
})

describe('setUserPreferences', () => {
  const t = createTestContext()

  it('creates preferences when none exist', async () => {
    const { authed } = await setupUser(t)

    const id = await authed.mutation(
      api.userPreferences.mutations.setUserPreferences,
      { theme: 'light' },
    )
    expect(id).toBeDefined()

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.theme).toBe('light')
    expect(result!.panelPreferences).toBeNull()
  })

  it('updates existing preferences', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'light',
    })

    await authed.mutation(api.userPreferences.mutations.setUserPreferences, {
      theme: 'dark',
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
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

describe('setPanelPreference', () => {
  const t = createTestContext()

  it('creates preferences with panel data when none exist', async () => {
    const { authed } = await setupUser(t)

    const id = await authed.mutation(
      api.userPreferences.mutations.setPanelPreference,
      { panelId: 'left-sidebar', size: 300, visible: true },
    )
    expect(id).toBeDefined()

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.panelPreferences).toEqual({
      'left-sidebar': { size: 300, visible: true },
    })
  })

  it('merges into existing panelPreferences without clobbering other panels', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setPanelPreference, {
      panelId: 'left-sidebar',
      size: 280,
      visible: true,
    })

    await authed.mutation(api.userPreferences.mutations.setPanelPreference, {
      panelId: 'editor-history',
      size: 350,
      visible: false,
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.panelPreferences).toEqual({
      'left-sidebar': { size: 280, visible: true },
      'editor-history': { size: 350, visible: false },
    })
  })

  it('partial update preserves other fields on the same panel', async () => {
    const { authed } = await setupUser(t)

    await authed.mutation(api.userPreferences.mutations.setPanelPreference, {
      panelId: 'left-sidebar',
      size: 280,
      visible: true,
    })

    await authed.mutation(api.userPreferences.mutations.setPanelPreference, {
      panelId: 'left-sidebar',
      size: 200,
    })

    const result = await authed.query(
      api.userPreferences.queries.getUserPreferences,
      {},
    )
    expect(result!.panelPreferences!['left-sidebar']).toEqual({
      size: 200,
      visible: true,
    })
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.userPreferences.mutations.setPanelPreference, {
        panelId: 'left-sidebar',
        size: 300,
      }),
    )
  })
})
