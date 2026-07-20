import * as Y from 'yjs'
import {
  canonicalizeCanvasDocumentContent,
  parseCanvasDocumentContent,
  readCanvasDocumentContent,
  replaceCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import { encodeWizardCanvasDocument } from '@wizard-archive/editor/canvas/native-document'
import {
  assertVersionStamp,
  initialVersion,
  sha256Digest,
} from '@wizard-archive/editor/resources/component-version'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type {
  CanvasSession,
  CanvasPreviewState,
  CanvasSessionSource,
  CanvasSessionState,
  CollaborationUser,
  ContentCollaboration,
  ContentExportResult,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceUndoRecording } from '@wizard-archive/editor/resources/undo-history'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { createResourceWatchStore } from './resource-watch-store'
import { createLiveFixedContentResource } from './live-fixed-content-create'
import type { LiveFixedContentCreateBackend } from './live-fixed-content-create'
import {
  createBackendYjsPersistence,
  failedYjsSessionConstructionState,
  failedYjsSessionState,
} from './live-yjs-document-session'
import type { RejectedYjsSave } from './live-yjs-document-session'
import { createYjsUpdateOutbox } from './yjs-update-outbox'
import { liveContentPendingState } from './live-content-pending-state'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import type { LiveResourcePresenceBackend } from './live-resource-presence'
import { createLiveCollaborativeYjsSession } from './live-collaborative-yjs-session'
import { createReadonlyYjsSession, isReadonlyYjsSession } from './readonly-yjs-session'
import type { ReadonlyYjsSession } from './readonly-yjs-session'
import {
  createLiveAuthorityBoundYjsSession,
  createYjsSessionAuthorityBinding,
} from './live-resource-content-authority'
import { createLiveYjsRecovery } from './live-yjs-recovery'
import type {
  LiveResourceContentAuthority,
  YjsSessionAuthorityBinding,
} from './live-resource-content-authority'

type CanvasSnapshot = FunctionReturnType<typeof api.resources.queries.loadCanvasContent>
type SaveCanvasContentArgs = FunctionArgs<typeof api.resources.mutations.saveCanvasContent>
type SaveCanvasContentResult = FunctionReturnType<typeof api.resources.mutations.saveCanvasContent>
type ReapplyYjsRecoveryArgs = FunctionArgs<typeof api.resources.mutations.reapplyYjsRecovery>
type ReapplyYjsRecoveryResult = FunctionReturnType<
  typeof api.resources.mutations.reapplyYjsRecovery
>

type LiveCanvasBackend = LiveFixedContentCreateBackend &
  LiveResourcePresenceBackend &
  Readonly<{
    load(resourceId: ResourceId): Promise<CanvasSnapshot>
    reapply(args: ReapplyYjsRecoveryArgs): Promise<ReapplyYjsRecoveryResult>
    watch(resourceId: ResourceId, apply: (snapshot: CanvasSnapshot) => void): () => void
    save(args: SaveCanvasContentArgs): Promise<SaveCanvasContentResult>
  }>

type CanvasStore = ReturnType<typeof createResourceWatchStore<CanvasSnapshot, CanvasSessionState>>
type CanvasPreviewStore = ReturnType<
  typeof createResourceWatchStore<CanvasSnapshot, CanvasPreviewState>
>

function createLiveCanvasSession(
  document: Y.Doc,
  version: CanvasSession['version'],
  generation: ContentGeneration,
  campaignId: CampaignId,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveCanvasBackend,
  changed: () => void,
  failed: (result: RejectedYjsSave) => void,
  collaboration?: ContentCollaboration,
) {
  const collaborative = createLiveCollaborativeYjsSession({
    presenceBackend: backend,
    document,
    generation,
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
    collaboration,
  })
  return createLiveAuthorityBoundYjsSession(collaborative.awareness, collaborative.session)
}

type LiveCanvasSession = ReturnType<typeof createLiveCanvasSession>

class LiveCanvasSessionSource implements CanvasSessionSource {
  readonly #store: CanvasStore
  readonly #previewStore: CanvasPreviewStore
  readonly #previewDocuments = new Map<ResourceId, Y.Doc>()
  readonly #generations = new Map<ResourceId, ContentGeneration>()
  readonly #sessions = new Map<ResourceId, LiveCanvasSession | ReadonlyYjsSession>()
  readonly #authorityBinding: YjsSessionAuthorityBinding
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
    private readonly beginCreateUndo: () => ResourceUndoRecording,
    private readonly authority: LiveResourceContentAuthority,
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
    this.#authorityBinding = createYjsSessionAuthorityBinding(
      authority,
      this.#sessions,
      isReadonlyYjsSession,
      (resourceId, transition) => {
        if (transition.editable) {
          this.#applyEditable(
            resourceId,
            transition.document,
            transition.version,
            this.#generations.get(resourceId) ?? INITIAL_CONTENT_GENERATION,
            transition.collaboration,
          )
          return
        }
        this.#applyReadonly(
          resourceId,
          transition.document,
          transition.version,
          this.#generations.get(resourceId) ?? INITIAL_CONTENT_GENERATION,
          transition.collaboration,
        )
      },
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
      if (state.status === 'initializing') return { status: 'loading' }
      if (state.status === 'recovery_required') {
        return { status: 'integrity_error', issue: state.issue }
      }
      return state
    }
    return {
      status: 'ready',
      bytes: encodeWizardCanvasDocument(state.session.document),
      extension: 'wizardcanvas',
      mediaType: 'application/vnd.wizard-archive.canvas',
    }
  }

  create: CanvasSessionSource['create'] = (envelope) =>
    createLiveFixedContentResource(this.campaignId, envelope, this.backend, this.beginCreateUndo)

  dispose(): void {
    this.#authorityBinding.dispose()
    this.#store.dispose()
    this.#previewStore.dispose()
    for (const session of this.#sessions.values()) session.dispose()
    for (const document of this.#previewDocuments.values()) document.destroy()
    this.#sessions.clear()
    this.#generations.clear()
    this.#previewDocuments.clear()
  }

  #apply(resourceId: ResourceId, snapshot: CanvasSnapshot): void {
    const decoded = decodeCanvasPreviewSnapshot(snapshot)
    if (decoded.status !== 'ready') {
      this.#replaceState(resourceId, decoded)
      return
    }
    const { document, generation, version } = decoded
    this.#authorityBinding.reconcile(resourceId)
    if (this.#setRecovery(resourceId)) {
      document.destroy()
      return
    }
    if (!this.authority.canEdit(resourceId)) {
      this.#applyReadonly(resourceId, document, version, generation)
      return
    }
    this.#applyEditable(resourceId, document, version, generation)
  }

  #applyReadonly(
    resourceId: ResourceId,
    document: Y.Doc,
    version: CanvasSession['version'],
    generation: ContentGeneration,
    collaboration?: ContentCollaboration,
  ): void {
    const existing = this.#sessions.get(resourceId)
    if (!existing) {
      const session = createReadonlyYjsSession(document, version, this.user, collaboration)
      this.#sessions.set(resourceId, session)
      this.#generations.set(resourceId, generation)
      this.#store.set(resourceId, { status: 'ready', session })
      return
    }
    if (!isReadonlyYjsSession(existing)) {
      document.destroy()
      throw new TypeError('Readonly canvas source owns an editable session')
    }
    const currentGeneration = this.#generations.get(resourceId) ?? INITIAL_CONTENT_GENERATION
    if (generation < currentGeneration) {
      document.destroy()
      return
    }
    if (version.revision < existing.version.revision) {
      document.destroy()
      return
    }
    if (
      version.revision === existing.version.revision &&
      version.digest === existing.version.digest
    ) {
      document.destroy()
      this.#store.set(resourceId, { status: 'ready', session: existing })
      return
    }
    const content = readCanvasDocumentContent(document)
    existing.applyProjection(version, () =>
      replaceCanvasDocumentContent(existing.document, content, existing),
    )
    document.destroy()
    this.#generations.set(resourceId, generation)
    this.#store.set(resourceId, { status: 'ready', session: existing })
  }

  #applyEditable(
    resourceId: ResourceId,
    document: Y.Doc,
    version: CanvasSession['version'],
    generation: ContentGeneration,
    collaboration?: ContentCollaboration,
  ): void {
    const existing = this.#sessions.get(resourceId)
    if (existing) {
      if (isReadonlyYjsSession(existing)) {
        throw new TypeError('Editable canvas source owns a readonly session')
      }
      const currentGeneration = this.#generations.get(resourceId) ?? INITIAL_CONTENT_GENERATION
      if (generation < currentGeneration) {
        document.destroy()
        return
      }
      const content = readCanvasDocumentContent(document)
      const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
      document.destroy()
      const decision =
        generation === currentGeneration
          ? existing.apply(update, version)
          : existing.replace(generation, version, (origin) =>
              replaceCanvasDocumentContent(existing.document, content, origin),
            )
      if (decision !== 'conflict' && this.#sessions.get(resourceId) === existing) {
        this.#generations.set(resourceId, generation)
        this.#store.set(resourceId, { status: 'ready', session: existing })
      }
      return
    }
    let session: LiveCanvasSession
    try {
      session = createLiveCanvasSession(
        document,
        version,
        generation,
        this.campaignId,
        resourceId,
        this.memberId,
        this.user,
        this.backend,
        () => this.#store.set(resourceId, { status: 'ready', session }),
        (result) => this.#fail(resourceId, session, result),
        collaboration,
      )
    } catch (error) {
      document.destroy()
      this.#store.set(resourceId, failedYjsSessionConstructionState(error))
      return
    }
    this.#sessions.set(resourceId, session)
    this.#generations.set(resourceId, generation)
    this.#store.set(resourceId, { status: 'ready', session })
  }

  #applyPreview(resourceId: ResourceId, snapshot: CanvasSnapshot): void {
    this.#replacePreview(resourceId, decodeCanvasPreviewSnapshot(snapshot))
  }

  #fail(resourceId: ResourceId, session: LiveCanvasSession, result: RejectedYjsSave): void {
    if (this.#sessions.get(resourceId) !== session) return
    this.#sessions.delete(resourceId)
    this.#generations.delete(resourceId)
    if (result.reason !== 'content_generation_conflict' || !this.#setRecovery(resourceId)) {
      this.#store.set(resourceId, failedYjsSessionState(result))
    }
  }

  #replaceState(resourceId: ResourceId, state: CanvasSessionState): void {
    this.#sessions.get(resourceId)?.dispose()
    this.#sessions.delete(resourceId)
    this.#generations.delete(resourceId)
    this.#store.set(resourceId, state)
  }

  #replacePreview(resourceId: ResourceId, state: CanvasPreviewState): void {
    this.#previewDocuments.get(resourceId)?.destroy()
    if (state.status === 'ready') this.#previewDocuments.set(resourceId, state.document)
    else this.#previewDocuments.delete(resourceId)
    this.#previewStore.set(resourceId, state)
  }

  #setRecovery(resourceId: ResourceId): boolean {
    const reload = () => {
      this.#store.set(resourceId, { status: 'loading' })
      void this.backend
        .load(resourceId)
        .then((snapshot) => this.#apply(resourceId, snapshot))
        .catch(() =>
          this.#store.set(resourceId, {
            status: 'unavailable',
            reason: 'scope_unavailable',
          }),
        )
    }
    const recovery = createLiveYjsRecovery({
      kind: 'canvas',
      campaignId: this.campaignId,
      memberId: this.memberId,
      resourceId,
      load: () => this.backend.load(resourceId),
      reapply: (args) => this.backend.reapply(args),
      reload,
      exportArtifact: exportRecoveryCanvas,
      versionArtifact: async (artifact) => initialVersion(await sha256Digest(artifact)),
    })
    if (!recovery) return false
    this.#store.set(resourceId, {
      status: 'recovery_required',
      issue: 'version_mismatch',
      recovery,
    })
    return true
  }
}

type DecodedCanvasSnapshot =
  | Exclude<CanvasPreviewState, { status: 'ready' }>
  | (Extract<CanvasPreviewState, { status: 'ready' }> & Readonly<{ generation: ContentGeneration }>)

function decodeCanvasPreviewSnapshot(snapshot: CanvasSnapshot): DecodedCanvasSnapshot {
  if (snapshot.status !== 'ready') {
    const pending = liveContentPendingState(snapshot)
    return pending.status === 'initializing' ? { status: 'loading' } : pending
  }
  const document = new Y.Doc()
  try {
    const version = assertVersionStamp(snapshot.version)
    const generation = assertContentGeneration(snapshot.generation)
    if (!canvasEncodedBytesWithinWorkload(snapshot.update)) {
      document.destroy()
      return { status: 'integrity_error', issue: 'content_limit_exceeded' }
    }
    Y.applyUpdate(document, new Uint8Array(snapshot.update))
    if (!parseCanvasDocumentContent(document)) throw new TypeError('Invalid canvas document')
    return { status: 'ready', document, generation, version }
  } catch {
    document.destroy()
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
}

function exportRecoveryCanvas(update: Uint8Array): ContentExportResult {
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, update)
    if (!parseCanvasDocumentContent(document)) {
      return { status: 'integrity_error', issue: 'content_corrupt' }
    }
    return {
      status: 'ready',
      bytes: encodeWizardCanvasDocument(document),
      extension: 'wizardcanvas',
      mediaType: 'application/vnd.wizard-archive.canvas',
    }
  } catch {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  } finally {
    document.destroy()
  }
}

export function createLiveCanvasSessionSource(
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveCanvasBackend,
  beginCreateUndo: () => ResourceUndoRecording,
  authority: LiveResourceContentAuthority,
): CanvasSessionSource {
  return new LiveCanvasSessionSource(
    campaignId,
    memberId,
    user,
    backend,
    beginCreateUndo,
    authority,
  )
}
