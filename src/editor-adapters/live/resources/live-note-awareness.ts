import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type {
  NoteCollaboration,
  NoteCollaborationUser,
  SessionAwareness,
} from '@wizard-archive/editor/resources/content-session-contract'
import { generateUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

type NoteAwarenessSnapshot =
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<{
        clientId: number
        memberId: CampaignMemberId
        state: ArrayBuffer
      }>
    }>
  | Readonly<{ status: 'unavailable'; reason: string }>

export type LiveNoteAwarenessBackend = Readonly<{
  watchAwareness(
    resourceId: ResourceId,
    apply: (snapshot: NoteAwarenessSnapshot) => void,
  ): () => void
  publishAwareness(args: {
    resourceId: ResourceId
    clientId: number
    leaseId: string
    state: ArrayBuffer
  }): Promise<{ status: 'active' | 'unavailable' } | { status: 'rejected'; reason: string }>
  releaseAwareness(args: {
    resourceId: ResourceId
    clientId: number
    leaseId: string
  }): Promise<{ status: 'released' | 'unavailable' } | { status: 'rejected'; reason: string }>
}>

const REMOTE_AWARENESS_UPDATE = Symbol('remote-note-awareness-update')
const AWARENESS_THROTTLE_MS = 16
const AWARENESS_HEARTBEAT_MS = 10_000

class LiveNoteAwareness {
  readonly collaboration: NoteCollaboration
  readonly #awareness: Awareness
  readonly #leaseId = generateUuidV7()
  readonly #memberIds = new Map<number, CampaignMemberId>()
  readonly #unsubscribe: () => void
  #destroyed = false
  #dirty = false
  #heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  #inFlight: Promise<void> | null = null
  #knownRemoteClientIds = new Set<number>()
  #throttleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    document: Y.Doc,
    private readonly resourceId: ResourceId,
    memberId: CampaignMemberId,
    user: NoteCollaborationUser,
    private readonly backend: LiveNoteAwarenessBackend,
    private readonly changed: () => void,
  ) {
    this.#awareness = new Awareness(document)
    this.collaboration = { provider: { awareness: this.#awareness }, user }
    this.#awareness.on('update', this.#onAwarenessUpdate)
    this.#unsubscribe = backend.watchAwareness(resourceId, this.#apply)
    this.#memberIds.set(document.clientID, memberId)
    this.#awareness.setLocalStateField('user', user)
  }

  get awareness(): SessionAwareness {
    return {
      status: 'available',
      collaboratorIds: [...new Set(this.#memberIds.values())],
    }
  }

  async flush(): Promise<void> {
    this.#clearThrottle()
    if (this.#destroyed) return
    if (this.#inFlight) {
      await this.#inFlight
      if (this.#dirty) await this.flush()
      return
    }
    if (!this.#dirty) return

    this.#dirty = false
    const clientId = this.#awareness.doc.clientID
    const state = toArrayBuffer(encodeAwarenessUpdate(this.#awareness, [clientId]))
    this.#inFlight = this.backend
      .publishAwareness({
        resourceId: this.resourceId,
        clientId,
        leaseId: this.#leaseId,
        state,
      })
      .then(() => this.#scheduleHeartbeat())
      .catch(() => this.#scheduleHeartbeat())
      .finally(() => {
        this.#inFlight = null
        if (this.#dirty) this.#scheduleFlush()
      })
    await this.#inFlight
  }

  async dispose(): Promise<void> {
    if (this.#destroyed) return
    await this.flush()
    this.#destroyed = true
    this.#clearThrottle()
    this.#clearHeartbeat()
    this.#unsubscribe()
    this.#awareness.off('update', this.#onAwarenessUpdate)
    const clientId = this.#awareness.doc.clientID
    this.#awareness.destroy()
    await this.backend
      .releaseAwareness({
        resourceId: this.resourceId,
        clientId,
        leaseId: this.#leaseId,
      })
      .catch(() => undefined)
  }

  readonly #apply = (snapshot: NoteAwarenessSnapshot) => {
    if (this.#destroyed) return
    if (snapshot.status !== 'ready') {
      this.#replaceRemoteEntries([])
      return
    }
    this.#replaceRemoteEntries(snapshot.entries)
  }

  #replaceRemoteEntries(
    entries: ReadonlyArray<{
      clientId: number
      memberId: CampaignMemberId
      state: ArrayBuffer
    }>,
  ): void {
    const localClientId = this.#awareness.doc.clientID
    const currentRemoteClientIds = new Set<number>()
    for (const entry of entries) {
      if (entry.clientId === localClientId) continue
      currentRemoteClientIds.add(entry.clientId)
      this.#memberIds.set(entry.clientId, entry.memberId)
      applyAwarenessUpdate(this.#awareness, new Uint8Array(entry.state), REMOTE_AWARENESS_UPDATE)
    }

    const removedClientIds = [...this.#knownRemoteClientIds].filter(
      (clientId) => !currentRemoteClientIds.has(clientId),
    )
    if (removedClientIds.length > 0) {
      removeAwarenessStates(this.#awareness, removedClientIds, REMOTE_AWARENESS_UPDATE)
      for (const clientId of removedClientIds) this.#memberIds.delete(clientId)
    }
    this.#knownRemoteClientIds = currentRemoteClientIds
    this.changed()
  }

  readonly #onAwarenessUpdate = (
    update: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    if (this.#destroyed || origin === REMOTE_AWARENESS_UPDATE) return
    const clientId = this.#awareness.doc.clientID
    if (!update.added.includes(clientId) && !update.updated.includes(clientId)) return
    this.#dirty = true
    this.#scheduleFlush()
    this.changed()
  }

  #scheduleFlush(): void {
    if (this.#destroyed || this.#throttleTimer) return
    this.#throttleTimer = setTimeout(() => {
      this.#throttleTimer = null
      void this.flush()
    }, AWARENESS_THROTTLE_MS)
  }

  #scheduleHeartbeat(): void {
    this.#clearHeartbeat()
    if (this.#destroyed) return
    this.#heartbeatTimer = setTimeout(() => {
      this.#heartbeatTimer = null
      this.#dirty = true
      void this.flush()
    }, AWARENESS_HEARTBEAT_MS)
  }

  #clearThrottle(): void {
    if (this.#throttleTimer) clearTimeout(this.#throttleTimer)
    this.#throttleTimer = null
  }

  #clearHeartbeat(): void {
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer)
    this.#heartbeatTimer = null
  }
}

export function createLiveNoteAwareness(
  document: Y.Doc,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
  user: NoteCollaborationUser,
  backend: LiveNoteAwarenessBackend,
  changed: () => void,
) {
  return new LiveNoteAwareness(document, resourceId, memberId, user, backend, changed)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}
