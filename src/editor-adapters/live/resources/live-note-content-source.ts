import * as Y from 'yjs'
import { noteDocumentToMarkdown } from '@wizard-archive/editor/notes/document-markdown'
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
  NoteCollaboration,
  NoteCollaborationUser,
  NoteSession,
  NoteSessionSource,
  NoteSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
import { createResourceWatchStore } from './resource-watch-store'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'
import { createLiveNoteAwareness } from './live-note-awareness'
import type { LiveNoteAwarenessBackend } from './live-note-awareness'
import {
  createBackendYjsPersistence,
  createLiveYjsDocumentSession,
  failedYjsSessionState,
  mergeOptionalYjsUpdates,
  yjsUpdateArrayBuffer,
} from './live-yjs-document-session'
import type { RejectedYjsSave, YjsVersionDecision } from './live-yjs-document-session'
import { createYjsUpdateOutbox } from './yjs-update-outbox'

type NoteSnapshot = FunctionReturnType<typeof api.resources.queries.loadNoteContent>
type CreateNoteArgs = FunctionArgs<typeof api.resources.mutations.createNoteResource>
type CreateNoteResult = FunctionReturnType<typeof api.resources.mutations.createNoteResource>
type SaveNoteContentArgs = FunctionArgs<typeof api.resources.mutations.saveNoteContent>
type SaveNoteContentResult = FunctionReturnType<typeof api.resources.mutations.saveNoteContent>

type LiveNoteContentBackend = LiveNoteAwarenessBackend &
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
  pendingUpdate: Uint8Array | null
  stop(): void
}
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
  readonly #liveAwareness: ReturnType<typeof createLiveNoteAwareness>
  readonly #session: ReturnType<typeof createLiveYjsDocumentSession>

  constructor(
    readonly document: Y.Doc,
    version: NoteSession['version'],
    campaignId: CampaignId,
    resourceId: ResourceId,
    backend: LiveNoteContentBackend,
    memberId: CampaignMemberId,
    user: NoteCollaborationUser,
    changed: () => void,
    failed: (result: RejectedYjsSave) => void,
    initialPendingUpdate: Uint8Array | null = null,
  ) {
    this.#liveAwareness = createLiveNoteAwareness(
      document,
      resourceId,
      memberId,
      user,
      backend,
      changed,
    )
    this.#session = createLiveYjsDocumentSession({
      document,
      version,
      outbox: createYjsUpdateOutbox('note', campaignId, resourceId, memberId),
      initialPendingUpdate,
      persist: createBackendYjsPersistence(campaignId, resourceId, (args) => backend.save(args)),
      changed,
      failed,
      flushCompanion: () => this.#liveAwareness.flush(),
      disposeCompanion: () => this.#liveAwareness.dispose(),
    })
  }

  get version() {
    return this.#session.version
  }

  get awareness() {
    return this.#liveAwareness.awareness
  }

  get collaboration(): NoteCollaboration {
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
  readonly #sessions = new Map<ResourceId, LiveNoteSession>()

  constructor(
    private readonly campaignId: CampaignId,
    private readonly memberId: CampaignMemberId,
    private readonly user: NoteCollaborationUser,
    private readonly backend: LiveNoteContentBackend,
    private readonly beginCreate: () => ResourceHistoryRecording,
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

    const create = existing ?? this.#beginCreate(envelope.operationId, local)
    this.#creates.set(resourceId, create)
    this.#setState(resourceId, {
      status: 'initializing',
      operationId: envelope.operationId,
      local,
    })
    const recording = this.beginCreate()
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
        recording.abandon()
        this.#removeLocal(resourceId)
        return delivery
      }
      await this.backend.refresh(resourceId, envelope.command.parentId)
      recording.completed(delivery.result.receipt)
      const version = await initialNoteContentVersion(create.initialUpdate)
      create.stop()
      this.#creates.delete(resourceId)
      this.#setReady(resourceId, local, version, create.pendingUpdate)
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
        this.#clearSession(resourceId)
        this.#setState(resourceId, snapshot)
        return
      case 'ready': {
        const version = assertVersionStamp(snapshot.version)
        const session = this.#sessions.get(resourceId)
        if (session) {
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
    }
  }

  #removeLocal(resourceId: ResourceId): void {
    this.#creates.get(resourceId)?.stop()
    this.#creates.delete(resourceId)
    this.#clearSession(resourceId)
    this.#setState(resourceId, { status: 'loading' })
  }

  #setReady(
    resourceId: ResourceId,
    document: Y.Doc,
    version: NoteSession['version'],
    pendingUpdate: Uint8Array | null = null,
  ): void {
    this.#clearSession(resourceId)
    const session = new LiveNoteSession(
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
      pendingUpdate,
    )
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

  #beginCreate(operationId: OperationId, doc: Y.Doc): LocalCreate {
    const create: LocalCreate = {
      operationId,
      doc,
      initialUpdate: Y.encodeStateAsUpdate(doc),
      pendingUpdate: null,
      stop: () => doc.off('update', onUpdate),
    }
    const onUpdate = (update: Uint8Array) => {
      create.pendingUpdate = mergeOptionalYjsUpdates(create.pendingUpdate, update)
    }
    doc.on('update', onUpdate)
    return create
  }
}

export function createLiveNoteContentSource(
  campaignId: CampaignId,
  memberId: CampaignMemberId,
  user: NoteCollaborationUser,
  backend: LiveNoteContentBackend,
  beginCreate: () => ResourceHistoryRecording,
) {
  return new LiveNoteSessionSource(campaignId, memberId, user, backend, beginCreate)
}
