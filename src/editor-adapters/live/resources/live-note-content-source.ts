import * as Y from 'yjs'
import { noteDocumentToMarkdown } from '@wizard-archive/editor/notes/document-markdown'
import {
  NOTE_YJS_FRAGMENT,
  replaceNoteYjsDocument,
} from '@wizard-archive/editor/notes/document-yjs'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { initialNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CreateNoteResourceCommand,
  ContentExportResult,
  ContentCollaboration,
  CollaborationUser,
  NoteSession,
  NoteSessionSource,
  NoteSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import type { ResourceUndoRecording } from '@wizard-archive/editor/resources/undo-history'
import { createResourceWatchStore } from './resource-watch-store'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'
import type { LiveResourcePresenceBackend } from './live-resource-presence'
import { createLiveCollaborativeYjsSession } from './live-collaborative-yjs-session'
import {
  createBackendYjsPersistence,
  failedYjsSessionState,
  yjsUpdateArrayBuffer,
  YjsUpdateOutboxUnavailableError,
} from './live-yjs-document-session'
import type { RejectedYjsSave, YjsVersionDecision } from './live-yjs-document-session'
import { createYjsUpdateOutbox } from './yjs-update-outbox'
import type { YjsUpdateOutbox } from './yjs-update-outbox'
import { createReadonlyYjsSession, isReadonlyYjsSession } from './readonly-yjs-session'

type NoteSnapshot = FunctionReturnType<typeof api.resources.queries.loadNoteContent>
type CreateNoteArgs = FunctionArgs<typeof api.resources.mutations.createNoteResource>
type CreateNoteResult = FunctionReturnType<typeof api.resources.mutations.createNoteResource>
type SaveNoteContentArgs = FunctionArgs<typeof api.resources.mutations.saveNoteContent>
type SaveNoteContentResult = FunctionReturnType<typeof api.resources.mutations.saveNoteContent>

type LiveNoteContentBackend = LiveResourcePresenceBackend &
  Readonly<{
    load(resourceId: ResourceId): Promise<NoteSnapshot>
    watch(resourceId: ResourceId, apply: (snapshot: NoteSnapshot) => void): () => void
    create(args: CreateNoteArgs): Promise<CreateNoteResult>
    refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
    save(args: SaveNoteContentArgs): Promise<SaveNoteContentResult>
  }>

type LocalCreate = {
  operationId: OperationId
  doc: Y.Doc
  initialUpdate: Uint8Array
  outbox: YjsUpdateOutbox
  storageAvailable: boolean
  stop(): void
}
type LocalCreateStart =
  | Readonly<{ status: 'ready'; create: LocalCreate }>
  | Readonly<{ status: 'unavailable'; issue: 'content_corrupt' | 'scope_unavailable' }>
type NoteStore = ReturnType<typeof createResourceWatchStore<NoteSnapshot, NoteSessionState>>

function exportNoteDocument(document: Y.Doc): ContentExportResult {
  try {
    return {
      status: 'ready',
      bytes: new TextEncoder().encode(noteDocumentToMarkdown(document)),
      extension: 'md',
      mediaType: 'text/markdown',
    }
  } catch {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
}

function exportNoteSnapshot(snapshot: NoteSnapshot): ContentExportResult {
  if (snapshot.status === 'empty') {
    return {
      status: 'ready',
      bytes: new Uint8Array(),
      extension: 'md',
      mediaType: 'text/markdown',
    }
  }
  if (snapshot.status !== 'ready') return snapshot
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(snapshot.update))
    return exportNoteDocument(document)
  } catch {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  } finally {
    document.destroy()
  }
}

class LiveNoteSession implements NoteSession {
  readonly #liveAwareness: ReturnType<typeof createLiveCollaborativeYjsSession>['awareness']
  readonly #session: ReturnType<typeof createLiveCollaborativeYjsSession>['session']

  constructor(
    readonly document: Y.Doc,
    version: NoteSession['version'],
    campaignId: CampaignId,
    resourceId: ResourceId,
    backend: LiveNoteContentBackend,
    memberId: CampaignMemberId,
    user: CollaborationUser,
    changed: () => void,
    failed: (result: RejectedYjsSave) => void,
  ) {
    const collaborative = createLiveCollaborativeYjsSession({
      presenceBackend: backend,
      document,
      version,
      resourceId,
      memberId,
      user,
      outbox: createYjsUpdateOutbox('note', campaignId, resourceId, memberId),
      persist: createBackendYjsPersistence(campaignId, resourceId, (args) => backend.save(args)),
      canonicalize: () => 'unchanged',
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

  get collaboration(): ContentCollaboration {
    return this.#liveAwareness.collaboration
  }

  apply(update: ArrayBuffer, version: NoteSession['version']): YjsVersionDecision {
    return this.#session.apply(update, version)
  }

  readonly flush = () => this.#session.flush()

  dispose(): void {
    this.#session.dispose()
  }
}

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'invalid_command' },
  }
}

class LiveNoteSessionSource implements NoteSessionSource {
  readonly #store: NoteStore
  readonly #creates = new Map<ResourceId, LocalCreate>()
  readonly #sessions = new Map<ResourceId, NoteSession>()

  constructor(
    private readonly campaignId: CampaignId,
    private readonly memberId: CampaignMemberId,
    private readonly user: CollaborationUser,
    private readonly backend: LiveNoteContentBackend,
    private readonly beginCreateUndo: () => ResourceUndoRecording,
    private readonly readonlyProjection: boolean,
  ) {
    this.#store = createResourceWatchStore<NoteSnapshot, NoteSessionState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): NoteSessionState {
    return this.#store.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  async export(resourceId: ResourceId): Promise<ContentExportResult> {
    const state = this.get(resourceId)
    return state.status === 'ready'
      ? exportNoteDocument(state.session.document)
      : exportNoteSnapshot(await this.backend.load(resourceId))
  }

  async create(
    envelope: CommandEnvelope<CreateNoteResourceCommand>,
    local: Y.Doc,
  ): Promise<CommandDelivery<ResourceStructureCommandResult>> {
    if (envelope.campaignId !== this.campaignId) return invalidCreateDelivery()
    const resourceId = envelope.command.resourceId
    const existing = this.#creates.get(resourceId)
    if (existing && (existing.operationId !== envelope.operationId || existing.doc !== local)) {
      return invalidCreateDelivery()
    }

    const started = existing
      ? ({ status: 'ready', create: existing } as const)
      : this.#startLocalCreate(resourceId, envelope.operationId, local)
    if (started.status === 'unavailable') {
      this.#setState(
        resourceId,
        started.issue === 'scope_unavailable'
          ? { status: 'unavailable', reason: 'scope_unavailable' }
          : { status: 'integrity_error', issue: 'content_corrupt' },
      )
      return {
        status: 'not_committed',
        retryable: false,
        reason:
          started.issue === 'scope_unavailable' ? 'transport_unavailable' : 'invalid_response',
      }
    }
    const create = started.create
    this.#creates.set(resourceId, create)
    this.#setState(resourceId, {
      status: 'initializing',
      operationId: envelope.operationId,
      local,
    })
    const undoRecording = this.beginCreateUndo()
    try {
      const delivery = deliverExpectedCreateResult(
        readLiveStructureResult(
          await this.backend.create({
            campaignId: this.campaignId,
            operationId: envelope.operationId,
            command: toLiveStructureMutationCommand(
              normalizeResourceStructureCommand(envelope.command),
            ),
            update: yjsUpdateArrayBuffer(create.initialUpdate),
          }),
        ),
        this.campaignId,
        envelope.operationId,
        resourceId,
      )
      if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
        undoRecording.abandon()
        this.#removeLocal(resourceId)
        return delivery
      }
      await this.backend.refresh(resourceId, envelope.command.parentId)
      undoRecording.completed(delivery.result.receipt)
      const version = await initialNoteContentVersion(create.initialUpdate)
      create.stop()
      this.#creates.delete(resourceId)
      if (!create.storageAvailable) {
        local.destroy()
        return delivery
      }
      this.#setReady(resourceId, local, version)
      return delivery
    } catch {
      return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
    }
  }

  dispose(): void {
    this.#store.dispose()
    for (const session of this.#sessions.values()) session.dispose()
    for (const create of this.#creates.values()) {
      create.stop()
      create.doc.destroy()
    }
    this.#sessions.clear()
    this.#creates.clear()
  }

  #apply(resourceId: ResourceId, snapshot: NoteSnapshot): void {
    switch (snapshot.status) {
      case 'unavailable':
      case 'integrity_error':
      case 'empty':
        this.#clearSession(resourceId)
        this.#setState(resourceId, snapshot)
        return
      case 'ready':
        this.#applyReadySnapshot(resourceId, snapshot)
    }
  }

  #applyReadySnapshot(
    resourceId: ResourceId,
    snapshot: Extract<NoteSnapshot, { status: 'ready' }>,
  ) {
    const version = assertVersionStamp(snapshot.version)
    const session = this.#sessions.get(resourceId)
    if (session && this.readonlyProjection) {
      this.#applyReadonlyProjection(resourceId, snapshot, version, session)
      return
    }
    if (session && !this.readonlyProjection) {
      if (!(session instanceof LiveNoteSession)) {
        throw new TypeError('Editable note source owns a readonly session')
      }
      session.apply(snapshot.update, version)
      return
    }
    const doc = new Y.Doc()
    try {
      Y.applyUpdate(doc, new Uint8Array(snapshot.update))
      this.#setReady(resourceId, doc, version)
    } catch {
      doc.destroy()
      this.#clearSession(resourceId)
      this.#setState(resourceId, {
        status: 'integrity_error',
        issue: 'content_corrupt',
      })
    }
  }

  #applyReadonlyProjection(
    resourceId: ResourceId,
    snapshot: Extract<NoteSnapshot, { status: 'ready' }>,
    version: NoteSession['version'],
    session: NoteSession,
  ): void {
    if (!isReadonlyYjsSession(session)) {
      throw new TypeError('Readonly note source owns an editable session')
    }
    if (version.revision < session.version.revision) return
    if (
      version.revision === session.version.revision &&
      version.digest === session.version.digest
    ) {
      return
    }
    const projection = new Y.Doc()
    try {
      Y.applyUpdate(projection, new Uint8Array(snapshot.update))
      session.applyProjection(version, () =>
        replaceNoteYjsDocument(session.document, projection, NOTE_YJS_FRAGMENT, session),
      )
      this.#setState(resourceId, { status: 'ready', session })
    } catch {
      this.#clearSession(resourceId)
      this.#setState(resourceId, {
        status: 'integrity_error',
        issue: 'content_corrupt',
      })
    } finally {
      projection.destroy()
    }
  }

  #removeLocal(resourceId: ResourceId): void {
    const create = this.#creates.get(resourceId)
    create?.stop()
    const cleared = create?.outbox.clear()
    this.#creates.delete(resourceId)
    this.#clearSession(resourceId)
    this.#setState(
      resourceId,
      cleared?.status === 'unavailable'
        ? { status: 'unavailable', reason: 'scope_unavailable' }
        : { status: 'loading' },
    )
  }

  #setReady(resourceId: ResourceId, document: Y.Doc, version: NoteSession['version']): void {
    this.#clearSession(resourceId)
    if (this.readonlyProjection) {
      const session = createReadonlyYjsSession(document, version, this.user)
      this.#sessions.set(resourceId, session)
      this.#setState(resourceId, { status: 'ready', session })
      return
    }
    let session: LiveNoteSession
    try {
      session = new LiveNoteSession(
        document,
        version,
        this.campaignId,
        resourceId,
        this.backend,
        this.memberId,
        this.user,
        () => {
          const current = this.#sessions.get(resourceId)
          if (current) this.#setState(resourceId, { status: 'ready', session: current })
        },
        (result) => {
          if (this.#sessions.get(resourceId)?.document !== document) return
          this.#sessions.delete(resourceId)
          this.#setState(resourceId, failedYjsSessionState(result))
        },
      )
    } catch (error) {
      document.destroy()
      this.#setState(
        resourceId,
        error instanceof YjsUpdateOutboxUnavailableError
          ? { status: 'unavailable', reason: 'scope_unavailable' }
          : { status: 'integrity_error', issue: 'content_corrupt' },
      )
      return
    }
    this.#sessions.set(resourceId, session)
    this.#setState(resourceId, { status: 'ready', session })
  }

  #clearSession(resourceId: ResourceId): void {
    this.#sessions.get(resourceId)?.dispose()
    this.#sessions.delete(resourceId)
  }

  #setState(resourceId: ResourceId, state: NoteSessionState): void {
    this.#store.set(resourceId, state)
  }

  #startLocalCreate(
    resourceId: ResourceId,
    operationId: OperationId,
    doc: Y.Doc,
  ): LocalCreateStart {
    const outbox = createYjsUpdateOutbox('note', this.campaignId, resourceId, this.memberId)
    const recovered = outbox.load()
    if (recovered.status === 'unavailable') {
      return { status: 'unavailable', issue: 'scope_unavailable' }
    }
    const initialUpdate = Y.encodeStateAsUpdate(doc)
    try {
      if (recovered.update) Y.applyUpdate(doc, recovered.update)
    } catch {
      return { status: 'unavailable', issue: 'content_corrupt' }
    }
    const create: LocalCreate = {
      operationId,
      doc,
      initialUpdate,
      outbox,
      storageAvailable: true,
      stop: () => doc.off('update', onUpdate),
    }
    const onUpdate = (update: Uint8Array) => {
      if (outbox.merge(update).status === 'accepted') return
      create.storageAvailable = false
      create.stop()
      this.#setState(resourceId, { status: 'unavailable', reason: 'scope_unavailable' })
    }
    doc.on('update', onUpdate)
    return { status: 'ready', create }
  }
}

export function createLiveNoteContentSource(
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveNoteContentBackend,
  beginCreateUndo: () => ResourceUndoRecording,
  readonlyProjection = false,
) {
  return new LiveNoteSessionSource(
    campaignId,
    memberId,
    user,
    backend,
    beginCreateUndo,
    readonlyProjection,
  )
}
