import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  DomainIdByKind,
  DomainIdKind,
  ImportJobId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceCatalogReader,
  SourcePathAlias,
} from '@wizard-archive/editor/resources/catalog-contract'
import type {
  AuthoritativeResourceOperationExecutor,
  CommandEnvelope,
  ResourceCommandReceipt,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'

type ResourceOperationAuthorizer = (
  actorId: CampaignMemberId,
  campaignId: CampaignId,
) => boolean | Promise<boolean>

type CatalogUnderTest = AuthoritativeResourceOperationExecutor & {
  appendAlias(alias: SourcePathAlias): Promise<SourcePathAlias>
}

export type ResourceCatalogConformanceFactory = (input: {
  authorize: ResourceOperationAuthorizer
  now: () => number
}) => ResourceCatalogConformanceRuntime | Promise<ResourceCatalogConformanceRuntime>

export type ResourceCatalogConformanceRuntime = {
  catalog: ResourceCatalogReader
  operations: CatalogUnderTest
}

const campaignId = domainId(DOMAIN_ID_KIND.campaign, 1)
const secondCampaignId = domainId(DOMAIN_ID_KIND.campaign, 2)
const actorId = domainId(DOMAIN_ID_KIND.campaignMember, 3)
const secondActorId = domainId(DOMAIN_ID_KIND.campaignMember, 4)

function domainId<TKind extends DomainIdKind>(
  kind: TKind,
  sequence: number,
): DomainIdByKind[TKind] {
  return assertDomainId(kind, `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`)
}

function createCommand(
  resourceId: ResourceId,
  parentId: ResourceId | null,
  kind: 'folder' | 'note' = 'note',
  title = 'Duplicate',
): ResourceStructureCommand {
  return {
    type: 'create',
    resourceId,
    kind,
    parentId,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
  }
}

function envelope(
  campaign: CampaignId,
  operationId: OperationId,
  command: ResourceStructureCommand,
): CommandEnvelope<ResourceStructureCommand> {
  return { campaignId: campaign, operationId, command }
}

function expectCompleted(result: ResourceStructureCommandResult): ResourceCommandReceipt {
  if (result.status !== 'completed')
    throw new TypeError(`Expected completion, got ${JSON.stringify(result)}`)
  expect(result.status).toBe('completed')
  return result.receipt
}

export function defineResourceCatalogConformance(
  name: string,
  createCatalog: ResourceCatalogConformanceFactory,
): void {
  describe(`${name} resource catalog conformance`, () => {
    it('stores duplicate-safe natural titles and returns deterministic bounded reads', async () => {
      let operation = 100
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 10 })
      const folderId = domainId(DOMAIN_ID_KIND.resource, 10)
      const firstId = domainId(DOMAIN_ID_KIND.resource, 12)
      const secondId = domainId(DOMAIN_ID_KIND.resource, 11)

      for (const command of [
        createCommand(folderId, null, 'folder', 'Folder'),
        createCommand(firstId, folderId),
        createCommand(secondId, folderId),
      ]) {
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), command),
          ),
        )
      }

      const firstPage = await catalog.listCollection(
        campaignId,
        { parentId: folderId, lifecycle: 'active' },
        1,
        null,
      )
      const secondPage = await catalog.listCollection(
        campaignId,
        { parentId: folderId, lifecycle: 'active' },
        1,
        firstPage.cursor,
      )
      expect(firstPage.items.map((resource) => resource.id)).toEqual([secondId])
      expect(secondPage.items.map((resource) => resource.id)).toEqual([firstId])
      expect(secondPage.cursor).toBeNull()
      expect(firstPage.items[0]?.title).toBe('Duplicate')
      expect(secondPage.items[0]?.title).toBe('Duplicate')
      await expect(
        catalog.listCollection(campaignId, { parentId: folderId, lifecycle: 'active' }, 201, null),
      ).rejects.toThrow('page size')
      await expect(catalog.getResources(campaignId, [firstId, secondId])).resolves.toEqual([
        expect.objectContaining({ id: firstId }),
        expect.objectContaining({ id: secondId }),
      ])
      expect(
        (await catalog.readSnapshot(campaignId)).resources.map((resource) => resource.id),
      ).toEqual([folderId, secondId, firstId])
    })

    it('enforces global identity, immutable ownership, folder parents, and acyclic hierarchy', async () => {
      let operation = 200
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 20 })
      const folderId = domainId(DOMAIN_ID_KIND.resource, 20)
      const childFolderId = domainId(DOMAIN_ID_KIND.resource, 21)
      const noteId = domainId(DOMAIN_ID_KIND.resource, 22)
      const foreignFolderId = domainId(DOMAIN_ID_KIND.resource, 23)

      for (const [campaign, command] of [
        [campaignId, createCommand(folderId, null, 'folder')],
        [campaignId, createCommand(childFolderId, folderId, 'folder')],
        [campaignId, createCommand(noteId, null)],
        [secondCampaignId, createCommand(foreignFolderId, null, 'folder')],
      ] as const) {
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(campaign, domainId(DOMAIN_ID_KIND.operation, operation++), command),
          ),
        )
      }

      await expect(
        operations.execute(
          actorId,
          envelope(
            secondCampaignId,
            domainId(DOMAIN_ID_KIND.operation, operation++),
            createCommand(folderId, null, 'folder'),
          ),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'ownership_mismatch' })
      await expect(
        operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, operation++),
            createCommand(domainId(DOMAIN_ID_KIND.resource, 24), noteId),
          ),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid_parent_kind' })
      await expect(
        operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, operation++),
            createCommand(
              domainId(DOMAIN_ID_KIND.resource, 25),
              domainId(DOMAIN_ID_KIND.resource, 26),
            ),
          ),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid_parent' })
      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'move',
            resourceIds: [folderId],
            destinationParentId: childFolderId,
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'hierarchy_cycle' })
      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'move',
            resourceIds: [noteId],
            destinationParentId: foreignFolderId,
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'ownership_mismatch' })
      expect((await catalog.getResource(campaignId, folderId))?.parentId).toBeNull()
      expect((await catalog.getResource(campaignId, noteId))?.parentId).toBeNull()
    })

    it('advances versions only for semantic metadata changes', async () => {
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 30 })
      const resourceId = domainId(DOMAIN_ID_KIND.resource, 30)
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, 300),
            createCommand(resourceId, null),
          ),
        ),
      )
      const created = (await catalog.getResource(campaignId, resourceId))!

      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, 301), {
            type: 'updateMetadata',
            resourceId,
            changes: { title: canonicalizeResourceTitle('Duplicate') },
          }),
        ),
      )
      const unchanged = (await catalog.getResource(campaignId, resourceId))!
      expect(unchanged.metadataVersion).toEqual(created.metadataVersion)
      expect(unchanged.updated).toEqual(created.updated)

      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, 302), {
            type: 'updateMetadata',
            resourceId,
            changes: { title: canonicalizeResourceTitle('Renamed') },
          }),
        ),
      )
      const renamed = (await catalog.getResource(campaignId, resourceId))!
      expect(renamed.metadataVersion.revision).toBe(created.metadataVersion.revision + 1)
      expect(renamed.metadataVersion.digest).not.toBe(created.metadataVersion.digest)
    })

    it('commits commands atomically and retains actor-bound replay receipts', async () => {
      let authorized = true
      const { catalog, operations } = await createCatalog({
        authorize: () => authorized,
        now: () => 40,
      })
      const resourceId = domainId(DOMAIN_ID_KIND.resource, 40)
      const operationId = domainId(DOMAIN_ID_KIND.operation, 400)
      const command = createCommand(resourceId, null)
      const first = await operations.execute(actorId, envelope(campaignId, operationId, command))
      const firstReceipt = expectCompleted(first)
      const replay = await operations.execute(actorId, envelope(campaignId, operationId, command))
      expect(expectCompleted(replay)).toEqual(firstReceipt)

      await expect(
        operations.execute(secondActorId, envelope(campaignId, operationId, command)),
      ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })
      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, operationId, {
            type: 'updateMetadata',
            resourceId,
            changes: { title: canonicalizeResourceTitle('Changed') },
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'operation_id_reused' })

      authorized = false
      await expect(
        operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, 401),
            createCommand(domainId(DOMAIN_ID_KIND.resource, 41), null),
          ),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'unauthorized' })
      expect((await catalog.readSnapshot(campaignId)).resources).toHaveLength(1)
    })

    it('aborts an entire multi-resource mutation when any selected resource is invalid', async () => {
      let operation = 500
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 50 })
      const destinationId = domainId(DOMAIN_ID_KIND.resource, 50)
      const movableId = domainId(DOMAIN_ID_KIND.resource, 51)
      const trashedId = domainId(DOMAIN_ID_KIND.resource, 52)
      for (const command of [
        createCommand(destinationId, null, 'folder'),
        createCommand(movableId, null),
        createCommand(trashedId, null),
      ]) {
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), command),
          ),
        )
      }
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'trash',
            resourceIds: [trashedId],
          }),
        ),
      )

      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'move',
            resourceIds: [movableId, trashedId],
            destinationParentId: destinationId,
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid_lifecycle' })
      expect((await catalog.getResource(campaignId, movableId))?.parentId).toBeNull()
    })

    it('recursively trashes, restores with root fallback, and permanently deletes trash roots', async () => {
      let operation = 600
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 60 })
      const folderId = domainId(DOMAIN_ID_KIND.resource, 60)
      const childId = domainId(DOMAIN_ID_KIND.resource, 61)
      for (const command of [
        createCommand(folderId, null, 'folder'),
        createCommand(childId, folderId),
      ]) {
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), command),
          ),
        )
      }
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'trash',
            resourceIds: [folderId],
          }),
        ),
      )
      expect((await catalog.getResource(campaignId, childId))?.lifecycle.state).toBe('trashed')

      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'permanentlyDelete',
            resourceIds: [childId],
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid_root_selection' })
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'restore',
            resourceIds: [childId],
            destination: 'previousParent',
          }),
        ),
      )
      expect(await catalog.getResource(campaignId, childId)).toEqual(
        expect.objectContaining({ parentId: null, lifecycle: { state: 'active' } }),
      )
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'permanentlyDelete',
            resourceIds: [folderId],
          }),
        ),
      )
      expect(await catalog.getResource(campaignId, folderId)).toBeNull()
      const tombstone = await catalog.getTombstone(campaignId, folderId)
      expect(tombstone?.deletionVersion.revision).toBe(3)
      expect(await catalog.getResource(campaignId, childId)).not.toBeNull()
      await expect(
        operations.execute(
          actorId,
          envelope(
            secondCampaignId,
            domainId(DOMAIN_ID_KIND.operation, operation++),
            createCommand(folderId, null, 'folder'),
          ),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'ownership_mismatch' })
    })

    it('projects a trashed child as a trash root and restores its active parent', async () => {
      let operation = 640
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 64 })
      const folderId = domainId(DOMAIN_ID_KIND.resource, 64)
      const childId = domainId(DOMAIN_ID_KIND.resource, 640)
      for (const command of [
        createCommand(folderId, null, 'folder'),
        createCommand(childId, folderId),
      ]) {
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), command),
          ),
        )
      }
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'trash',
            resourceIds: [childId],
          }),
        ),
      )

      await expect(
        catalog.listCollection(campaignId, { parentId: null, lifecycle: 'trashed' }, 10, null),
      ).resolves.toEqual({ items: [expect.objectContaining({ id: childId })], cursor: null })
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, operation++), {
            type: 'restore',
            resourceIds: [childId],
            destination: 'previousParent',
          }),
        ),
      )
      expect(await catalog.getResource(campaignId, childId)).toEqual(
        expect.objectContaining({ parentId: folderId, lifecycle: { state: 'active' } }),
      )
    })

    it('trashes an ancestor without detaching or rejecting an already trashed descendant', async () => {
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 65 })
      const folderId = domainId(DOMAIN_ID_KIND.resource, 65)
      const childId = domainId(DOMAIN_ID_KIND.resource, 66)
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, 650),
            createCommand(folderId, null, 'folder'),
          ),
        ),
      )
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, 651),
            createCommand(childId, folderId),
          ),
        ),
      )
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, 652), {
            type: 'trash',
            resourceIds: [childId],
          }),
        ),
      )

      expectCompleted(
        await operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, 653), {
            type: 'trash',
            resourceIds: [folderId],
          }),
        ),
      )
      expect(await catalog.getResource(campaignId, childId)).toEqual(
        expect.objectContaining({
          parentId: folderId,
          lifecycle: expect.objectContaining({ state: 'trashed' }),
        }),
      )
    })

    it('deduplicates equivalent import entries', async () => {
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 70 })
      const resourceId = domainId(DOMAIN_ID_KIND.resource, 70)
      expectCompleted(
        await operations.execute(
          actorId,
          envelope(
            campaignId,
            domainId(DOMAIN_ID_KIND.operation, 700),
            createCommand(resourceId, null, 'folder'),
          ),
        ),
      )
      const first = alias(resourceId, domainId(DOMAIN_ID_KIND.importJob, 701), 'Notes/Entry.md')
      const repeated = alias(resourceId, domainId(DOMAIN_ID_KIND.importJob, 702), 'notes/entry.md')
      expect(await operations.appendAlias(first)).toEqual(first)
      expect(await operations.appendAlias(first)).toEqual(first)
      expect(await operations.appendAlias(repeated)).toEqual(repeated)
      expect(await catalog.listAliases(campaignId, resourceId)).toEqual([first, repeated])
    })

    it('rejects closures above the synchronous operation limit without partial lifecycle changes', async () => {
      let operation = 800
      const { catalog, operations } = await createCatalog({ authorize: () => true, now: () => 80 })
      let parentId: ResourceId | null = null
      const rootId = domainId(DOMAIN_ID_KIND.resource, 800)
      for (let index = 0; index <= 500; index += 1) {
        const resourceId = domainId(DOMAIN_ID_KIND.resource, 800 + index)
        expectCompleted(
          await operations.execute(
            actorId,
            envelope(
              campaignId,
              domainId(DOMAIN_ID_KIND.operation, 2_000 + operation++),
              createCommand(resourceId, parentId, 'folder'),
            ),
          ),
        )
        parentId = resourceId
      }

      await expect(
        operations.execute(
          actorId,
          envelope(campaignId, domainId(DOMAIN_ID_KIND.operation, 9_999), {
            type: 'trash',
            resourceIds: [rootId],
          }),
        ),
      ).resolves.toEqual({ status: 'rejected', reason: 'closure_too_large' })
      expect((await catalog.getResource(campaignId, rootId))?.lifecycle.state).toBe('active')
      expect((await catalog.getResource(campaignId, parentId!))?.lifecycle.state).toBe('active')
    }, 15_000)
  })
}

function alias(resourceId: ResourceId, importJobId: ImportJobId, rawPath: string): SourcePathAlias {
  return {
    campaignId,
    resourceId,
    importJobId,
    sourceRootId: 'upload',
    rawPath,
    normalizedPath: rawPath,
  }
}
