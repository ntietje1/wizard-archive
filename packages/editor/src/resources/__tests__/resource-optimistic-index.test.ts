import { describe, expect, it } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { DomainIdByKind, DomainIdKind, OperationId, ResourceId } from '../domain-id'
import type { ResourceCommandReceipt } from '../resource-command-contract'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceProjectionScope,
} from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-contract'
import { OptimisticWorkspaceResourceIndex } from '../resource-optimistic-index'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

const campaignId = id(DOMAIN_ID_KIND.campaign, 1)
const actorId = id(DOMAIN_ID_KIND.campaignMember, 2)
const rootId = id(DOMAIN_ID_KIND.resource, 10)
const folderId = id(DOMAIN_ID_KIND.resource, 11)
const noteId = id(DOMAIN_ID_KIND.resource, 12)
const createdId = id(DOMAIN_ID_KIND.resource, 13)
const missingId = id(DOMAIN_ID_KIND.resource, 14)
const version1 = initialVersion(assertSha256Digest('1'.repeat(64)))
const version2 = initialVersion(assertSha256Digest('2'.repeat(64)))
const version3 = initialVersion(assertSha256Digest('3'.repeat(64)))
const scope: ResourceProjectionScope = {
  campaignId,
  actorId,
  projection: 'player',
  schema: 'resource-index-v1',
}

function id<TKind extends DomainIdKind>(kind: TKind, sequence: number): DomainIdByKind[TKind] {
  return assertDomainId(kind, `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`)
}

function summary(
  resourceId: ResourceId,
  input: Partial<AuthorizedResourceSummary> = {},
): AuthorizedResourceSummary {
  return {
    id: resourceId,
    campaignId,
    displayParentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle('Entry'),
    icon: null,
    color: null,
    lifecycle: 'active',
    metadataVersion: version1,
    createdAt: 1,
    updatedAt: 2,
    ...input,
  }
}

function snapshot(input: Partial<AuthorizedResourceSnapshot> = {}): AuthorizedResourceSnapshot {
  return {
    scope,
    revision: indexRevision('base-1'),
    resources: [summary(rootId, { kind: 'folder' })],
    missingResourceIds: [missingId],
    collections: [],
    ...input,
  }
}

function indexWith(input: Partial<AuthorizedResourceSnapshot> = {}): MutableWorkspaceResourceIndex {
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
  expect(index.replaceSnapshot(snapshot(input))).toEqual({ status: 'applied' })
  return index
}

function operation(sequence: number): OperationId {
  return id(DOMAIN_ID_KIND.operation, sequence)
}

function receipt(
  operationId: OperationId,
  resourceId: ResourceId,
  metadataVersion = version2,
): ResourceCommandReceipt {
  return {
    campaignId,
    operationId,
    result: { type: 'metadataUpdated', resourceId },
    postconditions: [{ state: 'present', resourceId, metadataVersion }],
  }
}

describe('OptimisticWorkspaceResourceIndex', () => {
  it('projects final-UUID creates without changing authoritative revision or unknown collections', async () => {
    const base = indexWith({
      collections: [
        {
          query: { parentId: null, lifecycle: 'active' },
          resourceIds: [rootId],
          complete: true,
        },
      ],
    })
    const optimistic = new OptimisticWorkspaceResourceIndex(base, () => 100)
    const baseSnapshot = base.getSnapshot()
    const operationId = operation(20)

    await expect(
      optimistic.submit(operationId, {
        type: 'create',
        resourceId: createdId,
        kind: 'note',
        parentId: null,
        title: canonicalizeResourceTitle('Created'),
        icon: null,
        color: null,
      }),
    ).resolves.toEqual({ status: 'applied' })

    expect(optimistic.getSnapshot().revision).toBe(baseSnapshot.revision)
    expect(base.getSnapshot()).toBe(baseSnapshot)
    expect(base.getSnapshot().lookup(createdId)).toEqual({ state: 'unknown' })
    expect(optimistic.getSnapshot().lookup(createdId)).toEqual({
      state: 'known',
      value: expect.objectContaining({
        id: createdId,
        title: 'Created',
        createdAt: 100,
        updatedAt: 100,
      }),
    })
    expect(optimistic.getSnapshot().list({ parentId: null, lifecycle: 'active' }).state).toBe(
      'known',
    )
    expect(optimistic.getSnapshot().list({ parentId: rootId, lifecycle: 'active' })).toEqual({
      state: 'unknown',
    })
    expect(optimistic.overlays()).toEqual([
      expect.objectContaining({ status: 'pending', ordinal: 1, operationId }),
    ])
  })

  it('requires structural dependencies to exist in the authoritative base', async () => {
    const base = indexWith()
    const optimistic = new OptimisticWorkspaceResourceIndex(base)
    const createOperation = operation(21)
    const updateOperation = operation(22)

    expect(
      await optimistic.submit(createOperation, {
        type: 'create',
        resourceId: createdId,
        kind: 'folder',
        parentId: null,
        title: canonicalizeResourceTitle('Created'),
        icon: null,
        color: null,
      }),
    ).toEqual({ status: 'applied' })
    expect(
      await optimistic.submit(updateOperation, {
        type: 'updateMetadata',
        resourceId: createdId,
        changes: { title: canonicalizeResourceTitle('Too Soon') },
      }),
    ).toEqual({ status: 'rejected', reason: 'dependency_unavailable' })
    expect(
      await optimistic.submit(createOperation, {
        type: 'create',
        resourceId: createdId,
        kind: 'folder',
        parentId: null,
        title: canonicalizeResourceTitle('Created'),
        icon: null,
        color: null,
      }),
    ).toEqual({ status: 'duplicate' })
    expect(
      await optimistic.submit(createOperation, {
        type: 'updateMetadata',
        resourceId: rootId,
        changes: { title: canonicalizeResourceTitle('Reused') },
      }),
    ).toEqual({ status: 'rejected', reason: 'operation_id_reused' })
  })

  it('composes overlays by ordinal and removes only the selected operation', async () => {
    const base = indexWith({
      resources: [
        summary(rootId, { kind: 'folder' }),
        summary(folderId, { kind: 'folder' }),
        summary(noteId),
      ],
    })
    const optimistic = new OptimisticWorkspaceResourceIndex(base)
    const renameOperation = operation(23)
    const moveOperation = operation(24)

    await optimistic.submit(renameOperation, {
      type: 'updateMetadata',
      resourceId: noteId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })
    await optimistic.submit(moveOperation, {
      type: 'move',
      resourceIds: [noteId],
      destinationParentId: folderId,
    })
    expect(optimistic.overlays().map((overlay) => overlay.ordinal)).toEqual([1, 2])
    expect(optimistic.getSnapshot().lookup(noteId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ title: 'Renamed', displayParentId: folderId }),
    })

    expect(optimistic.remove(renameOperation)).toBe(true)
    expect(optimistic.getSnapshot().lookup(noteId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ title: 'Entry', displayParentId: folderId }),
    })
    expect(optimistic.remove(renameOperation)).toBe(false)
    expect(optimistic.remove(moveOperation)).toBe(true)
    expect(optimistic.getSnapshot().lookup(noteId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ displayParentId: null }),
    })
  })

  it('applies trash and restore only across the known loaded subtree', async () => {
    const base = indexWith({
      resources: [
        summary(rootId, { kind: 'folder' }),
        summary(folderId, { kind: 'folder', displayParentId: rootId }),
        summary(noteId, { displayParentId: folderId }),
      ],
      collections: [
        {
          query: { parentId: rootId, lifecycle: 'active' },
          resourceIds: [folderId],
          complete: true,
        },
        {
          query: { parentId: folderId, lifecycle: 'active' },
          resourceIds: [noteId],
          complete: true,
        },
      ],
    })
    const optimistic = new OptimisticWorkspaceResourceIndex(base)

    await optimistic.submit(operation(25), { type: 'trash', resourceIds: [folderId] })
    expect(optimistic.getSnapshot().lookup(folderId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ lifecycle: 'trashed' }),
    })
    expect(optimistic.getSnapshot().lookup(noteId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ lifecycle: 'trashed' }),
    })
    expect(optimistic.getSnapshot().lookup(rootId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ lifecycle: 'active' }),
    })
  })

  it('retains confirmed overlays until exact base postconditions arrive', async () => {
    const base = indexWith()
    const optimistic = new OptimisticWorkspaceResourceIndex(base)
    const operationId = operation(26)
    await optimistic.submit(operationId, {
      type: 'updateMetadata',
      resourceId: rootId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })

    expect(optimistic.confirm(receipt(operationId, rootId))).toEqual({ status: 'confirmed' })
    expect(optimistic.overlays()[0]).toEqual(
      expect.objectContaining({ status: 'confirmed', postconditions: expect.any(Array) }),
    )
    expect(optimistic.getSnapshot().lookup(rootId)).toEqual({
      state: 'known',
      value: expect.objectContaining({ title: 'Renamed', metadataVersion: version2 }),
    })
    expect(optimistic.confirm(receipt(operationId, rootId, version3))).toEqual({
      status: 'rejected',
      reason: 'receipt_mismatch',
    })

    expect(
      base.applyChangeSet({
        scope,
        baseRevision: indexRevision('base-1'),
        nextRevision: indexRevision('base-2'),
        changes: [
          {
            type: 'upsert',
            resource: summary(rootId, {
              kind: 'folder',
              title: canonicalizeResourceTitle('Renamed'),
              metadataVersion: version2,
            }),
          },
        ],
      }),
    ).toEqual({ status: 'applied' })
    expect(optimistic.overlays()).toEqual([])
    expect(optimistic.getSnapshot()).toBe(base.getSnapshot())
  })

  it('retires immediately when the base already satisfies a receipt', async () => {
    const base = indexWith({
      resources: [summary(rootId, { kind: 'folder', metadataVersion: version2 })],
    })
    const optimistic = new OptimisticWorkspaceResourceIndex(base)
    const operationId = operation(27)
    await optimistic.submit(operationId, {
      type: 'updateMetadata',
      resourceId: rootId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })

    expect(optimistic.confirm(receipt(operationId, rootId))).toEqual({ status: 'retired' })
    expect(optimistic.overlays()).toEqual([])
  })

  it('clears all overlays synchronously when projection scope changes', async () => {
    const base = indexWith()
    const optimistic = new OptimisticWorkspaceResourceIndex(base)
    await optimistic.submit(operation(28), {
      type: 'updateMetadata',
      resourceId: rootId,
      changes: { title: canonicalizeResourceTitle('Renamed') },
    })
    const nextScope: ResourceProjectionScope = {
      ...scope,
      actorId: id(DOMAIN_ID_KIND.campaignMember, 30),
    }

    base.replaceScope(nextScope, indexRevision('new-scope'))

    expect(optimistic.overlays()).toEqual([])
    expect(optimistic.getSnapshot().scope).toEqual(nextScope)
    expect(optimistic.getSnapshot().lookup(rootId)).toEqual({ state: 'unknown' })
  })

  it('reconciles delivery without dropping indeterminate operations', async () => {
    const optimistic = new OptimisticWorkspaceResourceIndex(indexWith())
    const retainedOperation = operation(31)
    await optimistic.submit(retainedOperation, {
      type: 'updateMetadata',
      resourceId: rootId,
      changes: { title: canonicalizeResourceTitle('Retained') },
    })

    expect(
      optimistic.reconcile(retainedOperation, {
        status: 'indeterminate',
        retryable: true,
        reason: 'response_lost',
      }),
    ).toEqual({ status: 'retained' })
    expect(optimistic.overlays()).toHaveLength(1)

    expect(
      optimistic.reconcile(retainedOperation, {
        status: 'not_committed',
        retryable: true,
        reason: 'transport_unavailable',
      }),
    ).toEqual({ status: 'removed' })
    expect(optimistic.overlays()).toEqual([])
  })

  it('removes only matching rejected or unavailable operations', async () => {
    const optimistic = new OptimisticWorkspaceResourceIndex(indexWith())
    const rejectedOperation = operation(32)
    const unavailableOperation = operation(33)
    for (const [operationId, title] of [
      [rejectedOperation, 'Rejected'],
      [unavailableOperation, 'Unavailable'],
    ] as const) {
      await optimistic.submit(operationId, {
        type: 'updateMetadata',
        resourceId: rootId,
        changes: { title: canonicalizeResourceTitle(title) },
      })
    }

    expect(
      optimistic.reconcile(rejectedOperation, {
        status: 'received',
        result: { status: 'rejected', reason: 'unauthorized' },
      }),
    ).toEqual({ status: 'removed' })
    expect(optimistic.overlays().map((overlay) => overlay.operationId)).toEqual([
      unavailableOperation,
    ])
    expect(
      optimistic.reconcile(unavailableOperation, {
        status: 'received',
        result: { status: 'unavailable', reason: 'scope_unavailable' },
      }),
    ).toEqual({ status: 'removed' })
  })

  it('confirms matching completed receipts and rejects mismatched receipt identities', async () => {
    const optimistic = new OptimisticWorkspaceResourceIndex(indexWith())
    const operationId = operation(34)
    await optimistic.submit(operationId, {
      type: 'updateMetadata',
      resourceId: rootId,
      changes: { title: canonicalizeResourceTitle('Confirmed') },
    })

    expect(
      optimistic.reconcile(operationId, {
        status: 'received',
        result: { status: 'completed', receipt: receipt(operation(35), rootId) },
      }),
    ).toEqual({ status: 'rejected', reason: 'receipt_mismatch' })
    expect(optimistic.overlays()).toHaveLength(1)
    expect(
      optimistic.reconcile(operationId, {
        status: 'received',
        result: { status: 'completed', receipt: receipt(operationId, rootId) },
      }),
    ).toEqual({ status: 'confirmed' })
  })
})
