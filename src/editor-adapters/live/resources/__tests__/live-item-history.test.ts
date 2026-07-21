import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '@wizard-archive/editor/resources/component-version'
import { INITIAL_CONTENT_GENERATION } from '@wizard-archive/editor/resources/content-generation'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CanvasSessionSource,
  MapSessionSource,
  NoteSessionSource,
} from '@wizard-archive/editor/resources/content-session-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import {
  MutableWorkspaceResourceIndex,
  indexRevision,
} from '@wizard-archive/editor/resources/workspace-index'
import type { ItemHistoryPageResult } from '@wizard-archive/editor/resources/item-history-controller'
import { createLiveItemHistory, readLiveItemHistoryPreview } from '../live-item-history'

afterEach(() => vi.unstubAllGlobals())

describe('live item history', () => {
  it('loads historical map images through the canonical verified image path', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const digest = await sha256Digest(bytes)
    const version = initialVersion(digest)
    const fetchImage = vi.fn().mockResolvedValue(new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchImage)
    const stored = {
      kind: 'map',
      snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
      version,
      content: {
        image: {
          status: 'attached',
          byteSize: bytes.byteLength,
          digest,
          mediaType: 'image/png',
        },
        layers: [],
        pins: [],
      },
      images: [{ layerId: null, url: 'https://example.com/history-map.png' }],
    } satisfies Parameters<typeof readLiveItemHistoryPreview>[0]

    const preview = readLiveItemHistoryPreview(stored)
    if (preview.kind !== 'map') throw new TypeError('Expected map preview')

    await expect(preview.loadImage(null)).resolves.toEqual({
      status: 'ready',
      bytes,
      extension: 'png',
      mediaType: 'image/png',
    })
    expect(fetchImage).toHaveBeenCalledWith('https://example.com/history-map.png')
  })

  it('freezes the expected version while retrying a lost restore response', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const entryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const checkpointVersion = initialVersion(await sha256Digest(new Uint8Array([1])))
    const firstVersion = initialVersion(await sha256Digest(new Uint8Array([2])))
    const laterVersion = initialVersion(await sha256Digest(new Uint8Array([3])))
    const index = new MutableWorkspaceResourceIndex(
      { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      indexRevision('empty'),
    )
    index.replaceSnapshot({
      scope: index.getSnapshot().scope,
      revision: indexRevision('note'),
      resources: [
        {
          id: resourceId,
          campaignId,
          displayParentId: null,
          kind: 'note',
          title: canonicalizeResourceTitle('History note'),
          icon: null,
          color: null,
          lifecycle: 'active',
          permission: 'edit',
          metadataVersion: firstVersion,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      missingResourceIds: [],
      collections: [],
    })
    let currentVersion = firstVersion
    const pagePublishers: Array<(result: ItemHistoryPageResult) => void> = []
    const restore = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockImplementationOnce((args) =>
        Promise.resolve({
          status: 'restored',
          operationId: args.operationId,
          historyEntryId: generateDomainId(DOMAIN_ID_KIND.historyEntry),
          preservedSnapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
          restoredFromEntryId: entryId,
        }),
      )
    const history = createLiveItemHistory(
      campaignId,
      index,
      {
        notes: pendingNoteSource(),
        canvases: pendingCanvasSource(),
        maps: pendingMapSource(),
      },
      {
        watchPage: (_resourceId, _cursor, publish) => {
          pagePublishers.push(publish)
          return () => {}
        },
        loadCheckpoint: () => Promise.resolve({ status: 'unavailable' }),
        restore,
        loadNote: () =>
          Promise.resolve({
            status: 'ready',
            generation: INITIAL_CONTENT_GENERATION,
            update: new ArrayBuffer(0),
            version: currentVersion,
          }),
        loadCanvas: () =>
          Promise.resolve({ status: 'unavailable', reason: 'capability_not_supported' }),
        loadMap: () =>
          Promise.resolve({ status: 'unavailable', reason: 'capability_not_supported' }),
      },
    )
    history.controller.subscribe(resourceId, vi.fn())
    pagePublishers[0]!({
      status: 'ready',
      entries: [
        {
          id: entryId,
          resourceId,
          actor: { id: actorId, displayName: 'Mira', imageUrl: null },
          action: 'content_edited',
          metadata: null,
          checkpoint: {
            kind: 'note',
            snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
            version: checkpointVersion,
          },
          createdAt: 1,
        },
      ],
      nextCursor: null,
    })
    history.controller.requestRestore(resourceId, entryId)

    await expect(history.controller.confirmRestore(resourceId)).resolves.toEqual({
      status: 'failed',
    })
    currentVersion = laterVersion
    await expect(history.controller.confirmRestore(resourceId)).resolves.toMatchObject({
      status: 'restored',
    })
    expect(restore).toHaveBeenCalledTimes(2)
    expect(restore.mock.calls[0]![0].expectedVersion).toEqual(firstVersion)
    expect(restore.mock.calls[1]![0]).toEqual(restore.mock.calls[0]![0])
  })
})

function pendingNoteSource(): NoteSessionSource {
  return {
    get: () => ({ status: 'loading' }),
    subscribe: () => () => {},
    export: () => ({ status: 'loading' }),
    create: () => {
      throw new TypeError('Not used')
    },
    dispose: () => {},
  }
}

function pendingCanvasSource(): CanvasSessionSource {
  return {
    snapshots: { get: () => ({ status: 'loading' }), subscribe: () => () => {} },
    get: () => ({ status: 'loading' }),
    subscribe: () => () => {},
    export: () => ({ status: 'loading' }),
    create: () => {
      throw new TypeError('Not used')
    },
    dispose: () => {},
  }
}

function pendingMapSource(): MapSessionSource {
  return {
    snapshots: { get: () => ({ status: 'loading' }), subscribe: () => () => {} },
    get: () => ({ status: 'loading' }),
    subscribe: () => () => {},
    export: () => ({ status: 'loading' }),
    create: () => {
      throw new TypeError('Not used')
    },
    dispose: () => {},
  }
}
