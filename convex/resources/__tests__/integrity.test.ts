import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { FunctionArgs } from 'convex/server'
import { internal } from '../../_generated/api'
import { createTestContext } from '../../_test/setup.helper'

describe('resource integrity diagnostics', () => {
  const t = createTestContext()

  afterEach(() => vi.useRealTimers())

  it('reports every bounded integrity category and exposes only safe retries', async () => {
    vi.useFakeTimers()
    const campaignUuid = generateDomainId(DOMAIN_ID_KIND.campaign)
    const memberUuid = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const missingContentResourceUuid = generateDomainId(DOMAIN_ID_KIND.resource)
    const orphanContentResourceUuid = generateDomainId(DOMAIN_ID_KIND.resource)
    const failedCopyResourceUuid = generateDomainId(DOMAIN_ID_KIND.resource)
    const danglingAssetUuid = generateDomainId(DOMAIN_ID_KIND.asset)
    const sourceAssetUuid = generateDomainId(DOMAIN_ID_KIND.asset)
    const destinationAssetUuid = generateDomainId(DOMAIN_ID_KIND.asset)
    const retirementAssetUuid = generateDomainId(DOMAIN_ID_KIND.asset)
    const version = {
      scheme: 'authoritative-revision-v1' as const,
      revision: 1,
      digest: 'fixture',
    }
    const createdAt = 10

    const fixture = await t.run(async (ctx) => {
      await ctx.db.insert('resources', {
        resourceUuid: missingContentResourceUuid,
        campaignUuid,
        parentResourceUuid: null,
        kind: 'note',
        title: 'Missing content',
        icon: null,
        color: null,
        lifecycle: 'active',
        trashedAt: null,
        trashedByMemberUuid: null,
        metadataVersion: version,
        createdAt,
        createdByMemberUuid: memberUuid,
        updatedAt: createdAt,
        updatedByMemberUuid: memberUuid,
      })
      const orphanContentId = await ctx.db.insert('resourceCanvasContents', {
        campaignUuid,
        resourceUuid: orphanContentResourceUuid,
        update: new ArrayBuffer(0),
        version,
      })
      const danglingOwnerId = await ctx.db.insert('resourceAssetOwners', {
        campaignUuid,
        resourceUuid: orphanContentResourceUuid,
        assetUuid: danglingAssetUuid,
      })
      const failedCopyId = await ctx.db.insert('resourceAssetCopyIntents', {
        campaignUuid,
        resourceUuid: failedCopyResourceUuid,
        operationUuid: generateDomainId(DOMAIN_ID_KIND.operation),
        sourceAssetUuid,
        destinationAssetUuid,
        status: 'failed',
        attempts: 1,
        lastAttemptAt: createdAt,
        lastError: 'byte_copy_failed',
        createdAt,
      })
      const failedRetirementId = await ctx.db.insert('resourceAssetRetirementCandidates', {
        assetUuid: retirementAssetUuid,
        status: 'processing',
        attempts: 1,
        lastAttemptAt: createdAt,
        lastError: null,
        createdAt,
      })
      return {
        orphanContentId,
        danglingOwnerId,
        failedCopyId,
        failedRetirementId,
      }
    })

    const diagnose = async (
      diagnostic: FunctionArgs<typeof internal.resources.integrity.diagnose>['diagnostic'],
    ) =>
      await t.query(internal.resources.integrity.diagnose, {
        diagnostic,
        cursor: null,
        limit: 1_000,
      })

    await expect(diagnose({ type: 'resource_without_content' })).resolves.toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            type: 'resource_without_content',
            resourceUuid: missingContentResourceUuid,
            repair: 'report_only',
          }),
        ],
      }),
    )
    await expect(diagnose({ type: 'content_without_resource', kind: 'canvas' })).resolves.toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            recordId: fixture.orphanContentId,
            repair: 'report_only',
          }),
        ],
      }),
    )
    await expect(diagnose({ type: 'dangling_domain_asset', source: 'owner' })).resolves.toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            recordId: fixture.danglingOwnerId,
            assetUuid: danglingAssetUuid,
            repair: 'report_only',
          }),
        ],
      }),
    )
    await expect(diagnose({ type: 'failed_byte_copy', staleBefore: 20 })).resolves.toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            recordId: fixture.failedCopyId,
            repair: 'retry_byte_copy',
          }),
        ],
      }),
    )
    await expect(diagnose({ type: 'failed_retirement', staleBefore: 20 })).resolves.toEqual(
      expect.objectContaining({
        issues: [
          expect.objectContaining({
            recordId: fixture.failedRetirementId,
            repair: 'retry_retirement',
          }),
        ],
      }),
    )

    await expect(
      t.mutation(internal.resources.internalMutations.retryAssetCopy, {
        intentId: fixture.failedCopyId,
        staleBefore: 20,
      }),
    ).resolves.toEqual({ status: 'completed' })
    await expect(
      t.mutation(internal.resources.internalMutations.retryAssetRetirement, {
        candidateId: fixture.failedRetirementId,
        staleBefore: 20,
      }),
    ).resolves.toEqual({ status: 'completed' })
    await t.run(async (ctx) => {
      expect(await ctx.db.get(fixture.failedCopyId)).toEqual(
        expect.objectContaining({ status: 'pending', lastError: null }),
      )
      expect(await ctx.db.get(fixture.failedRetirementId)).toEqual(
        expect.objectContaining({ status: 'pending', lastError: null }),
      )
    })
  })
})
