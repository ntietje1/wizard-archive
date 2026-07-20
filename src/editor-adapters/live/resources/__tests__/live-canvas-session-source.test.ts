import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  advanceContentGeneration,
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import {
  canonicalizeCanvasDocumentContent,
  createCanvasDocumentDoc,
  readCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import type { CanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import { CANVAS_WORKLOAD_LIMITS } from '@wizard-archive/editor/canvas/workload'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { createLiveCanvasSessionSource as createSource } from '../live-canvas-session-source'
import { createYjsUpdateOutbox } from '../yjs-update-outbox'
import { createLiveResourceContentAuthorityFixture } from './live-resource-content-authority.fixture'

function createLiveCanvasSessionSource(
  campaign: Parameters<typeof createSource>[0],
  member: Parameters<typeof createSource>[1],
  collaborationUser: Parameters<typeof createSource>[2],
  backend: Omit<Parameters<typeof createSource>[3], 'reapply'> &
    Partial<Pick<Parameters<typeof createSource>[3], 'reapply'>>,
  beginUndo: Parameters<typeof createSource>[4],
  readonly = false,
) {
  return createSource(
    campaign,
    member,
    collaborationUser,
    {
      reapply: () => Promise.resolve({ status: 'rejected', reason: 'resource_unavailable' }),
      ...backend,
    },
    beginUndo,
    createLiveResourceContentAuthorityFixture(!readonly).authority,
  )
}

type Snapshot = FunctionReturnType<typeof api.resources.queries.loadCanvasContent>
type SaveCanvasArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>

const version = {
  scheme: 'authoritative-revision-v1' as const,
  revision: 1,
  digest: 'a'.repeat(64),
}
const generation = INITIAL_CONTENT_GENERATION
const replacementGeneration = advanceContentGeneration(generation)

const collaborationUser = { name: 'Canvas collaborator', color: '#61afef' }

function presenceBackend() {
  return {
    heartbeatPresence: () =>
      Promise.resolve({
        status: 'active' as const,
        roomToken: 'room-token',
        sessionToken: 'session-token',
      }),
    updatePresence: () => Promise.resolve({ status: 'active' as const }),
    disconnectPresence: () => Promise.resolve({ status: 'released' as const }),
    watchPresence: () => () => undefined,
  }
}

function applyCanvasContentUpdate(document: Y.Doc, content: CanvasDocumentContent): void {
  const update = createCanvasDocumentDoc(content)
  Y.applyUpdate(document, Y.encodeStateAsUpdate(update))
  update.destroy()
}

describe('LiveCanvasSessionSource', () => {
  it('does not expose persistence or presence paths from a readonly projection', async () => {
    const campaignId = testDomainId('campaign', 'readonly-canvas-campaign')
    const memberId = testDomainId('campaignMember', 'readonly-canvas-member')
    const resourceId = testDomainId('resource', 'readonly-canvas-resource')
    const firstNodeId = testDomainId('canvasNode', 'readonly-canvas-first-node')
    const secondNodeId = testDomainId('canvasNode', 'readonly-canvas-second-node')
    const document = createCanvasDocumentDoc({
      nodes: [{ id: firstNodeId, type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    })
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    document.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    const save = vi.fn()
    const heartbeatPresence = vi.fn()
    const watchPresence = vi.fn(() => () => undefined)
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
        heartbeatPresence,
        watchPresence,
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        reapply: () =>
          Promise.resolve({
            status: 'rejected' as const,
            reason: 'resource_unavailable' as const,
          }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, updateSnapshot) => {
          apply = updateSnapshot
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
      true,
    )
    source.subscribe(resourceId, () => {})
    apply({ status: 'ready', generation, update, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new TypeError('Expected readonly projection')

    applyCanvasContentUpdate(ready.session.document, {
      nodes: [{ id: firstNodeId, type: 'text', position: { x: 10, y: 10 }, data: {} }],
      edges: [],
    })
    const replacement = createCanvasDocumentDoc({
      nodes: [{ id: secondNodeId, type: 'text', position: { x: 20, y: 20 }, data: {} }],
      edges: [],
    })
    const replacementUpdate = Uint8Array.from(Y.encodeStateAsUpdate(replacement)).buffer
    replacement.destroy()
    const replacementVersion = {
      ...version,
      revision: 2,
      digest: 'b'.repeat(64),
    }
    apply({
      status: 'ready',
      generation: replacementGeneration,
      update: replacementUpdate,
      version: replacementVersion,
    })
    const replaced = source.get(resourceId)
    if (replaced.status !== 'ready') throw new TypeError('Expected replacement projection')

    expect(replaced.session).toBe(ready.session)
    expect(readCanvasDocumentContent(replaced.session.document).nodes).toEqual([
      expect.objectContaining({ id: secondNodeId }),
    ])
    await expect(ready.session.flush()).resolves.toEqual({
      status: 'completed',
      version: replacementVersion,
    })
    expect(save).not.toHaveBeenCalled()
    expect(heartbeatPresence).not.toHaveBeenCalled()
    expect(watchPresence).not.toHaveBeenCalled()
    source.dispose()
  })

  it('replaces an editable document when its authoritative generation advances', () => {
    const campaignId = testDomainId('campaign', 'canvas-restore-campaign')
    const memberId = testDomainId('campaignMember', 'canvas-restore-member')
    const resourceId = testDomainId('resource', 'canvas-restore-resource')
    const firstNodeId = testDomainId('canvasNode', 'canvas-restore-first')
    const secondNodeId = testDomainId('canvasNode', 'canvas-restore-second')
    const first = createCanvasDocumentDoc({
      nodes: [{ id: firstNodeId, type: 'text', position: { x: 10, y: 10 }, data: {} }],
      edges: [],
    })
    const second = createCanvasDocumentDoc({
      nodes: [{ id: secondNodeId, type: 'text', position: { x: 20, y: 20 }, data: {} }],
      edges: [],
    })
    const firstUpdate = Uint8Array.from(Y.encodeStateAsUpdate(first)).buffer
    const secondUpdate = Uint8Array.from(Y.encodeStateAsUpdate(second)).buffer
    first.destroy()
    second.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    const save = vi.fn()
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, updateSnapshot) => {
          apply = updateSnapshot
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    source.subscribe(resourceId, () => {})
    apply({ status: 'ready', generation, update: firstUpdate, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new TypeError('Expected editable canvas')

    apply({
      status: 'ready',
      generation: replacementGeneration,
      update: secondUpdate,
      version: { ...version, revision: 2, digest: 'b'.repeat(64) },
    })
    const replaced = source.get(resourceId)
    if (replaced.status !== 'ready') throw new TypeError('Expected replaced canvas')
    expect(replaced.session).toBe(ready.session)
    expect(readCanvasDocumentContent(replaced.session.document).nodes).toEqual([
      expect.objectContaining({ id: secondNodeId }),
    ])
    expect(save).not.toHaveBeenCalled()
    source.dispose()
  })

  it('keeps an in-flight generation-scoped update after restore wins the race', async () => {
    sessionStorage.clear()
    const campaignId = testDomainId('campaign', 'canvas-generation-race-campaign')
    const memberId = testDomainId('campaignMember', 'canvas-generation-race-member')
    const resourceId = testDomainId('resource', 'canvas-generation-race-resource')
    const localNodeId = testDomainId('canvasNode', 'canvas-generation-race-local')
    const restoredNodeId = testDomainId('canvasNode', 'canvas-generation-race-restored')
    const initialDocument = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const restoredDocument = createCanvasDocumentDoc({
      nodes: [
        {
          id: restoredNodeId,
          type: 'text',
          position: { x: 20, y: 20 },
          data: {},
        },
      ],
      edges: [],
    })
    const initialUpdate = Uint8Array.from(Y.encodeStateAsUpdate(initialDocument)).buffer
    const restoredUpdate = Uint8Array.from(Y.encodeStateAsUpdate(restoredDocument)).buffer
    initialDocument.destroy()
    restoredDocument.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    let settleSave:
      | ((result: Extract<SaveCanvasResult, { status: 'rejected' }>) => void)
      | undefined
    const save = vi.fn(
      (args: SaveCanvasArgs): Promise<SaveCanvasResult> =>
        new Promise((resolve) => {
          expect(args.generation).toBe(generation)
          settleSave = resolve
        }),
    )
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, updateSnapshot) => {
          apply = updateSnapshot
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )
    source.subscribe(resourceId, () => {})
    apply({ status: 'ready', generation, update: initialUpdate, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new TypeError('Expected editable canvas')
    applyCanvasContentUpdate(ready.session.document, {
      nodes: [
        {
          id: localNodeId,
          type: 'text',
          position: { x: 10, y: 10 },
          data: {},
        },
      ],
      edges: [],
    })
    const drain = ready.session.flush()
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce())

    apply({
      status: 'ready',
      generation: replacementGeneration,
      update: restoredUpdate,
      version: { ...version, revision: 2, digest: 'b'.repeat(64) },
    })
    expect(source.get(resourceId)).toMatchObject({
      status: 'recovery_required',
      issue: 'version_mismatch',
    })
    const outbox = createYjsUpdateOutbox('canvas', campaignId, resourceId, memberId)
    const stored = outbox.load()
    expect(stored).toMatchObject({
      status: 'available',
      entry: { generation, state: 'recovery' },
    })
    if (stored.status !== 'available' || !stored.entry) {
      throw new TypeError('Expected canvas recovery artifact')
    }
    const recoveredDocument = new Y.Doc()
    Y.applyUpdate(recoveredDocument, stored.entry.update)
    expect(readCanvasDocumentContent(recoveredDocument).nodes).toEqual([
      expect.objectContaining({ id: localNodeId }),
    ])
    recoveredDocument.destroy()

    settleSave?.({
      status: 'rejected',
      reason: 'content_generation_conflict',
    })
    await expect(drain).resolves.toEqual({
      status: 'rejected',
      reason: 'content_generation_conflict',
    })
    expect(outbox.load()).toMatchObject({
      status: 'available',
      entry: { generation, state: 'recovery' },
    })
    source.dispose()
  })

  it('opens and closes collaborative canvas sessions with authoritative edit permission', async () => {
    const campaignId = testDomainId('campaign', 'canvas-authority-campaign')
    const memberId = testDomainId('campaignMember', 'canvas-authority-member')
    const resourceId = testDomainId('resource', 'canvas-authority-resource')
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    document.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    const heartbeatPresence = vi.fn(() =>
      Promise.resolve({
        status: 'active' as const,
        roomToken: 'room-token',
        sessionToken: 'session-token',
      }),
    )
    const save = vi.fn()
    const fixture = createLiveResourceContentAuthorityFixture(false)
    const source = createSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
        heartbeatPresence,
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        reapply: () =>
          Promise.resolve({
            status: 'rejected' as const,
            reason: 'resource_unavailable' as const,
          }),
        refresh: vi.fn(),
        save,
        watch: (_resourceId, updateSnapshot) => {
          apply = updateSnapshot
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
      fixture.authority,
    )
    source.subscribe(resourceId, () => {})
    apply({ status: 'ready', generation, update, version })
    const readonly = source.get(resourceId)
    if (readonly.status !== 'ready') throw new TypeError('Expected readonly canvas')

    fixture.setCanEdit(true)
    const editable = source.get(resourceId)
    if (editable.status !== 'ready') throw new TypeError('Expected editable canvas')
    expect(editable.session).not.toBe(readonly.session)
    expect(editable.session.document).toBe(readonly.session.document)
    expect(editable.session.collaboration).toBe(readonly.session.collaboration)
    await vi.waitFor(() => expect(heartbeatPresence).toHaveBeenCalled())

    fixture.setCanEdit(false)
    const restoredReadonly = source.get(resourceId)
    if (restoredReadonly.status !== 'ready')
      throw new TypeError('Expected restored readonly canvas')
    expect(restoredReadonly.session).not.toBe(editable.session)
    expect(restoredReadonly.session.document).toBe(editable.session.document)
    expect(restoredReadonly.session.collaboration).toBe(editable.session.collaboration)
    await expect(restoredReadonly.session.flush()).resolves.toMatchObject({ status: 'completed' })
    expect(save).not.toHaveBeenCalled()
    source.dispose()
  })

  it('loads an unopened canvas once for native export without a subscription', async () => {
    sessionStorage.clear()
    const campaignId = testDomainId('campaign', 'canvas-export-campaign')
    const resourceId = testDomainId('resource', 'canvas-export-resource')
    const document = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    document.destroy()
    const watch = vi.fn(() => () => undefined)
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-export-member'),
      collaborationUser,
      {
        ...presenceBackend(),
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'ready', generation, update, version }),
        refresh: vi.fn(),
        save: vi.fn(),
        watch,
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    await expect(source.export(resourceId)).resolves.toMatchObject({
      status: 'ready',
      extension: 'wizardcanvas',
      mediaType: 'application/vnd.wizard-archive.canvas',
    })
    expect(watch).not.toHaveBeenCalled()
    source.dispose()
  })

  it('owns decoded canvas documents, collaboration, and rejects invalid updates', async () => {
    const campaignId = testDomainId('campaign', 'canvas-content-campaign')
    const resourceId = testDomainId('resource', 'canvas-content')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const heartbeatPresence = vi.fn(() =>
      Promise.resolve({
        status: 'active' as const,
        roomToken: 'room-token',
        sessionToken: 'session-token',
      }),
    )
    const disconnectPresence = vi.fn(() => Promise.resolve({ status: 'released' as const }))
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-content-member'),
      collaborationUser,
      {
        ...presenceBackend(),
        heartbeatPresence,
        disconnectPresence,
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
    apply({
      status: 'ready',
      generation,
      update: update.buffer as ArrayBuffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'ready',
      session: expect.objectContaining({
        collaboration: expect.objectContaining({ user: collaborationUser }),
        document: expect.any(Y.Doc),
        version,
      }),
    })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready canvas session')
    await ready.session.flush()
    expect(heartbeatPresence).toHaveBeenCalledOnce()
    apply({
      status: 'ready',
      generation,
      update: new Uint8Array([255]).buffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_corrupt',
    })
    apply({
      status: 'ready',
      generation,
      update: new Uint8Array(CANVAS_WORKLOAD_LIMITS.encodedBytes + 1).buffer,
      version,
    })
    expect(source.get(resourceId)).toEqual({
      status: 'integrity_error',
      issue: 'content_limit_exceeded',
    })

    unsubscribe()
    source.dispose()
    await vi.waitFor(() => expect(disconnectPresence).toHaveBeenCalledOnce())
  })

  it('projects readonly canvas previews without creating awareness or a mutable session', () => {
    const campaignId = testDomainId('campaign', 'canvas-preview-campaign')
    const resourceId = testDomainId('resource', 'canvas-preview-resource')
    const nodeId = testDomainId('canvasNode', 'canvas-preview-node')
    let apply: (snapshot: Snapshot) => void = () => undefined
    const heartbeatPresence = vi.fn(() =>
      Promise.resolve({
        status: 'active' as const,
        roomToken: 'room-token',
        sessionToken: 'session-token',
      }),
    )
    const document = createCanvasDocumentDoc({
      nodes: [{ id: nodeId, type: 'text', position: { x: 10, y: 20 }, data: {} }],
      edges: [],
    })
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    document.destroy()
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-preview-member'),
      collaborationUser,
      {
        ...presenceBackend(),
        heartbeatPresence,
        create: vi.fn(),
        load: () => Promise.resolve({ status: 'integrity_error', issue: 'content_missing' }),
        refresh: vi.fn(),
        save: vi.fn(),
        watch: (_resourceId, updatePreview) => {
          apply = updatePreview
          return () => undefined
        },
      },
      () => ({ abandon: vi.fn(), completed: vi.fn() }),
    )

    source.previews.subscribe(resourceId, () => {})
    apply({ status: 'ready', generation, update, version })

    const preview = source.previews.get(resourceId)
    expect(preview.status).toBe('ready')
    if (preview.status !== 'ready') throw new Error('Expected ready canvas preview')
    expect(readCanvasDocumentContent(preview.document).nodes).toEqual([
      expect.objectContaining({ id: nodeId }),
    ])
    expect(source.get(resourceId)).toEqual({ status: 'loading' })
    expect(heartbeatPresence).not.toHaveBeenCalled()

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
    const save = vi.fn(
      ({ generation: observedGeneration, update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
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
          generation: assertContentGeneration(observedGeneration),
          resourceId,
          update: persistedUpdate,
          version: persistedVersion,
        })
      },
    )
    const source = createLiveCanvasSessionSource(
      campaignId,
      testDomainId('campaignMember', 'canvas-save-member'),
      collaborationUser,
      {
        ...presenceBackend(),
        create: vi.fn(),
        load: () =>
          Promise.resolve({
            status: 'ready' as const,
            generation,
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
    apply({ status: 'ready', generation, update: persistedUpdate, version })
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
      generation,
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
      generation,
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
    expect(outbox.merge(generation, Y.encodeStateAsUpdate(local))).toEqual({
      status: 'accepted',
    })
    let apply: (snapshot: Snapshot) => void = () => undefined
    const save = vi.fn(
      ({ generation: observedGeneration, update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
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
          generation: assertContentGeneration(observedGeneration),
          resourceId,
          update: persistedUpdate,
          version: persistedVersion,
        })
      },
    )
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
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
      generation,
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
    expect(outbox.load()).toEqual({ status: 'available', entry: null })
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
      const save = vi.fn(
        ({ generation: observedGeneration, update }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
          attempt += 1
          if (attempt === 1) return Promise.reject(new Error('provider unavailable'))
          return Promise.resolve({
            status: 'completed',
            generation: assertContentGeneration(observedGeneration),
            resourceId,
            update,
            version: assertVersionStamp({ ...version, revision: 2, digest: 'b'.repeat(64) }),
          })
        },
      )
      const source = createLiveCanvasSessionSource(
        campaignId,
        memberId,
        collaborationUser,
        {
          ...presenceBackend(),
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
      apply({ status: 'ready', generation, update: initialUpdate, version })
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

  it('keeps a canvas drain and disposal open through final outbox settlement', async () => {
    sessionStorage.clear()
    const campaignId = testDomainId('campaign', 'canvas-settlement-campaign')
    const memberId = testDomainId('campaignMember', 'canvas-settlement-member')
    const resourceId = testDomainId('resource', 'canvas-settlement-resource')
    const firstNodeId = testDomainId('canvasNode', 'canvas-settlement-first-node')
    const finalNodeId = testDomainId('canvasNode', 'canvas-settlement-final-node')
    const initialDocument = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const initialUpdate = Y.encodeStateAsUpdate(initialDocument).buffer as ArrayBuffer
    initialDocument.destroy()
    let apply: (snapshot: Snapshot) => void = () => undefined
    let releaseFinalSave: (() => void) | undefined
    let saveAttempt = 0
    const save = vi.fn(
      async ({
        generation: observedGeneration,
        update,
      }: SaveCanvasArgs): Promise<SaveCanvasResult> => {
        saveAttempt += 1
        if (saveAttempt === 2) {
          await new Promise<void>((resolve) => {
            releaseFinalSave = resolve
          })
        }
        return {
          status: 'completed',
          generation: assertContentGeneration(observedGeneration),
          resourceId,
          update,
          version: assertVersionStamp({
            ...version,
            revision: version.revision + saveAttempt,
            digest: String(saveAttempt).repeat(64),
          }),
        }
      },
    )
    const source = createLiveCanvasSessionSource(
      campaignId,
      memberId,
      collaborationUser,
      {
        ...presenceBackend(),
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
    apply({ status: 'ready', generation, update: initialUpdate, version })
    const ready = source.get(resourceId)
    if (ready.status !== 'ready') throw new Error('Expected ready canvas')
    let destroyed = false
    ready.session.document.on('destroy', () => {
      destroyed = true
    })
    const removeItem = sessionStorage.removeItem.bind(sessionStorage)
    let queueSettlingUpdate = true
    let outboxKey: string | null = null
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      removeItem(key)
      if (!queueSettlingUpdate || !key.startsWith('wizard-archive:canvas-update-outbox:v3:')) {
        return
      }
      outboxKey = key
      queueSettlingUpdate = false
      queueMicrotask(() =>
        applyCanvasContentUpdate(ready.session.document, {
          nodes: [{ id: finalNodeId, type: 'text', position: { x: 30, y: 40 }, data: {} }],
          edges: [],
        }),
      )
    })

    try {
      applyCanvasContentUpdate(ready.session.document, {
        nodes: [{ id: firstNodeId, type: 'text', position: { x: 10, y: 20 }, data: {} }],
        edges: [],
      })
      let drainSettled = false
      const drain = ready.session.flush().finally(() => {
        drainSettled = true
      })
      await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
      expect(readCanvasDocumentContent(ready.session.document).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: firstNodeId }),
          expect.objectContaining({ id: finalNodeId }),
        ]),
      )
      source.dispose()
      await Promise.resolve()
      expect(drainSettled).toBe(false)
      expect(destroyed).toBe(false)
      releaseFinalSave?.()
      const result = await drain
      const finalSave = await save.mock.results[1]?.value
      expect(finalSave?.status).toBe('completed')
      if (finalSave?.status !== 'completed') throw new Error('Expected final save')
      expect(result).toEqual({ status: 'completed', version: finalSave.version })
      await vi.waitFor(() => expect(destroyed).toBe(true))
      expect(outboxKey).not.toBeNull()
      expect(sessionStorage.getItem(outboxKey!)).toBeNull()
    } finally {
      removeItemSpy.mockRestore()
      source.dispose()
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
      collaborationUser,
      {
        ...presenceBackend(),
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
      apply({ status: 'ready', generation, update, version })
      expect(source.get(resourceId)).toEqual({
        status: 'unavailable',
        reason: 'scope_unavailable',
      })
    } finally {
      getItem.mockRestore()
      source.dispose()
    }
  })
})
