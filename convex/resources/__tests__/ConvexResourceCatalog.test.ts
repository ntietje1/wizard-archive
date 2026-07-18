import { describe, expect, it } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceCatalogReader } from '@wizard-archive/editor/resources/catalog-contract'
import type {
  CommandEnvelope,
  ResourceStructureCommand,
} from '@wizard-archive/editor/resources/command-contract'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { DEFAULT_RESOURCE_ACCESS_DEFAULTS } from '@wizard-archive/editor/resources/access-policy'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
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
  assignResourceAssetsFolder,
  appendResourceSourcePathAlias,
} from '../functions/resourceCatalogMetadata'

const createConvexCatalog: ResourceCatalogConformanceFactory = ({ authorize }) => {
  const test = createTestContext()
  const catalog: ResourceCatalogReader = {
    getResource: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getResource(...args)),
    getResources: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getResources(...args)),
    listCollection: async (...args) =>
      await test.run(
        async (ctx) => await new ConvexResourceCatalog(ctx.db).listCollection(...args),
      ),
    getTombstone: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).getTombstone(...args)),
    listAliases: async (...args) =>
      await test.run(async (ctx) => await new ConvexResourceCatalog(ctx.db).listAliases(...args)),
    getAssetsFolder: async (...args) =>
      await test.run(
        async (ctx) => await new ConvexResourceCatalog(ctx.db).getAssetsFolder(...args),
      ),
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
        const authorized = await authorize(actorId, envelope.campaignId)
        return await test.run(
          async (ctx) =>
            await executeStructureCommand(
              {
                ...ctx,
                campaign: { resourceAccessDefaults: DEFAULT_RESOURCE_ACCESS_DEFAULTS },
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
      assignAssetsFolder: async (
        campaignId: Parameters<typeof assignResourceAssetsFolder>[1],
        resourceId: Parameters<typeof assignResourceAssetsFolder>[2],
      ) =>
        await test.run(
          async (ctx) => await assignResourceAssetsFolder(ctx, campaignId, resourceId),
        ),
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
      const firstPage = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'active' },
        1,
        null,
      )
      const secondPage = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'active' },
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

  it('pages sparse kind-filtered scans without duplicates, overflow, or cursor gaps', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const actorId = await getMemberUuid(campaign.dm.memberId)
    const resourceIds = Array.from({ length: 9 }, () =>
      generateDomainId(DOMAIN_ID_KIND.resource),
    ).sort() as Array<ResourceId>
    const folderIds = [resourceIds[0]!, resourceIds[4]!, resourceIds[8]!]

    await t.run(async (ctx) => {
      for (const [index, resourceId] of resourceIds.entries()) {
        await insertResourceRow(ctx, {
          actorId,
          campaignId: campaignUuid,
          resourceId,
          kind: folderIds.includes(resourceId) ? 'folder' : 'note',
          lifecycle: 'active',
          parentId: null,
          index,
        })
      }
    })

    const pages = await t.run(async (ctx) => {
      const catalog = new ConvexResourceCatalog(ctx.db)
      const first = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'active', kinds: ['folder'] },
        2,
        null,
      )
      const second = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'active', kinds: ['folder'] },
        2,
        first.cursor,
      )
      return { first, second }
    })

    expect(pages.first.items.map((resource) => resource.id)).toEqual(folderIds.slice(0, 2))
    expect(pages.first.cursor).toBe(folderIds[1])
    expect(pages.second.items.map((resource) => resource.id)).toEqual(folderIds.slice(2))
    expect(pages.second.cursor).toBeNull()
    const resumed = [...pages.first.items, ...pages.second.items].map((resource) => resource.id)
    expect(new Set(resumed).size).toBe(resumed.length)
    expect(resumed).toEqual(folderIds)
    expect(pages.first.items.length).toBeLessThanOrEqual(2)
    expect(pages.second.items.length).toBeLessThanOrEqual(2)
  })

  it('pages sparse trash roots while rejecting descendants of trashed parents', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const actorId = await getMemberUuid(campaign.dm.memberId)
    const resourceIds = Array.from({ length: 8 }, () =>
      generateDomainId(DOMAIN_ID_KIND.resource),
    ).sort() as Array<ResourceId>
    const activeParentId = generateDomainId(DOMAIN_ID_KIND.resource)
    const expectedRootIds = [resourceIds[0]!, resourceIds[4]!, resourceIds[7]!]

    await t.run(async (ctx) => {
      await insertResourceRow(ctx, {
        actorId,
        campaignId: campaignUuid,
        resourceId: activeParentId,
        kind: 'folder',
        lifecycle: 'active',
        parentId: null,
        index: 0,
      })
      for (const [index, resourceId] of resourceIds.entries()) {
        await insertResourceRow(ctx, {
          actorId,
          campaignId: campaignUuid,
          resourceId,
          kind: index === 0 ? 'folder' : 'note',
          lifecycle: 'trashed',
          parentId:
            index === 0 || index === 7 ? null : index === 4 ? activeParentId : resourceIds[0]!,
          index: index + 1,
        })
      }
    })

    const pages = await t.run(async (ctx) => {
      const catalog = new ConvexResourceCatalog(ctx.db)
      const first = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'trashed' },
        2,
        null,
      )
      const second = await catalog.listCollection(
        campaignUuid,
        { parentId: null, lifecycle: 'trashed' },
        2,
        first.cursor,
      )
      return { first, second }
    })

    expect(pages.first.items.map((resource) => resource.id)).toEqual(expectedRootIds.slice(0, 2))
    expect(pages.first.cursor).toBe(expectedRootIds[1])
    expect(pages.second.items.map((resource) => resource.id)).toEqual(expectedRootIds.slice(2))
    expect(pages.second.cursor).toBeNull()
  })

  async function insertResourceRow(
    ctx: Pick<MutationCtx, 'db'>,
    input: {
      actorId: CampaignMemberId
      campaignId: CampaignId
      resourceId: ResourceId
      kind: 'folder' | 'note'
      lifecycle: 'active' | 'trashed'
      parentId: ResourceId | null
      index: number
    },
  ) {
    const title = canonicalizeResourceTitle(`Resource ${input.index}`)
    await ctx.db.insert('resources', {
      resourceUuid: input.resourceId,
      campaignUuid: input.campaignId,
      parentResourceUuid: input.parentId,
      kind: input.kind,
      title,
      icon: null,
      color: null,
      ...(input.lifecycle === 'active'
        ? { lifecycle: 'active' as const, trashedAt: null, trashedByMemberUuid: null }
        : {
            lifecycle: 'trashed' as const,
            trashedAt: input.index + 1,
            trashedByMemberUuid: input.actorId,
          }),
      metadataVersion: await initialResourceMetadataVersion({
        parentId: input.parentId,
        kind: input.kind,
        title,
        icon: null,
        color: null,
        lifecycle: input.lifecycle,
      }),
      createdAt: input.index + 1,
      createdByMemberUuid: input.actorId,
      updatedAt: input.index + 1,
      updatedByMemberUuid: input.actorId,
    })
  }

  async function getCampaignUuid(campaignId: Id<'campaigns'>) {
    const campaignUuid = await t.run(
      async (ctx) => (await ctx.db.get('campaigns', campaignId))!.campaignUuid,
    )
    return assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid)
  }

  async function getMemberUuid(memberId: Id<'campaignMembers'>) {
    const value = await t.run(
      async (ctx) => (await ctx.db.get('campaignMembers', memberId))!.campaignMemberUuid,
    )
    return assertDomainId(DOMAIN_ID_KIND.campaignMember, value)
  }
})
