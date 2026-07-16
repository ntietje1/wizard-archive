import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import {
  createCanvasDocumentDoc,
  getCanvasDocumentMaps,
  readCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  createLiveMapSessionSource,
  createLiveResourceContentSource,
} from '../live-resource-content-source'
import { createLiveCanvasSessionSource } from '../live-canvas-session-source'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type SaveCanvasArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}

describe('LiveResourceContentSource', () => {
  it('loads an unopened map once for native export without a subscription', async () => {
    const resourceId = testDomainId('resource', 'map-export')
    const watch = vi.fn(() => () => undefined)
    const source = createLiveResourceContentSource('map', {
      load: () =>
        Promise.resolve({
          status: 'ready',
          kind: 'map',
          content: { imageAssetId: null, layers: [], pins: [] },
          version,
        }),
      watch,
    })

    await expect(source.export(resourceId)).resolves.toMatchObject({
      status: 'ready',
      extension: 'wizardmap',
      mediaType: 'application/vnd.wizard-archive.map+json',
    })
    expect(watch).not.toHaveBeenCalled()
    source.dispose()
  })

  it('keeps loading, initializing, ready, unavailable, and integrity states distinct', () => {
    const resourceId = testDomainId('resource', 'file-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const unsubscribe = vi.fn()
    const listener = vi.fn()
    const source = createLiveResourceContentSource('file', {
      load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
      watch: (_resourceId, update) => {
        apply = update
        return unsubscribe
      },
    })

    expect(source.get(resourceId)).toEqual({ status: 'loading' })
    source.subscribe(resourceId, listener)
    const operationId = testDomainId('operation', 'file-copy')
    apply({ status: 'initializing', operationId })
    expect(source.get(resourceId)).toEqual({ status: 'initializing', operationId })

    const content = {
      assetId: null,
      classification: 'inert_file' as const,
      byteSize: 0,
      detectedFormat: null,
      extension: 'txt',
      mediaType: 'application/octet-stream',
      viewerUnavailableReason: 'empty_file' as const,
    }
    apply({ status: 'ready', kind: 'file', content, version })
    expect(source.get(resourceId)).toEqual({ status: 'ready', content, version })
    apply({ status: 'unavailable', reason: 'unauthorized' })
    expect(source.get(resourceId)).toEqual({ status: 'unavailable', reason: 'unauthorized' })
    apply({ status: 'integrity_error', issue: 'content_missing' })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_missing',
    })
    expect(listener).toHaveBeenCalledTimes(4)

    source.dispose()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('owns decoded canvas documents and rejects corrupt updates', () => {
    const campaignId = testDomainId('campaign', 'canvas-content-campaign')
    const resourceId = testDomainId('resource', 'canvas-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-content-member'),
      {
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save: vi.fn(),
        watch: (_resourceId, update) => {
          apply = update
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    const update = Y.encodeStateAsUpdate(new Y.Doc())

    const unsubscribe = source.subscribe(resourceId, () => {})
    apply({ status: 'ready', kind: 'canvas', update: update.buffer as ArrayBuffer, version })
    expect(source.get(resourceId)).toEqual({
      status: 'ready',
      session: expect.objectContaining({ document: expect.any(Y.Doc), version }),
    })
    apply({
      status: 'ready',
      kind: 'canvas',
      update: new Uint8Array([255]).buffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_corrupt',
    })

    unsubscribe()
    source.dispose()
  })

  it('flushes canonical canvas deltas and preserves the session across snapshots', async () => {
    const campaignId = testDomainId('campaign', 'canvas-save-campaign')
    const resourceId = testDomainId('resource', 'canvas-save-resource')
    const firstNodeId = testDomainId('canvasNode', 'canvas-first-node')
    const secondNodeId = testDomainId('canvasNode', 'canvas-second-node')
    const initialDocument = createCanvasDocumentDoc({ nodes: [], edges: [] })
    let persistedUpdate = Y.encodeStateAsUpdate(initialDocument).buffer as ArrayBuffer
    initialDocument.destroy()
    let persistedVersion = assertVersionStamp(version)
    let apply: (snapshot: Snapshot) => void = () => undefined
    const save = vi.fn(({ update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
      const persisted = new Y.Doc()
      Y.applyUpdate(persisted, new Uint8Array(persistedUpdate))
      Y.applyUpdate(persisted, new Uint8Array(update))
      persistedUpdate = Y.encodeStateAsUpdate(persisted).buffer as ArrayBuffer
      persisted.destroy()
      persistedVersion = assertVersionStamp({
        ...persistedVersion,
        revision: persistedVersion.revision + 1,
        digest: (persistedVersion.digest === version.digest ? 'b' : 'c').repeat(64),
      })
      return Promise.resolve({
        status: 'completed' as const,
        resourceId,
        update: persistedUpdate,
        version: persistedVersion,
      })
    })
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-save-member'),
      {
        create: vi.fn(),
        load: () =>
          Promise.resolve({
            status: 'ready' as const,
            kind: 'canvas' as const,
            update: persistedUpdate,
            version: persistedVersion,
          }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, update) => {
          apply = update
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    source.subscribe(resourceId, () => {})
    apply({ status: 'ready', kind: 'canvas', update: persistedUpdate, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready canvas')
    getCanvasDocumentMaps(ready.session.document).nodesMap.set(firstNodeId, {
      id: firstNodeId,
      type: 'text',
      position: { x: 10, y: 20 },
      data: {},
    })

    await expect(ready.session.flush()).resolves.toMatchObject({
      status: 'completed',
      version: { revision: 2 },
    })
    expect(save).toHaveBeenCalledOnce()
    apply({
      status: 'ready',
      kind: 'canvas',
      update: persistedUpdate,
      version: persistedVersion,
    })
    expect(source.get(resourceId)).toEqual(ready)

    const remoteDocument = new Y.Doc()
    Y.applyUpdate(remoteDocument, new Uint8Array(persistedUpdate))
    getCanvasDocumentMaps(remoteDocument).nodesMap.set(secondNodeId, {
      id: secondNodeId,
      type: 'text',
      position: { x: 30, y: 40 },
      data: {},
    })
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDocument).buffer as ArrayBuffer
    remoteDocument.destroy()
    const remoteVersion = { ...persistedVersion, revision: 3, digest: 'd'.repeat(64) }
    apply({ status: 'ready', kind: 'canvas', update: remoteUpdate, version: remoteVersion })

    const current = source.get(resourceId)
    expect(current).toEqual(ready)
    if (current.status !== 'ready') throw new Error('Expected ready canvas')
    expect(readCanvasDocumentContent(current.session.document).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstNodeId }),
        expect.objectContaining({ id: secondNodeId }),
      ]),
    )
    expect(current.session.version.revision).toBe(3)
    source.dispose()
  })

  it('rejects a completed kind-owned create with the wrong receipt identity', async () => {
    const campaignId = testDomainId('campaign', 'map-create-campaign')
    const resourceId = testDomainId('resource', 'map-create-resource')
    const operationId = testDomainId('operation', 'map-create-operation')
    const recording = { abandon: vi.fn(), completed: vi.fn() }
    const refresh = vi.fn()
    const source = createLiveMapSessionSource(
      campaignId,
      {
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        watch: () => () => undefined,
        create: () =>
          Promise.resolve({
            status: 'completed',
            receipt: {
              campaignId,
              operationId: testDomainId('operation', 'unexpected-operation'),
              result: { type: 'created', resourceId },
              postconditions: [],
            },
          }),
        refresh,
      },
      () => recording,
    )

    await expect(
      source.create({
        campaignId,
        operationId,
        command: {
          type: 'create',
          resourceId,
          kind: 'map',
          parentId: null,
          title: canonicalizeResourceTitle('Map'),
          icon: null,
          color: null,
        },
      }),
    ).resolves.toEqual({
      status: 'not_committed',
      retryable: false,
      reason: 'invalid_response',
    })
    expect(recording.abandon).toHaveBeenCalledOnce()
    expect(recording.completed).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    source.dispose()
  })
})
