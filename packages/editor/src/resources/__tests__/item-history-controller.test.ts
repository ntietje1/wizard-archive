import { describe, expect, it, vi } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createItemHistoryController } from '../item-history-controller'
import type {
  ItemHistoryBackend,
  ItemHistoryPageResult,
  ItemHistoryPreviewResult,
} from '../item-history-controller'
import type { ItemHistoryEntry, ItemHistoryRestoreResult } from '../editor-runtime-contract'
import type { ResourceId } from '../domain-id'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function historyFixture() {
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const actor = {
    id: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    displayName: 'Mira',
    imageUrl: null,
  }
  const version = initialVersion(assertSha256Digest('a'.repeat(64)))
  const timeline: ItemHistoryEntry = {
    id: generateDomainId(DOMAIN_ID_KIND.historyEntry),
    resourceId,
    actor,
    action: 'renamed',
    metadata: { from: 'Draft', to: 'Field notes' },
    createdAt: 20,
  }
  const checkpoint: ItemHistoryEntry = {
    id: generateDomainId(DOMAIN_ID_KIND.historyEntry),
    resourceId,
    actor,
    action: 'content_edited',
    metadata: null,
    createdAt: 10,
    checkpoint: {
      kind: 'note',
      snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
      version,
    },
  }
  const preview = {
    ...checkpoint.checkpoint,
    update: new Uint8Array([1, 2, 3]),
  } as const
  return { checkpoint, preview, resourceId, timeline }
}

function historyBackend(
  loadCheckpoint: ItemHistoryBackend['loadCheckpoint'] = () =>
    Promise.resolve({ status: 'unavailable' }),
  restore: ItemHistoryBackend['restore'] = () => Promise.resolve({ status: 'unavailable' }),
) {
  const watches: Array<{
    resourceId: ResourceId
    cursor: string | null
    publish: (result: ItemHistoryPageResult) => void
    dispose: ReturnType<typeof vi.fn>
  }> = []
  const backend: ItemHistoryBackend = {
    watchPage: (resourceId, cursor, publish) => {
      const dispose = vi.fn()
      watches.push({ resourceId, cursor, publish, dispose })
      return dispose
    },
    loadCheckpoint,
    restore,
  }
  return { backend, watches }
}

describe('item history controller', () => {
  it('owns watched pagination and rejects invalid duplicate pages', () => {
    const fixture = historyFixture()
    const source = historyBackend()
    const history = createItemHistoryController(source.backend)
    const listener = vi.fn()
    const unsubscribe = history.controller.subscribe(fixture.resourceId, listener)

    expect(source.watches).toHaveLength(1)
    expect(source.watches[0]).toMatchObject({ resourceId: fixture.resourceId, cursor: null })
    source.watches[0]!.publish({
      status: 'ready',
      entries: [fixture.timeline],
      nextCursor: 'page-2',
    })
    expect(history.controller.get(fixture.resourceId).list).toEqual({
      status: 'ready',
      entries: [fixture.timeline],
      pagination: 'more_available',
    })

    history.controller.loadMore(fixture.resourceId)
    expect(source.watches[1]).toMatchObject({ cursor: 'page-2' })
    expect(history.controller.get(fixture.resourceId).list).toMatchObject({
      pagination: 'loading_more',
    })
    source.watches[1]!.publish({
      status: 'ready',
      entries: [fixture.timeline],
      nextCursor: null,
    })
    expect(source.watches[1]!.dispose).toHaveBeenCalledOnce()
    expect(history.controller.get(fixture.resourceId).list).toEqual({
      status: 'ready',
      entries: [fixture.timeline],
      pagination: 'more_available',
    })

    unsubscribe()
    expect(source.watches[0]!.dispose).toHaveBeenCalledOnce()
    expect(history.controller.get(fixture.resourceId)).toEqual({
      list: { status: 'loading' },
      preview: { status: 'closed' },
      restore: { status: 'closed' },
    })
  })

  it('ignores stale checkpoint loads and delayed results after cleanup', async () => {
    const fixture = historyFixture()
    const first = deferred<ItemHistoryPreviewResult>()
    const second = deferred<ItemHistoryPreviewResult>()
    const loadCheckpoint = vi
      .fn<ItemHistoryBackend['loadCheckpoint']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const source = historyBackend(loadCheckpoint)
    const history = createItemHistoryController(source.backend)
    const unsubscribe = history.controller.subscribe(fixture.resourceId, vi.fn())
    source.watches[0]!.publish({
      status: 'ready',
      entries: [fixture.checkpoint],
      nextCursor: null,
    })

    history.controller.selectPreview(fixture.resourceId, fixture.checkpoint.id)
    history.controller.selectPreview(fixture.resourceId, fixture.checkpoint.id)
    second.resolve({ status: 'ready', preview: fixture.preview })
    await second.promise
    expect(history.controller.get(fixture.resourceId).preview).toMatchObject({
      status: 'ready',
      preview: fixture.preview,
    })
    first.resolve({ status: 'unavailable' })
    await first.promise
    expect(history.controller.get(fixture.resourceId).preview).toMatchObject({ status: 'ready' })

    history.controller.selectPreview(fixture.resourceId, fixture.checkpoint.id)
    unsubscribe()
    expect(history.controller.get(fixture.resourceId).preview).toEqual({ status: 'closed' })
  })

  it('deduplicates restore, preserves explicit failures, and closes successful restores', async () => {
    const fixture = historyFixture()
    const first = deferred<ItemHistoryRestoreResult>()
    const restore = vi
      .fn<ItemHistoryBackend['restore']>()
      .mockReturnValueOnce(first.promise)
      .mockImplementationOnce((_resourceId, _entryId, operationId) =>
        Promise.resolve({
          status: 'restored',
          operationId,
          historyEntryId: generateDomainId(DOMAIN_ID_KIND.historyEntry),
          preservedSnapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
          restoredFromEntryId: fixture.checkpoint.id,
        }),
      )
    const source = historyBackend(undefined, restore)
    const history = createItemHistoryController(source.backend)
    history.controller.subscribe(fixture.resourceId, vi.fn())
    source.watches[0]!.publish({
      status: 'ready',
      entries: [fixture.timeline, fixture.checkpoint],
      nextCursor: null,
    })

    history.controller.requestRestore(fixture.resourceId, fixture.timeline.id)
    expect(history.controller.get(fixture.resourceId).restore).toEqual({ status: 'closed' })
    history.controller.requestRestore(fixture.resourceId, fixture.checkpoint.id)
    const firstConfirmation = history.controller.confirmRestore(fixture.resourceId)
    const duplicateConfirmation = history.controller.confirmRestore(fixture.resourceId)
    expect(restore).toHaveBeenCalledOnce()
    const firstOperationId = restore.mock.calls[0]![2]
    first.resolve({
      status: 'rejected',
      operationId: firstOperationId,
      reason: 'content_changed',
    })
    await expect(firstConfirmation).resolves.toMatchObject({
      status: 'rejected',
      reason: 'content_changed',
    })
    await expect(duplicateConfirmation).resolves.toMatchObject({
      status: 'rejected',
      reason: 'content_changed',
    })
    expect(history.controller.get(fixture.resourceId).restore).toMatchObject({
      status: 'error',
      result: { status: 'rejected', reason: 'content_changed' },
    })

    const restored = await history.controller.confirmRestore(fixture.resourceId)
    expect(restored).toMatchObject({
      status: 'restored',
      restoredFromEntryId: fixture.checkpoint.id,
    })
    expect(restore.mock.calls[1]![2]).not.toBe(firstOperationId)
    expect(history.controller.get(fixture.resourceId)).toMatchObject({
      preview: { status: 'closed' },
      restore: { status: 'closed' },
    })
  })

  it('coalesces double confirmation and reuses one operation after response loss', async () => {
    const fixture = historyFixture()
    const restore = vi
      .fn<ItemHistoryBackend['restore']>()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockImplementationOnce((_resourceId, _entryId, operationId) =>
        Promise.resolve({
          status: 'restored',
          operationId,
          historyEntryId: generateDomainId(DOMAIN_ID_KIND.historyEntry),
          preservedSnapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
          restoredFromEntryId: fixture.checkpoint.id,
        }),
      )
    const source = historyBackend(undefined, restore)
    const history = createItemHistoryController(source.backend)
    history.controller.subscribe(fixture.resourceId, vi.fn())
    source.watches[0]!.publish({
      status: 'ready',
      entries: [fixture.checkpoint],
      nextCursor: null,
    })
    history.controller.requestRestore(fixture.resourceId, fixture.checkpoint.id)

    const first = history.controller.confirmRestore(fixture.resourceId)
    const doubleClick = history.controller.confirmRestore(fixture.resourceId)
    await expect(first).resolves.toEqual({ status: 'failed' })
    await expect(doubleClick).resolves.toEqual({ status: 'failed' })
    expect(restore).toHaveBeenCalledOnce()

    await expect(history.controller.confirmRestore(fixture.resourceId)).resolves.toMatchObject({
      status: 'restored',
    })
    expect(restore).toHaveBeenCalledTimes(2)
    expect(restore.mock.calls[1]![2]).toBe(restore.mock.calls[0]![2])
  })
})
