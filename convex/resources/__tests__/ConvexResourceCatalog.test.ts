import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceCatalogReader } from '@wizard-archive/editor/resources/catalog-contract'
import type {
  CommandEnvelope,
  ResourceStructureCommand,
} from '@wizard-archive/editor/resources/command-contract'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { defineResourceCatalogConformance } from '../../../shared/test/resource-catalog-conformance'
import type {
  ResourceCatalogConformanceFactory,
  ResourceCatalogConformanceRuntime,
} from '../../../shared/test/resource-catalog-conformance'
import { ConvexResourceCatalog } from '../functions/ConvexResourceCatalog'
import { executeStructureCommand } from '../functions/executeStructureCommand'
import {
  appendResourceSourcePathAlias,
  removeApplicationResourceRole,
  setApplicationResourceRole,
} from '../functions/resourceCatalogMetadata'

const createConvexCatalog: ResourceCatalogConformanceFactory = ({ authorize }) => {
  const test = createTestContext()
  const catalog: ResourceCatalogReader = {
    getResource: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getResource(...args)),
    getResources: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getResources(...args)),
    listChildren: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).listChildren(...args)),
    getTombstone: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getTombstone(...args)),
    listAliases: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).listAliases(...args)),
    listRoles: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).listRoles(...args)),
    readSnapshot: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).readSnapshot(...args)),
  }
  return {
    catalog,
    operations: {
      execute: async (
        actorId: CampaignMemberId,
        envelope: CommandEnvelope<ResourceStructureCommand>,
      ) => {
        const authorized = await authorize(actorId, envelope)
        return await test.run(
          async (ctx) =>
            await executeStructureCommand(
              {
                ...ctx,
                membership: {
                  role: authorized ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player,
                },
                resourceScope: { campaignId: envelope.campaignId, actorId },
              } as unknown as CampaignMutationCtx,
              { operationId: envelope.operationId, command: envelope.command },
            ),
        )
      },
      appendAlias: async (alias: Parameters<typeof appendResourceSourcePathAlias>[1]) =>
        await test.run(async (ctx) => await appendResourceSourcePathAlias(ctx, alias)),
      setRole: async (
        campaignId: Parameters<typeof setApplicationResourceRole>[1],
        role: Parameters<typeof setApplicationResourceRole>[2],
      ) => await test.run(async (ctx) => await setApplicationResourceRole(ctx, campaignId, role)),
      removeRole: async (
        campaignId: Parameters<typeof removeApplicationResourceRole>[1],
        role: Parameters<typeof removeApplicationResourceRole>[2],
      ) =>
        await test.run(async (ctx) => await removeApplicationResourceRole(ctx, campaignId, role)),
    },
  } as unknown as ResourceCatalogConformanceRuntime
}

defineResourceCatalogConformance('Convex', createConvexCatalog)

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
