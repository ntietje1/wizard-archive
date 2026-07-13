import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { Id } from '../../_generated/dataModel'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { ConvexResourceCatalog } from '../functions/ConvexResourceCatalog'

describe('ConvexResourceCatalog', () => {
  const t = createTestContext()

  it('reads globally identified resources through campaign ownership and stable keyset pages', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const actorId = await getMemberUuid(campaign.dm.memberId)
    const firstId = generateDomainId(DOMAIN_ID_KIND.resource)
    const secondId = generateDomainId(DOMAIN_ID_KIND.resource)
    const resourceIds = [firstId, secondId].sort() as Array<ResourceId>

    await t.run(async (ctx) => {
      for (const [index, resourceId] of resourceIds.entries()) {
        const title = canonicalizeResourceTitle(`Resource ${index}`)
        await ctx.db.insert('resources', {
          resourceUuid: resourceId,
          campaignUuid,
          parentResourceUuid: null,
          kind: 'note',
          title,
          icon: null,
          color: null,
          lifecycle: 'active',
          trashedAt: null,
          trashedByMemberUuid: null,
          metadataVersion: await initialResourceMetadataVersion({
            parentId: null,
            kind: 'note',
            title,
            icon: null,
            color: null,
            lifecycle: 'active',
          }),
          createdAt: index + 1,
          createdByMemberUuid: actorId,
          updatedAt: index + 1,
          updatedByMemberUuid: actorId,
        })
      }
    })

    const result = await t.run(async (ctx) => {
      const catalog = new ConvexResourceCatalog(ctx.db)
      const firstPage = await catalog.listChildren(campaignUuid, null, 'active', 1, null)
      const secondPage = await catalog.listChildren(
        campaignUuid,
        null,
        'active',
        1,
        firstPage.cursor,
      )
      return {
        resource: await catalog.getResource(campaignUuid, resourceIds[0]!),
        firstPage,
        secondPage,
        snapshot: await catalog.readSnapshot(campaignUuid),
      }
    })

    expect(result.resource?.id).toBe(resourceIds[0])
    expect(result.firstPage).toEqual({
      items: [expect.objectContaining({ id: resourceIds[0] })],
      cursor: resourceIds[0],
    })
    expect(result.secondPage).toEqual({
      items: [expect.objectContaining({ id: resourceIds[1] })],
      cursor: null,
    })
    expect(result.snapshot.resources.map((resource) => resource.id)).toEqual(resourceIds)
  })

  async function getCampaignUuid(campaignId: Id<'campaigns'>) {
    const campaignUuid = await t.run(
      async (ctx) => (await ctx.db.get('campaigns', campaignId))!.campaignUuid,
    )
    return assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid)
  }

  async function getMemberUuid(memberId: Id<'campaignMembers'>) {
    return await t.run(
      async (ctx) => (await ctx.db.get('campaignMembers', memberId))!.campaignMemberUuid,
    )
  }
})
