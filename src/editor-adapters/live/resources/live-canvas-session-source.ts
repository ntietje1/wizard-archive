import * as Y from 'yjs'
import {
  canonicalizeCanvasDocumentContent,
  parseCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import { encodeWizardCanvasDocument } from '@wizard-archive/editor/canvas/native-document'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type {
  CanvasSession,
  CanvasPreviewState,
  CanvasSessionSource,
  CanvasSessionState,
  CollaborationUser,
  ContentExportResult,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { createResourceWatchStore } from './resource-watch-store'
import { createLiveFixedContentResource } from './live-resource-content-source'
import type { LiveFixedContentBackend } from './live-resource-content-source'
import {
  createBackendYjsPersistence,
  failedYjsSessionState,
  YjsUpdateOutboxUnavailableError,
} from './live-yjs-document-session'
import type { RejectedYjsSave, YjsVersionDecision } from './live-yjs-document-session'
import { createYjsUpdateOutbox } from './yjs-update-outbox'
import { liveContentPendingState } from './live-content-pending-state'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import type { LiveResourceAwarenessBackend } from './live-resource-awareness'
import { createLiveCollaborativeYjsSession } from './live-collaborative-yjs-session'

type CanvasSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type SaveCanvasContentArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasContentResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>

type LiveCanvasBackend = LiveFixedContentBackend &
  LiveResourceAwarenessBackend &
  Readonly<{
    save(args: SaveCanvasContentArgs): Promise<SaveCanvasContentResult>
  }>

type CanvasStore = ReturnType<typeof createResourceWatchStore<CanvasSnapshot, CanvasSessionState>>
type CanvasPreviewStore = ReturnType<
  typeof createResourceWatchStore<CanvasSnapshot, CanvasPreviewState>
>

class LiveCanvasSession implements CanvasSession {
  readonly #liveAwareness: ReturnType<typeof createLiveCollaborativeYjsSession>['awareness']
  readonly #session: ReturnType<typeof createLiveCollaborativeYjsSession>['session']

  constructor(
    readonly document: Y.Doc,
    version: CanvasSession['version'],
    campaignId: CampaignId,
    resourceId: ResourceId,
    memberId: CampaignMemberId,
    user: CollaborationUser,
    backend: LiveCanvasBackend,
    changed: () => void,
    failed: (result: RejectedYjsSave) => void,
  ) {
    const collaborative = createLiveCollaborativeYjsSession({
      awarenessBackend: backend,
      document,
      version,
      resourceId,
      memberId,
      user,
      outbox: createYjsUpdateOutbox('canvas', campaignId, resourceId, memberId),
      canonicalize: (canvas, origin) => {
        if (parseCanvasDocumentContent(canvas)) return 'unchanged'
        return canonicalizeCanvasDocumentContent(canvas, origin) ? 'changed' : 'invalid'
      },
      persist: createBackendYjsPersistence(campaignId, resourceId, (args) => backend.save(args)),
      changed,
      failed,
    })
    this.#liveAwareness = collaborative.awareness
    this.#session = collaborative.session
  }

  get version() {
    return this.#session.version
  }

  get awareness() {
    return this.#liveAwareness.awareness
  }

  get collaboration() {
    return this.#liveAwareness.collaboration
  }

  apply(update: ArrayBuffer, version: CanvasSession['version']): YjsVersionDecision {
    return this.#session.apply(update, version)
  }

  readonly flush = () => this.#session.flush()

  dispose(): void {
    this.#session.dispose()
  }
}

class LiveCanvasSessionSource implements CanvasSessionSource {
  readonly #store: CanvasStore
  readonly #previewStore: CanvasPreviewStore
  readonly #previewDocuments = new Map<ResourceId, Y.Doc>()
  readonly #sessions = new Map<ResourceId, LiveCanvasSession>()
  readonly previews = {
    get: (resourceId: ResourceId) => this.#previewStore.get(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      this.#previewStore.subscribe(resourceId, listener),
  }

  constructor(
    private readonly campaignId: CampaignId,
    private readonly memberId: CampaignMemberId,
    private readonly user: CollaborationUser,
    private readonly backend: LiveCanvasBackend,
    private readonly beginCreate: () => ResourceHistoryRecording,
  ) {
    this.#store = createResourceWatchStore<CanvasSnapshot, CanvasSessionState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
    this.#previewStore = createResourceWatchStore<CanvasSnapshot, CanvasPreviewState>(
      backend.watch,
      (resourceId, snapshot) => this.#applyPreview(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): CanvasSessionState {
    return this.#store.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  async export(resourceId: ResourceId): Promise<ContentExportResult> {
    this.#apply(resourceId, await this.backend.load(resourceId))
    const state = this.get(resourceId)
    if (state.status !== 'ready') {
      return state.status === 'initializing' ? { status: 'loading' } : state
    }
    return {
      status: 'ready',
      bytes: encodeWizardCanvasDocument(state.session.document),
      extension: 'wizardcanvas',
      mediaType: 'application/vnd.wizard-archive.canvas',
    }
  }

  create: CanvasSessionSource['create'] = (envelope) =>
    createLiveFixedContentResource(this.campaignId, envelope, this.backend, this.beginCreate)

  dispose(): void {
    this.#store.dispose()
    this.#previewStore.dispose()
    for (const session of this.#sessions.values()) session.dispose()
    for (const document of this.#previewDocuments.values()) document.destroy()
    this.#sessions.clear()
    this.#previewDocuments.clear()
  }

  #apply(resourceId: ResourceId, snapshot: CanvasSnapshot): void {
    const decoded = decodeCanvasPreviewSnapshot(snapshot)
    if (decoded.status !== 'ready') {
      this.#replaceState(resourceId, decoded)
      return
    }
    const { document, version } = decoded

    const existing = this.#sessions.get(resourceId)
    if (existing) {
      const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
      document.destroy()
      existing.apply(update, version)
      return
    }
    let session: LiveCanvasSession
    try {
      session = new LiveCanvasSession(
        document,
        version,
        this.campaignId,
        resourceId,
        this.memberId,
        this.user,
        this.backend,
        () => this.#store.set(resourceId, { status: 'ready', session }),
        (result) => this.#fail(resourceId, session, result),
      )
    } catch (error) {
      document.destroy()
      this.#store.set(
        resourceId,
        error instanceof YjsUpdateOutboxUnavailableError
          ? { status: 'unavailable', reason: 'scope_unavailable' }
          : { status: 'integrity_error', issue: 'content_corrupt' },
      )
      return
    }
    this.#sessions.set(resourceId, session)
    this.#store.set(resourceId, { status: 'ready', session })
  }

  #applyPreview(resourceId: ResourceId, snapshot: CanvasSnapshot): void {
    this.#replacePreview(resourceId, decodeCanvasPreviewSnapshot(snapshot))
  }

  #fail(resourceId: ResourceId, session: LiveCanvasSession, result: RejectedYjsSave): void {
    if (this.#sessions.get(resourceId) !== session) return
    this.#sessions.delete(resourceId)
    this.#store.set(resourceId, failedYjsSessionState(result))
  }

  #replaceState(resourceId: ResourceId, state: CanvasSessionState): void {
    this.#sessions.get(resourceId)?.dispose()
    this.#sessions.delete(resourceId)
    this.#store.set(resourceId, state)
  }

  #replacePreview(resourceId: ResourceId, state: CanvasPreviewState): void {
    this.#previewDocuments.get(resourceId)?.destroy()
    if (state.status === 'ready') this.#previewDocuments.set(resourceId, state.document)
    else this.#previewDocuments.delete(resourceId)
    this.#previewStore.set(resourceId, state)
  }
}

function decodeCanvasPreviewSnapshot(snapshot: CanvasSnapshot): CanvasPreviewState {
  if (snapshot.status !== 'ready') {
    const pending = liveContentPendingState(snapshot)
    return pending.status === 'initializing' ? { status: 'loading' } : pending
  }
  if (snapshot.kind !== 'canvas') {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }

  const document = new Y.Doc()
  try {
    const version = assertVersionStamp(snapshot.version)
    if (!canvasEncodedBytesWithinWorkload(snapshot.update)) {
      document.destroy()
      return { status: 'integrity_error', issue: 'content_limit_exceeded' }
    }
    Y.applyUpdate(document, new Uint8Array(snapshot.update))
    if (!parseCanvasDocumentContent(document)) throw new TypeError('Invalid canvas document')
    return { status: 'ready', document, version }
  } catch {
    document.destroy()
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
}

export function createLiveCanvasSessionSource(
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveCanvasBackend,
  beginCreate: () => ResourceHistoryRecording,
): CanvasSessionSource {
  return new LiveCanvasSessionSource(campaignId, memberId, user, backend, beginCreate)
}
