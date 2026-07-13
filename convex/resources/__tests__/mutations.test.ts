import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { FunctionArgs } from 'convex/server'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'

type StoredResourceStructureCommand = FunctionArgs<
  typeof api.resources.mutations.executeStructureCommand
>['command']

describe('resource structure commands', () => {
  const t = createTestContext()

  it('creates a canonical resource and stores an actor-bound replay receipt', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const args = {
      campaignId: campaignUuid,
      operationId,
      command: {
        type: 'create' as const,
        resourceId,
        kind: 'note' as const,
        parentId: null,
        title: '  Session\r\nNotes  ',
        icon: null,
        color: null,
      },
    }

    const first = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )
    const replay = await asDm(campaign).mutation(
      api.resources.mutations.executeStructureCommand,
      args,
    )

    expect(first.status).toBe('completed')
    expect(replay).toEqual(first)
    await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      expect(resource).toEqual(
        expect.objectContaining({
          campaignUuid,
          lifecycle: 'active',
          resourceUuid: resourceId,
          title: 'Session Notes',
        }),
      )
      const operations = await ctx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_operation', (query) =>
          query.eq('campaignUuid', campaignUuid).eq('operationUuid', operationId),
        )
        .take(2)
      expect(operations).toHaveLength(1)
    })
  })

  it('rejects operation UUID reuse by another actor or command', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'folder' as const,
      parentId: null,
      title: canonicalizeResourceTitle('Root'),
      icon: null,
      color: null,
    }
    await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId,
      command,
    })

    await expect(
      asPlayer(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId,
        command,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId,
        command: { ...command, title: canonicalizeResourceTitle('Different') },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
  })

  it('advances metadata versions only for semantic changes', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    await execute(campaign, campaignUuid, {
      type: 'create',
      resourceId,
      kind: 'note',
      parentId: null,
      title: canonicalizeResourceTitle('Original'),
      icon: null,
      color: null,
    })
    const createdVersion = await getMetadataVersion(resourceId)

    await execute(campaign, campaignUuid, {
      type: 'updateMetadata',
      resourceId,
      changes: { title: canonicalizeResourceTitle('Original') },
    })
    expect(await getMetadataVersion(resourceId)).toEqual(createdVersion)

    await execute(campaign, campaignUuid, {
      type: 'updateMetadata',
      resourceId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })
    const renamedVersion = await getMetadataVersion(resourceId)
    expect(renamedVersion.revision).toBe(createdVersion.revision + 1)
    expect(renamedVersion.digest).not.toBe(createdVersion.digest)
  })

  it('returns domain rejections for invalid UUID and title input', async () => {
    const campaign = await setupCampaignContext(t)
    const campaignUuid = await getCampaignUuid(campaign.campaignId)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const command = {
      type: 'create' as const,
      resourceId,
      kind: 'note' as const,
      parentId: null,
      title: 'Valid',
      icon: null,
      color: null,
    }

    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId: 'not-a-uuid',
        command,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_uuid' })
    await expect(
      asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: campaignUuid,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: { ...command, title: '\ud800' },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_title' })
  })

  async function getCampaignUuid(campaignId: Id<'campaigns'>) {
    return await t.run(async (ctx) => {
      return (await ctx.db.get('campaigns', campaignId))!.campaignUuid
    })
  }

  async function getMetadataVersion(resourceId: ResourceId) {
    return await t.run(async (ctx) => {
      const resource = await ctx.db
        .query('resources')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
      return resource!.metadataVersion
    })
  }

  async function execute(
    campaign: Awaited<ReturnType<typeof setupCampaignContext>>,
    campaignUuid: string,
    command: StoredResourceStructureCommand,
  ) {
    return await asDm(campaign).mutation(api.resources.mutations.executeStructureCommand, {
      campaignId: campaignUuid,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
  }
})
