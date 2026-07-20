import { describe, expect, it } from 'vite-plus/test'
import { api } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'

describe('workspace preferences', () => {
  const t = createTestContext()

  it('persists last-write-wins field patches independently for each campaign member', async () => {
    const context = await setupCampaignContext(t)

    await expect(
      asDm(context).query(api.workspacePreferences.queries.get, {
        campaignId: context.campaignDomainId,
      }),
    ).resolves.toEqual({
      mode: 'editor',
      sort: { by: 'title', direction: 'ascending' },
      panels: { leftVisible: true, rightVisible: false },
    })

    await asDm(context).mutation(api.workspacePreferences.mutations.patch, {
      campaignId: context.campaignDomainId,
      patch: {
        field: 'sort',
        value: { by: 'updated', direction: 'descending' },
      },
    })
    await asDm(context).mutation(api.workspacePreferences.mutations.patch, {
      campaignId: context.campaignDomainId,
      patch: { field: 'rightPanelVisible', value: true },
    })

    await expect(
      asDm(context).query(api.workspacePreferences.queries.get, {
        campaignId: context.campaignDomainId,
      }),
    ).resolves.toEqual({
      mode: 'editor',
      sort: { by: 'updated', direction: 'descending' },
      panels: { leftVisible: true, rightVisible: true },
    })
    await expect(
      asPlayer(context).query(api.workspacePreferences.queries.get, {
        campaignId: context.campaignDomainId,
      }),
    ).resolves.toEqual({
      mode: 'editor',
      sort: { by: 'title', direction: 'ascending' },
      panels: { leftVisible: true, rightVisible: false },
    })
  })

  it('uses server execution order as last-write-wins without revisions', async () => {
    const context = await setupCampaignContext(t)

    await asDm(context).mutation(api.workspacePreferences.mutations.patch, {
      campaignId: context.campaignDomainId,
      patch: { field: 'mode', value: 'viewer' },
    })
    await asDm(context).mutation(api.workspacePreferences.mutations.patch, {
      campaignId: context.campaignDomainId,
      patch: { field: 'mode', value: 'editor' },
    })

    await expect(
      asDm(context).query(api.workspacePreferences.queries.get, {
        campaignId: context.campaignDomainId,
      }),
    ).resolves.toMatchObject({ mode: 'editor' })
  })
})
