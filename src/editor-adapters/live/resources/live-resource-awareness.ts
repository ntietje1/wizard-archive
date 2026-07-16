import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type * as Y from 'yjs'
import type {
  ContentCollaboration,
  CollaborationUser,
  SessionAwareness,
} from '@wizard-archive/editor/resources/content-session-contract'
import { generateUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { decodeAuthenticatedResourceAwarenessUpdate } from 'shared/resources/resource-awareness-protocol'

type ResourceAwarenessSnapshot =
  | Readonly<{
      status: 'ready'
      entries: ReadonlyArray<{
        clientId: number
        memberId: CampaignMemberId
        state: ArrayBuffer
      }>
    }>
  | Readonly<{ status: 'unavailable'; reason: string }>

export type LiveResourceAwarenessBackend = Readonly<{
  watchAwareness(
    resourceId: ResourceId,
    apply: (snapshot: ResourceAwarenessSnapshot) => void,
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

const REMOTE_AWARENESS_UPDATE = Symbol('remote-resource-awareness-update')
const AWARENESS_THROTTLE_MS = 16
const AWARENESS_HEARTBEAT_MS = 10_000

class LiveResourceAwareness {
  readonly collaboration: ContentCollaboration
  readonly #awareness: Awareness
  readonly #leaseId = generateUuidV7()
  readonly #memberIds = new Map<number, CampaignMemberId>()
  readonly #unsubscribe: () => void
  #available = false
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
    user: CollaborationUser,
    private readonly backend: LiveResourceAwarenessBackend,
    private readonly collaboratorsChanged: () => void,
  ) {
    this.#awareness = new Awareness(document)
    this.collaboration = { provider: { awareness: this.#awareness }, user }
    this.#awareness.on('update', this.#onAwarenessUpdate)
    this.#unsubscribe = backend.watchAwareness(resourceId, this.#apply)
    this.#memberIds.set(document.clientID, memberId)
    this.#awareness.setLocalStateField('user', user)
  }

  get awareness(): SessionAwareness {
    if (!this.#available) return { status: 'unavailable' }
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
      .then((result) => {
        if (result.status !== 'active') {
          this.#setAvailable(false)
          this.#clearHeartbeat()
          return
        }
        this.#setAvailable(true)
        this.#scheduleHeartbeat()
      })
      .catch(() => {
        this.#setAvailable(false)
        this.#scheduleHeartbeat()
      })
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

  readonly #apply = (snapshot: ResourceAwarenessSnapshot) => {
    if (this.#destroyed) return
    if (snapshot.status !== 'ready') {
      this.#setAvailable(false)
      if (this.#replaceRemoteEntries([])) this.collaboratorsChanged()
      return
    }
    if (this.#replaceRemoteEntries(snapshot.entries)) this.collaboratorsChanged()
  }

  #replaceRemoteEntries(
    entries: ReadonlyArray<{
      clientId: number
      memberId: CampaignMemberId
      state: ArrayBuffer
    }>,
  ): boolean {
    const localClientId = this.#awareness.doc.clientID
    const currentRemoteClientIds = new Set<number>()
    let changed = false
    for (const entry of entries) {
      if (entry.clientId === localClientId) continue
      const decoded = decodeAuthenticatedResourceAwarenessUpdate(
        entry.state,
        entry.clientId,
        entry.memberId,
      )
      if (!decoded) continue
      currentRemoteClientIds.add(entry.clientId)
      if (this.#memberIds.get(entry.clientId) !== entry.memberId) changed = true
      this.#memberIds.set(entry.clientId, entry.memberId)
      applyAwarenessUpdate(this.#awareness, new Uint8Array(entry.state), REMOTE_AWARENESS_UPDATE)
    }

    const removedClientIds = [...this.#knownRemoteClientIds].filter(
      (clientId) => !currentRemoteClientIds.has(clientId),
    )
    if (removedClientIds.length > 0) {
      changed = true
      removeAwarenessStates(this.#awareness, removedClientIds, REMOTE_AWARENESS_UPDATE)
      for (const clientId of removedClientIds) this.#memberIds.delete(clientId)
    }
    this.#knownRemoteClientIds = currentRemoteClientIds
    return changed
  }

  #setAvailable(available: boolean): void {
    if (this.#available === available) return
    this.#available = available
    this.collaboratorsChanged()
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

export function createLiveResourceAwareness(
  document: Y.Doc,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveResourceAwarenessBackend,
  collaboratorsChanged: () => void,
) {
  return new LiveResourceAwareness(
    document,
    resourceId,
    memberId,
    user,
    backend,
    collaboratorsChanged,
  )
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}
