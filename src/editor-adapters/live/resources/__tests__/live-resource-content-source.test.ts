import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import {
  canonicalizeCanvasDocumentContent,
  createCanvasDocumentDoc,
  readCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import type { CanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import { CANVAS_WORKLOAD_LIMITS } from '@wizard-archive/editor/canvas/workload'
import { testDomainId } from '../../../../../shared/test/domain-id'
import {
  createLiveMapSessionSource,
  createLiveResourceContentSource,
} from '../live-resource-content-source'
import { createLiveCanvasSessionSource } from '../live-canvas-session-source'
import { createYjsUpdateOutbox } from '../yjs-update-outbox'

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type SaveCanvasArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}

function applyCanvasContentUpdate(document: Y.Doc, content: CanvasDocumentContent): void {
  const update = createCanvasDocumentDoc(content)
  Y.applyUpdate(document, Y.encodeStateAsUpdate(update))
  update.destroy()
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

  it('owns decoded canvas documents and rejects corrupt or oversized updates', () => {
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
    apply({
      status: 'ready',
      kind: 'canvas',
      update: new Uint8Array(CANVAS_WORKLOAD_LIMITS.encodedBytes + 1).buffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_limit_exceeded',
    })

    unsubscribe()
    source.dispose()
  })

  it('preserves concurrent local and remote document updates through flush and snapshots', async () => {
    const campaignId = testDomainId('campaign', 'canvas-save-campaign')
    const resourceId = testDomainId('resource', 'canvas-save-resource')
    const firstNodeId = testDomainId('canvasNode', 'canvas-first-node')
    const secondNodeId = testDomainId('canvasNode', 'canvas-second-node')
    const thirdNodeId = testDomainId('canvasNode', 'canvas-third-node')
    const initialDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: firstNodeId,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          data: { backgroundColor: '#ffffff' },
        },
      ],
      edges: [],
    })
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
    applyCanvasContentUpdate(ready.session.document, {
      nodes: [{ id: secondNodeId, type: 'text', position: { x: 30, y: 40 }, data: {} }],
      edges: [],
    })

    const remoteDocument = new Y.Doc()
    Y.applyUpdate(remoteDocument, new Uint8Array(persistedUpdate))
    applyCanvasContentUpdate(remoteDocument, {
      nodes: [{ id: thirdNodeId, type: 'text', position: { x: 50, y: 60 }, data: {} }],
      edges: [],
    })
    persistedUpdate = Y.encodeStateAsUpdate(remoteDocument).buffer as ArrayBuffer
    remoteDocument.destroy()
    persistedVersion = assertVersionStamp({ ...version, revision: 2, digest: 'b'.repeat(64) })
    apply({
      status: 'ready',
      kind: 'canvas',
      update: persistedUpdate,
      version: persistedVersion,
    })

    await expect(ready.session.flush()).resolves.toMatchObject({
      status: 'completed',
      version: { revision: 3 },
    })
    expect(save).toHaveBeenCalledOnce()
    apply({
      status: 'ready',
      kind: 'canvas',
      update: persistedUpdate,
      version: persistedVersion,
    })
    expect(source.get(resourceId)).toEqual(ready)

    const current = source.get(resourceId)
    expect(current).toEqual(ready)
    if (current.status !== 'ready') throw new Error('Expected ready canvas')
    expect(readCanvasDocumentContent(current.session.document).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstNodeId }),
        expect.objectContaining({ id: secondNodeId }),
        expect.objectContaining({ id: thirdNodeId }),
      ]),
    )
    expect(readCanvasDocumentContent(current.session.document).nodes).toHaveLength(3)
    expect(current.session.version.revision).toBe(3)
    source.dispose()
  })

  it('recovers a pending canonical document update before the next flush', async () => {
    sessionStorage.clear()
    const campaignId = testDomainId('campaign', 'canvas-recovery-campaign')
    const memberId = testDomainId('campaignMember', 'canvas-recovery-member')
    const resourceId = testDomainId('resource', 'canvas-recovery-resource')
    const localId = testDomainId('canvasNode', 'canvas-recovery-local')
    const remoteId = testDomainId('canvasNode', 'canvas-recovery-remote')
    const laterId = testDomainId('canvasNode', 'canvas-recovery-later')
    const local = createCanvasDocumentDoc({
      nodes: [{ id: localId, type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })
    const server = createCanvasDocumentDoc({
      nodes: [{ id: remoteId, type: 'text', position: { x: 10, y: 0 }, data: {} }],
      edges: [],
    })
    let persistedUpdate = Uint8Array.from(Y.encodeStateAsUpdate(server)).buffer
    let persistedVersion = assertVersionStamp({ ...version, revision: 2, digest: 'b'.repeat(64) })
    const outbox = createYjsUpdateOutbox('canvas', campaignId, resourceId, memberId)
    expect(outbox.merge(Y.encodeStateAsUpdate(local))).toEqual({ status: 'accepted' })
    let apply: (snapshot: Snapshot) => void = () => undefined
    const save = vi.fn(({ update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
      const merged = new Y.Doc()
      Y.applyUpdate(merged, new Uint8Array(persistedUpdate))
      Y.applyUpdate(merged, new Uint8Array(update))
      if (!canonicalizeCanvasDocumentContent(merged)) throw new Error('Invalid canvas merge')
      persistedUpdate = Uint8Array.from(Y.encodeStateAsUpdate(merged)).buffer
      merged.destroy()
      persistedVersion = assertVersionStamp({
        ...persistedVersion,
        revision: persistedVersion.revision + 1,
        digest: 'c'.repeat(64),
      })
      return Promise.resolve({
        status: 'completed',
        resourceId,
        update: persistedUpdate,
        version: persistedVersion,
      })
    })
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      {
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, listener) => {
          apply = listener
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    source.subscribe(resourceId, () => {})
    apply({
      status: 'ready',
      kind: 'canvas',
      update: persistedUpdate,
      version: persistedVersion,
    })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected recovered canvas session')
    expect(readCanvasDocumentContent(ready.session.document).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: localId }),
        expect.objectContaining({ id: remoteId }),
      ]),
    )
    applyCanvasContentUpdate(ready.session.document, {
      nodes: [{ id: laterId, type: 'text', position: { x: 20, y: 0 }, data: {} }],
      edges: [],
    })

    await expect(ready.session.flush()).resolves.toMatchObject({ status: 'completed' })
    expect(save).toHaveBeenCalledOnce()
    expect(outbox.load()).toEqual({ status: 'available', update: null })
    const persisted = new Y.Doc()
    Y.applyUpdate(persisted, new Uint8Array(persistedUpdate))
    const persistedContent = readCanvasDocumentContent(persisted)
    const sessionContent = readCanvasDocumentContent(ready.session.document)
    expect(persistedContent.nodes).toHaveLength(3)
    expect(persistedContent.nodes).toEqual(expect.arrayContaining(sessionContent.nodes))
    expect(persistedContent.edges).toEqual([])
    expect(sessionContent.edges).toEqual([])

    persisted.destroy()
    source.dispose()
    server.destroy()
    local.destroy()
  })

  it('retries a transient canvas provider failure without corrupting the session', async () => {
    vi.useFakeTimers()
    try {
      sessionStorage.clear()
      const campaignId = testDomainId('campaign', 'canvas-retry-campaign')
      const memberId = testDomainId('campaignMember', 'canvas-retry-member')
      const resourceId = testDomainId('resource', 'canvas-retry-resource')
      const nodeId = testDomainId('canvasNode', 'canvas-retry-node')
      const initialDocument = createCanvasDocumentDoc({ nodes: [], edges: [] })
      const initialUpdate = Y.encodeStateAsUpdate(initialDocument).buffer as ArrayBuffer
      initialDocument.destroy()
      let apply: (snapshot: Snapshot) => void = () => undefined
      let attempt = 0
      const save = vi.fn(({ update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
        attempt += 1
        if (attempt === 1) return Promise.reject(new Error('provider unavailable'))
        return Promise.resolve({
          status: 'completed',
          resourceId,
          update,
          version: assertVersionStamp({ ...version, revision: 2, digest: 'b'.repeat(64) }),
        })
      })
      const source = createLiveCanvasSessionSource(
        campaignId,
        memberId,
        {
          create: vi.fn(),
          load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
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
      apply({ status: 'ready', kind: 'canvas', update: initialUpdate, version })
      const ready = source.get(resourceId)
      if (ready.status !== 'ready') throw new Error('Expected ready canvas')
      applyCanvasContentUpdate(ready.session.document, {
        nodes: [{ id: nodeId, type: 'text', position: { x: 10, y: 20 }, data: {} }],
        edges: [],
      })

      const drain = ready.session.flush()
      await vi.advanceTimersByTimeAsync(0)
      expect(save).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(250)

      await expect(drain).resolves.toMatchObject({ status: 'completed' })
      expect(save).toHaveBeenCalledTimes(2)
      expect(source.get(resourceId)).toEqual(ready)
      source.dispose()
      await vi.advanceTimersByTimeAsync(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports canvas outbox storage denial as scope unavailability', () => {
    sessionStorage.clear()
    const campaignId = testDomainId('campaign', 'canvas-storage-campaign')
    const resourceId = testDomainId('resource', 'canvas-storage-resource')
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const update = Y.encodeStateAsUpdate(document).buffer as ArrayBuffer
    document.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-storage-member'),
      {
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save: vi.fn(),
        watch: (_resourceId, next) => {
          apply = next
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    source.subscribe(resourceId, () => {})
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('access denied', 'SecurityError')
    })

    try {
      apply({ status: 'ready', kind: 'canvas', update, version })
      expect(source.get(resourceId)).toEqual({
        status: 'unavailable',
        reason: 'scope_unavailable',
      })
    } finally {
      getItem.mockRestore()
      source.dispose()
    }
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
