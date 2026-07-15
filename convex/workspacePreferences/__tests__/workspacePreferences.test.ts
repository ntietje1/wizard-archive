import { describe, expect, it } from 'vite-plus/test'
import { api } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'

describe('workspace preferences', () => {
  const t = createTestContext()

  it('persists finite workspace state independently for each campaign member', async () => {
    const context = await setupCampaignContext(t)

    expect(
      await asDm(context).query(api.workspacePreferences.queries.get, {
        campaignId: context.campaignDomainId,
      }),
    ).toEqual({
      revision: 0,
      value: {
        mode: 'editor',
        sort: { by: 'title', direction: 'ascending' },
        panels: {
          left: { size: 288, visible: true },
          right: { size: 280, visible: false },
        },
      },
    })

    await asDm(context).mutation(api.workspacePreferences.mutations.change, {
      campaignId: context.campaignDomainId,
      change: { type: 'sort', sort: { by: 'updated', direction: 'descending' } },
    })
    await asDm(context).mutation(api.workspacePreferences.mutations.change, {
      campaignId: context.campaignDomainId,
      change: { type: 'panel', panel: 'right', visible: true, size: 340 },
    })

    const dmPreferences = await asDm(context).query(api.workspacePreferences.queries.get, {
      campaignId: context.campaignDomainId,
    })
    expect(dmPreferences).toMatchObject({
      revision: 2,
      value: {
        sort: { by: 'updated', direction: 'descending' },
        panels: { right: { visible: true, size: 340 } },
      },
    })

    const playerPreferences = await asPlayer(context).query(api.workspacePreferences.queries.get, {
      campaignId: context.campaignDomainId,
    })
    expect(playerPreferences.revision).toBe(0)
    expect(playerPreferences.value.sort).toEqual({ by: 'title', direction: 'ascending' })
  })

  it('bounds persisted panel sizes', async () => {
    const context = await setupCampaignContext(t)

    const small = await asDm(context).mutation(api.workspacePreferences.mutations.change, {
      campaignId: context.campaignDomainId,
      change: { type: 'panel', panel: 'left', size: 1 },
    })
    const large = await asDm(context).mutation(api.workspacePreferences.mutations.change, {
      campaignId: context.campaignDomainId,
      change: { type: 'panel', panel: 'right', size: 1000 },
    })

    expect(small.value.panels.left.size).toBe(200)
    expect(large.value.panels.right.size).toBe(600)
  })
})
