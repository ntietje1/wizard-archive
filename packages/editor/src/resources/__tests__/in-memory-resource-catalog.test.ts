import { describe, expect, it, vi } from 'vite-plus/test'
import type { AuthoritativeResourceOperationExecutor } from '../resource-command-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import { InMemoryResourceCatalog } from '../in-memory-resource-catalog'
import { canonicalizeResourceTitle } from '../resource-record'

const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-000000000001')
const actorId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-000000000002',
)
const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-000000000003')

describe('InMemoryResourceCatalog snapshots', () => {
  it('hydrates an authoritative snapshot and publishes committed changes', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = source.operations({
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
    const operations = catalog.operations({
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
    expect(listener).toHaveBeenCalledOnce()
  })

  it('rejects invalid hydrated ownership and hierarchy', async () => {
    const source = new InMemoryResourceCatalog()
    const sourceOperations = source.operations({
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

describe('in-memory resource operations deep copy', () => {
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
    const operations = catalog.operations({
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
      importJobId: assertDomainId(DOMAIN_ID_KIND.importJob, '01890f47-f6c8-7a5b-8c9d-000000000023'),
      sourceRootId: 'upload',
      rawPath: 'Note.md',
      normalizedPath: 'Note.md',
    })
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
    const snapshot = catalog.getSnapshot(campaignId)
    expect(snapshot.aliases.filter((alias) => alias.resourceId === copiedChild!.id)).toEqual([])
    expect(listener).toHaveBeenCalledOnce()
  })

  it('rejects content planning failures without committing metadata', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({
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
    const operations = catalog.operations({
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

describe('in-memory resource compensation', () => {
  it('replays compensation before checking its consumed postcondition', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({ authorize: () => true })
    const id = resourceDomainId(50)
    await createResource(operations, id, operationDomainId(50), null, 'note')
    const renamed = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(51),
      command: {
        type: 'updateMetadata',
        resourceId: id,
        changes: { title: canonicalizeResourceTitle('Renamed') },
      },
    })
    if (renamed.status !== 'completed') throw new TypeError('Expected rename completion')
    const compensation = {
      campaignId,
      operationId: operationDomainId(52),
      originalOperationId: renamed.receipt.operationId,
    }

    const first = await operations.compensate(actorId, compensation)
    const replay = await operations.compensate(actorId, compensation)

    expect(replay).toEqual(first)
    expect(catalog.getSnapshot(campaignId).resources[0]?.title).toBe('Resource 50')
  })

  it('rejects compensation after a later edit without overwriting it', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({ authorize: () => true })
    const id = resourceDomainId(60)
    await createResource(operations, id, operationDomainId(60), null, 'note')
    const renamed = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(61),
      command: {
        type: 'updateMetadata',
        resourceId: id,
        changes: { title: canonicalizeResourceTitle('First rename') },
      },
    })
    if (renamed.status !== 'completed') throw new TypeError('Expected rename completion')
    await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(62),
      command: {
        type: 'updateMetadata',
        resourceId: id,
        changes: { title: canonicalizeResourceTitle('Later edit') },
      },
    })

    await expect(
      operations.compensate(actorId, {
        campaignId,
        operationId: operationDomainId(63),
        originalOperationId: renamed.receipt.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_conflict' })
    expect(catalog.getSnapshot(campaignId).resources[0]?.title).toBe('Later edit')
  })

  it('atomically restores mixed-parent moves and redoes the server-issued compensation', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({ authorize: () => true })
    const parentA = resourceDomainId(70)
    const parentB = resourceDomainId(71)
    const destination = resourceDomainId(72)
    const childA = resourceDomainId(73)
    const childB = resourceDomainId(74)
    await createResource(operations, parentA, operationDomainId(70), null, 'folder')
    await createResource(operations, parentB, operationDomainId(71), null, 'folder')
    await createResource(operations, destination, operationDomainId(72), null, 'folder')
    await createResource(operations, childA, operationDomainId(73), parentA, 'note')
    await createResource(operations, childB, operationDomainId(74), parentB, 'note')
    const moved = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(75),
      command: { type: 'move', resourceIds: [childA, childB], destinationParentId: destination },
    })
    if (moved.status !== 'completed') throw new Error('Expected move completion')

    const undone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(76),
      originalOperationId: moved.receipt.operationId,
    })
    if (undone.status !== 'completed') throw new Error('Expected undo completion')
    expect(parentIds(catalog, childA, childB)).toEqual([parentA, parentB])

    const redone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(77),
      originalOperationId: undone.receipt.operationId,
    })
    expect(redone.status).toBe('completed')
    expect(parentIds(catalog, childA, childB)).toEqual([destination, destination])
  })

  it('defines restore redo semantics and rejects irreversible operation history', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({ authorize: () => true })
    const id = resourceDomainId(80)
    await createResource(operations, id, operationDomainId(80), null, 'note')
    await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(81),
      command: { type: 'trash', resourceIds: [id] },
    })
    const restored = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(82),
      command: { type: 'restore', resourceIds: [id] },
    })
    if (restored.status !== 'completed') throw new Error('Expected restore completion')
    const undone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(83),
      originalOperationId: restored.receipt.operationId,
    })
    if (undone.status !== 'completed') throw new Error('Expected restore undo completion')
    expect(catalog.getSnapshot(campaignId).resources[0]?.lifecycle.state).toBe('trashed')
    const redone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(84),
      originalOperationId: undone.receipt.operationId,
    })
    expect(redone.status).toBe('completed')
    expect(catalog.getSnapshot(campaignId).resources[0]?.lifecycle.state).toBe('active')

    await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(85),
      command: { type: 'trash', resourceIds: [id] },
    })
    const deleted = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(86),
      command: { type: 'permanentlyDelete', resourceIds: [id] },
    })
    if (deleted.status !== 'completed') throw new Error('Expected deletion completion')
    await expect(
      operations.compensate(actorId, {
        campaignId,
        operationId: operationDomainId(87),
        originalOperationId: deleted.receipt.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_irreversible' })
  })

  it('rejects create, restore, and deep-copy undo after a later descendant appears', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({
      authorize: () => true,
      contentCopy: {
        prepare: (context) => Promise.resolve(context),
        referenceableTargets: () => [],
        finalize: () => Promise.resolve(() => undefined),
      },
    })
    const compensate = (
      originalOperationId: ReturnType<typeof operationDomainId>,
      sequence: number,
    ) =>
      operations.compensate(actorId, {
        campaignId,
        operationId: operationDomainId(sequence),
        originalOperationId,
      })

    const createdRoot = resourceDomainId(90)
    const created = await createResource(
      operations,
      createdRoot,
      operationDomainId(90),
      null,
      'folder',
    )
    if (created.status !== 'completed') throw new Error('Expected create completion')
    const createdChild = resourceDomainId(91)
    await createResource(operations, createdChild, operationDomainId(91), createdRoot, 'note')
    await expect(compensate(created.receipt.operationId, 92)).resolves.toEqual({
      status: 'rejected',
      reason: 'history_conflict',
    })

    const restoredRoot = resourceDomainId(93)
    const restoredChild = resourceDomainId(94)
    await createResource(operations, restoredRoot, operationDomainId(93), null, 'folder')
    await createResource(operations, restoredChild, operationDomainId(94), restoredRoot, 'note')
    await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(95),
      command: { type: 'trash', resourceIds: [restoredRoot] },
    })
    const restored = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(96),
      command: { type: 'restore', resourceIds: [restoredRoot] },
    })
    if (restored.status !== 'completed') throw new Error('Expected restore completion')
    const laterRestoredChild = resourceDomainId(97)
    await createResource(
      operations,
      laterRestoredChild,
      operationDomainId(97),
      restoredRoot,
      'note',
    )
    await expect(compensate(restored.receipt.operationId, 98)).resolves.toEqual({
      status: 'rejected',
      reason: 'history_conflict',
    })

    const sourceRoot = resourceDomainId(100)
    const sourceChild = resourceDomainId(101)
    await createResource(operations, sourceRoot, operationDomainId(100), null, 'folder')
    await createResource(operations, sourceChild, operationDomainId(101), sourceRoot, 'folder')
    const copied = await operations.execute(actorId, {
      campaignId,
      operationId: operationDomainId(102),
      command: { type: 'deepCopy', sourceRootIds: [sourceRoot], destinationParentId: null },
    })
    if (copied.status !== 'completed' || copied.receipt.result.type !== 'deepCopied') {
      throw new Error('Expected deep-copy completion')
    }
    const copiedRoot = copied.receipt.result.roots[0]!.destinationRootId
    const laterCopiedChild = resourceDomainId(103)
    await createResource(operations, laterCopiedChild, operationDomainId(103), copiedRoot, 'note')
    await expect(compensate(copied.receipt.operationId, 104)).resolves.toEqual({
      status: 'rejected',
      reason: 'history_conflict',
    })

    expect(parentIds(catalog, createdChild, laterRestoredChild, laterCopiedChild)).toEqual([
      createdRoot,
      restoredRoot,
      copiedRoot,
    ])
  })

  it('keeps closure membership exact when compensating a redo', async () => {
    const catalog = new InMemoryResourceCatalog()
    const operations = catalog.operations({ authorize: () => true })
    const root = resourceDomainId(110)
    const created = await createResource(operations, root, operationDomainId(110), null, 'folder')
    if (created.status !== 'completed') throw new Error('Expected create completion')
    const undone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(111),
      originalOperationId: created.receipt.operationId,
    })
    if (undone.status !== 'completed') throw new Error('Expected undo completion')
    const redone = await operations.compensate(actorId, {
      campaignId,
      operationId: operationDomainId(112),
      originalOperationId: undone.receipt.operationId,
    })
    if (redone.status !== 'completed') throw new Error('Expected redo completion')
    const laterChild = resourceDomainId(113)
    await createResource(operations, laterChild, operationDomainId(113), root, 'note')

    await expect(
      operations.compensate(actorId, {
        campaignId,
        operationId: operationDomainId(114),
        originalOperationId: redone.receipt.operationId,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'history_conflict' })
    expect(parentIds(catalog, laterChild)).toEqual([root])
  })
})

function parentIds(
  catalog: InMemoryResourceCatalog,
  ...resourceIds: ReadonlyArray<ReturnType<typeof resourceDomainId>>
) {
  const byId = new Map(
    catalog.getSnapshot(campaignId).resources.map((resource) => [resource.id, resource]),
  )
  return resourceIds.map((id) => byId.get(id)?.parentId)
}

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
