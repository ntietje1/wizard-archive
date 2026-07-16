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
  NoteSessionSaveResult,
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
import { createNoteUpdateOutbox } from './note-update-outbox'
import type { NoteUpdateOutbox } from './note-update-outbox'

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

type LocalCreate = Readonly<{ operationId: OperationId; doc: Y.Doc }>
type NoteStore = ReturnType<typeof createResourceWatchStore<NoteSnapshot, NoteSessionState>>
const REMOTE_NOTE_UPDATE = Symbol('remote-note-update')
const NOTE_SAVE_DELAY_MS = 250
const NOTE_SAVE_RETRY_DELAYS_MS = [250, 500, 1000, 2000] as const

type RejectedNoteSave = Extract<NoteSessionSaveResult, { status: 'rejected' }>
type PersistedNoteSave = Extract<SaveNoteContentResult, { status: 'completed' }> | RejectedNoteSave
type VersionDecision = 'applied' | 'conflict' | 'duplicate' | 'stale'

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
  readonly #outbox: NoteUpdateOutbox
  #version
  #unacknowledgedUpdate: Uint8Array | null = null
  #drainPromise: Promise<NoteSessionSaveResult> | null = null
  #lifecycle: 'closing' | 'destroyed' | 'open' = 'open'
  #pendingUpdate: Uint8Array | null = null
  #terminal: RejectedNoteSave | null = null
  #timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    readonly document: Y.Doc,
    version: NoteSession['version'],
    private readonly campaignId: CampaignId,
    private readonly resourceId: ResourceId,
    private readonly backend: LiveNoteContentBackend,
    memberId: CampaignMemberId,
    user: NoteCollaborationUser,
    private readonly changed: () => void,
    private readonly failed: (result: RejectedNoteSave) => void,
  ) {
    this.#version = version
    this.#outbox = createNoteUpdateOutbox(campaignId, resourceId, memberId)
    const recovered = this.#outbox.load()
    if (recovered) {
      Y.applyUpdate(document, recovered, REMOTE_NOTE_UPDATE)
      this.#pendingUpdate = recovered
      this.#unacknowledgedUpdate = recovered
    }
    document.on('update', this.#onUpdate)
    this.#liveAwareness = createLiveNoteAwareness(
      document,
      resourceId,
      memberId,
      user,
      backend,
      changed,
    )
    if (recovered) this.#scheduleSave()
  }

  get version() {
    return this.#version
  }

  get awareness() {
    return this.#liveAwareness.awareness
  }

  get collaboration(): NoteCollaboration {
    return this.#liveAwareness.collaboration
  }

  apply(update: ArrayBuffer, version: NoteSession['version']): VersionDecision {
    if (version.revision < this.#version.revision) return 'stale'
    if (version.revision === this.#version.revision) {
      if (version.digest === this.#version.digest) return 'duplicate'
      this.#fail({ status: 'rejected', reason: 'content_corrupt' })
      return 'conflict'
    }
    Y.applyUpdate(this.document, new Uint8Array(update), REMOTE_NOTE_UPDATE)
    this.#version = version
    this.changed()
    return 'applied'
  }

  readonly flush = (): Promise<NoteSessionSaveResult> => {
    const awareness = this.#liveAwareness.flush()
    const document = this.#flushDocument()
    return Promise.all([awareness, document]).then(([, result]) => result)
  }

  #flushDocument(): Promise<NoteSessionSaveResult> {
    if (this.#lifecycle === 'destroyed') {
      return Promise.resolve(this.#terminal ?? { status: 'rejected', reason: 'scope_unavailable' })
    }
    if (this.#terminal) return Promise.resolve(this.#terminal)
    if (this.#drainPromise) return this.#drainPromise
    if (this.#pendingUpdate === null) {
      return Promise.resolve({ status: 'completed', version: this.#version })
    }
    this.#drainPromise = this.#drain().finally(() => {
      this.#drainPromise = null
      if (this.#lifecycle === 'closing') this.#destroy()
    })
    return this.#drainPromise
  }

  dispose(): void {
    if (this.#lifecycle !== 'open') return
    this.#close()
    void this.flush().finally(() => this.#destroy())
  }

  readonly #onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_NOTE_UPDATE || this.#lifecycle !== 'open') return
    this.#pendingUpdate =
      this.#pendingUpdate === null
        ? Uint8Array.from(update)
        : Y.mergeUpdates([this.#pendingUpdate, update])
    this.#unacknowledgedUpdate =
      this.#unacknowledgedUpdate === null
        ? Uint8Array.from(update)
        : Y.mergeUpdates([this.#unacknowledgedUpdate, update])
    this.#outbox.replace(this.#unacknowledgedUpdate)
    this.#scheduleSave()
  }

  #scheduleSave(): void {
    if (this.#drainPromise) return
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      this.#timer = null
      void this.flush()
    }, NOTE_SAVE_DELAY_MS)
  }

  async #drain(): Promise<NoteSessionSaveResult> {
    while (this.#pendingUpdate !== null) {
      const update = this.#pendingUpdate
      this.#pendingUpdate = null
      const result = await this.#persist(update)
      if (result.status === 'rejected') {
        this.#pendingUpdate =
          this.#pendingUpdate === null ? update : Y.mergeUpdates([update, this.#pendingUpdate])
        this.#fail(result)
        return result
      }
      if (this.apply(result.update, assertVersionStamp(result.version)) === 'conflict') {
        return this.#terminal!
      }
      this.#unacknowledgedUpdate = this.#pendingUpdate
      if (this.#unacknowledgedUpdate === null) this.#outbox.clear()
      else this.#outbox.replace(this.#unacknowledgedUpdate)
    }
    return { status: 'completed', version: this.#version }
  }

  async #persist(update: Uint8Array): Promise<PersistedNoteSave> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const result = await this.backend.save({
          campaignId: this.campaignId,
          resourceId: this.resourceId,
          update: toArrayBuffer(update),
        })
        return result.status === 'rejected'
          ? { status: 'rejected', reason: saveRejection(result.reason) }
          : result
      } catch {
        const delay = NOTE_SAVE_RETRY_DELAYS_MS[attempt]
        if (delay === undefined) {
          return { status: 'rejected', reason: 'scope_unavailable' }
        }
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  #fail(result: RejectedNoteSave): void {
    if (this.#terminal) return
    this.#terminal = result
    this.#close()
    this.failed(result)
    if (!this.#drainPromise) this.#destroy()
  }

  #close(): void {
    if (this.#lifecycle !== 'open') return
    this.#lifecycle = 'closing'
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
    this.document.off('update', this.#onUpdate)
  }

  #destroy(): void {
    if (this.#lifecycle === 'destroyed') return
    this.#lifecycle = 'destroyed'
    void this.#liveAwareness.dispose().finally(() => this.document.destroy())
  }
}

function saveRejection(reason: Extract<SaveNoteContentResult, { status: 'rejected' }>['reason']) {
  if (reason === 'ownership_mismatch') return 'unauthorized' as const
  if (reason === 'wrong_kind' || reason === 'invalid_uuid') return 'content_corrupt' as const
  return reason
}

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}

function invalidCreateDelivery(): CommandDelivery<ResourceStructureCommandResult> {
  return {
    status: 'received',
    result: { status: 'rejected', reason: 'invalid_command' },
  }
}

function failedNoteState(result: RejectedNoteSave): NoteSessionState {
  switch (result.reason) {
    case 'scope_unavailable':
    case 'unauthorized':
      return { status: 'unavailable', reason: result.reason }
    case 'content_corrupt':
    case 'version_exhausted':
      return { status: 'integrity_error', issue: result.reason }
    case 'content_missing':
    case 'resource_missing':
      return { status: 'integrity_error', issue: 'content_missing' }
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
    const existing = this.#creates.get(envelope.command.resourceId)
    if (existing && (existing.operationId !== envelope.operationId || existing.doc !== local)) {
      return invalidCreateDelivery()
    }

    this.#creates.set(envelope.command.resourceId, {
      operationId: envelope.operationId,
      doc: local,
    })
    this.#setState(envelope.command.resourceId, {
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
            update: toArrayBuffer(Y.encodeStateAsUpdate(local)),
          }),
        ),
        this.campaignId,
        envelope.operationId,
        envelope.command.resourceId,
      )
      if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
        recording.abandon()
        this.#removeLocal(envelope.command.resourceId)
        return delivery
      }
      await this.backend.refresh(envelope.command.resourceId, envelope.command.parentId)
      recording.completed(delivery.result.receipt)
      this.#creates.delete(envelope.command.resourceId)
      this.#setReady(
        envelope.command.resourceId,
        local,
        await initialNoteContentVersion(Y.encodeStateAsUpdate(local)),
      )
      return delivery
    } catch {
      return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
    }
  }

  dispose(): void {
    this.#store.dispose()
    for (const session of this.#sessions.values()) session.dispose()
    for (const create of this.#creates.values()) create.doc.destroy()
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
    this.#creates.delete(resourceId)
    this.#clearSession(resourceId)
    this.#setState(resourceId, { status: 'loading' })
  }

  #setReady(resourceId: ResourceId, document: Y.Doc, version: NoteSession['version']): void {
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
        this.#setState(resourceId, failedNoteState(result))
      },
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
