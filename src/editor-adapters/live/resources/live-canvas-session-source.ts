import * as Y from 'yjs'
import { parseCanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import { encodeWizardCanvasDocument } from '@wizard-archive/editor/canvas/native-document'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type {
  CanvasSession,
  CanvasSessionSource,
  CanvasSessionState,
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
  createLiveYjsDocumentSession,
  failedYjsSessionState,
  YjsUpdateOutboxUnavailableError,
} from './live-yjs-document-session'
import type { RejectedYjsSave, YjsVersionDecision } from './live-yjs-document-session'
import { createYjsUpdateOutbox } from './yjs-update-outbox'
import { liveContentPendingState } from './live-content-pending-state'

type CanvasSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type SaveCanvasContentArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasContentResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>

type LiveCanvasBackend = LiveFixedContentBackend &
  Readonly<{
    save(args: SaveCanvasContentArgs): Promise<SaveCanvasContentResult>
  }>

type CanvasStore = ReturnType<typeof createResourceWatchStore<CanvasSnapshot, CanvasSessionState>>

class LiveCanvasSession implements CanvasSession {
  readonly awareness = { status: 'unavailable' as const }
  readonly #session: ReturnType<typeof createLiveYjsDocumentSession>

  constructor(
    readonly document: Y.Doc,
    version: CanvasSession['version'],
    campaignId: CampaignId,
    resourceId: ResourceId,
    memberId: CampaignMemberId,
    backend: LiveCanvasBackend,
    changed: () => void,
    failed: (result: RejectedYjsSave) => void,
  ) {
    this.#session = createLiveYjsDocumentSession({
      document,
      version,
      outbox: createYjsUpdateOutbox('canvas', campaignId, resourceId, memberId),
      persist: createBackendYjsPersistence(campaignId, resourceId, (args) => backend.save(args)),
      changed,
      failed,
    })
  }

  get version() {
    return this.#session.version
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
  readonly #sessions = new Map<ResourceId, LiveCanvasSession>()

  constructor(
    private readonly campaignId: CampaignId,
    private readonly memberId: CampaignMemberId,
    private readonly backend: LiveCanvasBackend,
    private readonly beginCreate: () => ResourceHistoryRecording,
  ) {
    this.#store = createResourceWatchStore<CanvasSnapshot, CanvasSessionState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
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
    for (const session of this.#sessions.values()) session.dispose()
    this.#sessions.clear()
  }

  #apply(resourceId: ResourceId, snapshot: CanvasSnapshot): void {
    if (snapshot.status !== 'ready') {
      this.#replaceState(resourceId, liveContentPendingState(snapshot))
      return
    }
    if (snapshot.kind !== 'canvas') {
      this.#replaceState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
      return
    }

    let version: CanvasSession['version']
    const decoded = new Y.Doc()
    try {
      version = assertVersionStamp(snapshot.version)
      Y.applyUpdate(decoded, new Uint8Array(snapshot.update))
      if (!parseCanvasDocumentContent(decoded)) throw new TypeError('Invalid canvas document')
    } catch {
      decoded.destroy()
      this.#replaceState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
      return
    }

    const existing = this.#sessions.get(resourceId)
    if (existing) {
      decoded.destroy()
      existing.apply(snapshot.update, version)
      return
    }
    let session: LiveCanvasSession
    try {
      session = new LiveCanvasSession(
        decoded,
        version,
        this.campaignId,
        resourceId,
        this.memberId,
        this.backend,
        () => this.#store.set(resourceId, { status: 'ready', session }),
        (result) => this.#fail(resourceId, session, result),
      )
    } catch (error) {
      decoded.destroy()
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
}

export function createLiveCanvasSessionSource(
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  backend: LiveCanvasBackend,
  beginCreate: () => ResourceHistoryRecording,
): CanvasSessionSource {
  return new LiveCanvasSessionSource(campaignId, memberId, backend, beginCreate)
}
