import { describe, expect, it, vi } from 'vite-plus/test'
import {
  InMemoryResourceCatalog,
  InMemoryResourceOperationExecutor,
} from '../in-memory-resource-catalog'
import { defineResourceCatalogConformance } from './resource-catalog-conformance'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import { canonicalizeResourceTitle } from '../resource-contract'
import type { AuthoritativeResourceOperationExecutor } from '../resource-command-contract'

defineResourceCatalogConformance('in-memory', (options) => {
  const catalog = new InMemoryResourceCatalog()
  return { catalog, operations: new InMemoryResourceOperationExecutor(catalog, options) }
})

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-000000000001')
const actorId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-000000000002',
)
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-000000000003')

describe('InMemoryResourceCatalog snapshots', () => {
  it('keeps authorization, operation execution, and transaction writers off the catalog', () => {
    const catalog = new InMemoryResourceCatalog()

    expect(catalog).not.toHaveProperty('execute')
    expect(catalog).not.toHaveProperty('appendAlias')
    expect(catalog).not.toHaveProperty('setRole')
    expect(catalog).not.toHaveProperty('removeRole')
  })

  it('hydrates an authoritative snapshot and publishes committed changes', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = new InMemoryResourceOperationExecutor(source, {
      authorize: () => true,
      now: () => 10,
    })
    await sourceOperations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000004'),
      command: {
        type: 'create',
        resourceId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Seeded note'),
        icon: null,
        color: null,
      },
    })
    const catalog = new InMemoryResourceCatalog({
      initialSnapshot: source.getSnapshot(campaignId),
    })
    const operations = new InMemoryResourceOperationExecutor(catalog, {
      authorize: () => true,
      now: () => 20,
    })
    const listener = vi.fn()
    const unsubscribe = catalog.subscribe(campaignId, listener)
    const initial = catalog.getSnapshot(campaignId)

    expect(catalog.getSnapshot(campaignId)).toBe(initial)
    expect(initial.resources).toEqual([
      expect.objectContaining({ id: resourceId, title: 'Seeded note' }),
    ])

    await operations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000005'),
      command: {
        type: 'updateMetadata',
        resourceId,
        changes: { title: canonicalizeResourceTitle('Renamed note') },
      },
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(catalog.getSnapshot(campaignId)).not.toBe(initial)
    expect(catalog.getSnapshot(campaignId).resources[0]?.title).toBe('Renamed note')

    unsubscribe()
    await operations.removeRole(campaignId, 'missing-role')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('rejects invalid hydrated ownership and hierarchy', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = new InMemoryResourceOperationExecutor(source, {
      authorize: () => true,
      now: () => 10,
    })
    await sourceOperations.execute(actorId, {
      campaignId,
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, '01890f47-f6c8-7a5b-8c9d-000000000006'),
      command: {
        type: 'create',
        resourceId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Seeded note'),
        icon: null,
        color: null,
      },
    })
    const snapshot = source.getSnapshot(campaignId)

    expect(
      () =>
        new InMemoryResourceCatalog({
          initialSnapshot: {
            ...snapshot,
            resources: [{ ...snapshot.resources[0]!, parentId: resourceId }],
          },
        }),
    ).toThrow('hierarchy')
    expect(
      () =>
        new InMemoryResourceCatalog({
          initialSnapshot: {
            ...snapshot,
            resources: [snapshot.resources[0]!, snapshot.resources[0]!],
          },
        }),
    ).toThrow('snapshot')
  })
})

describe('InMemoryResourceOperationExecutor deep copy', () => {
  it('copies a bounded closure with final IDs and one content-owned target map', async () => {
    const catalog = new InMemoryResourceCatalog()
    const committedResourceMaps: Array<ReadonlyArray<{ sourceId: string; destinationId: string }>> =
      []
    const contentCopy = {
      prepare: vi.fn((context) => Promise.resolve(context)),
      referenceableTargets: vi.fn(() => []),
      finalize: vi.fn((plan) =>
        Promise.resolve(() => committedResourceMaps.push(plan.resourceMap)),
      ),
    }
    const operations = new InMemoryResourceOperationExecutor(catalog, {
      authorize: () => true,
      contentCopy,
      now: () => 30,
    })
    const sourceRootId = resourceDomainId(20)
    const sourceChildId = resourceDomainId(21)
    const destinationId = resourceDomainId(22)
    await createResource(operations, sourceRootId, operationDomainId(20), null, 'folder')
    await createResource(operations, sourceChildId, operationDomainId(21), sourceRootId, 'note')
    await createResource(operations, destinationId, operationDomainId(22), null, 'folder')
    await operations.appendAlias({
      campaignId,
      resourceId: sourceChildId,
      firstSeenImportJobId: assertDomainId(
        DOMAIN_ID_KIND.importJob,
        '01890f47-f6c8-7a5b-8c9d-000000000023',
      ),
      sourceRootId: 'upload',
      value: { rawPath: 'Note.md', normalizedPath: 'note.md' },
    })
    await operations.setRole(campaignId, { role: 'campaign-home', resourceId: sourceRootId })
    const listener = vi.fn()
    catalog.subscribe(campaignId, listener)

    const result = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(24),
      command: {
        type: 'deepCopy',
        sourceRootIds: [sourceRootId],
        destinationParentId: destinationId,
      },
    })

    expect(result).toMatchObject({
      status: 'completed',
      receipt: {
        result: {
          type: 'deepCopied',
          roots: [{ sourceRootId, destinationRootId: expect.any(String) }],
        },
        postconditions: [
          { state: 'present', metadataVersion: { revision: 1 } },
          { state: 'present', metadataVersion: { revision: 1 } },
        ],
      },
    })
    if (result.status !== 'completed' || result.receipt.result.type !== 'deepCopied') {
      throw new TypeError('Expected deep copy completion')
    }
    const copiedRootId = result.receipt.result.roots[0]!.destinationRootId
    const copiedResources = catalog
      .getSnapshot(campaignId)
      .resources.filter(
        (resource) => ![sourceRootId, sourceChildId, destinationId].includes(resource.id),
      )
    const copiedRoot = copiedResources.find((resource) => resource.id === copiedRootId)
    const copiedChild = copiedResources.find((resource) => resource.parentId === copiedRootId)

    expect(copiedRoot).toMatchObject({
      parentId: destinationId,
      kind: 'folder',
      title: 'Resource 20',
      created: { at: 30, by: actorId },
      updated: { at: 30, by: actorId },
    })
    expect(copiedChild).toMatchObject({ kind: 'note', title: 'Resource 21' })
    expect(committedResourceMaps).toEqual([
      expect.arrayContaining([
        { sourceId: sourceRootId, destinationId: copiedRootId },
        { sourceId: sourceChildId, destinationId: copiedChild?.id },
      ]),
    ])
    expect(contentCopy.finalize).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        {
          source: { kind: 'resource', resourceId: sourceRootId },
          destination: { kind: 'resource', resourceId: copiedRootId },
        },
      ]),
    )
    expect(await catalog.listAliases(campaignId, copiedChild!.id)).toEqual([])
    expect(await catalog.listRoles(campaignId)).toEqual([
      { role: 'campaign-home', resourceId: sourceRootId },
    ])
    expect(listener).toHaveBeenCalledOnce()
  })

  it('rejects content planning failures without committing metadata', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = new InMemoryResourceOperationExecutor(catalog, {
      authorize: () => true,
      contentCopy: {
        prepare: () => Promise.reject(new Error('invalid content')),
        referenceableTargets: () => [],
        finalize: () => Promise.resolve(() => undefined),
      },
    })
    const sourceId = resourceDomainId(30)
    await createResource(operations, sourceId, operationDomainId(30), null, 'note')
    const before = catalog.getSnapshot(campaignId)

    await expect(
      operations.execute(actorId, {
        campaignId,
        operationId: operationDomainId(31),
        command: { type: 'deepCopy', sourceRootIds: [sourceId], destinationParentId: null },
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'content_integrity_failure' })
    expect(catalog.getSnapshot(campaignId)).toBe(before)
  })

  it('reports deep copy as unavailable without a content owner', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = new InMemoryResourceOperationExecutor(catalog, {
      authorize: () => true,
    })

    await expect(
      operations.execute(actorId, {
        campaignId,
        operationId: operationDomainId(40),
        command: {
          type: 'deepCopy',
          sourceRootIds: [resourceDomainId(40)],
          destinationParentId: null,
        },
      }),
    ).resolves.toEqual({ status: 'unavailable', reason: 'capability_not_supported' })
  })
})

function resourceDomainId(sequence: number) {
  return assertDomainId(
    DOMAIN_ID_KIND.resource,
    `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`,
  )
}

function operationDomainId(sequence: number) {
  return assertDomainId(
    DOMAIN_ID_KIND.operation,
    `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`,
  )
}

async function createResource(
  operations: AuthoritativeResourceOperationExecutor,
  createdResourceId: ReturnType<typeof resourceDomainId>,
  operationId: ReturnType<typeof operationDomainId>,
  parentId: ReturnType<typeof resourceDomainId> | null,
  kind: 'folder' | 'note',
) {
  return await operations.execute(actorId, {
    campaignId,
    operationId,
    command: {
      type: 'create',
      resourceId: createdResourceId,
      parentId,
      kind,
      title: canonicalizeResourceTitle(
        `Resource ${Number.parseInt(createdResourceId.slice(-2), 16)}`,
      ),
      icon: null,
      color: null,
    },
  })
}
