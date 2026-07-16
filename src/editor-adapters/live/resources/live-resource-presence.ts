import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  modifyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import * as Y from 'yjs'
import type {
  CollaborationUser,
  ContentCollaboration,
  SessionAwareness,
} from '@wizard-archive/editor/resources/content-session-contract'
import { generateUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

type PresenceEntry = Readonly<{
  clientId: number
  memberId: CampaignMemberId
  state: ArrayBuffer
  user: CollaborationUser
}>
type PresenceSnapshot =
  | Readonly<{ status: 'ready'; entries: ReadonlyArray<PresenceEntry> }>
  | Readonly<{ status: 'unavailable'; reason: string }>
type PresenceResult =
  | Readonly<{ status: 'active' }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'rejected'; reason: string }>

export type LiveResourcePresenceBackend = Readonly<{
  heartbeatPresence(args: {
    resourceId: ResourceId
    clientId: number
    sessionId: string
  }): Promise<
    | Readonly<{ status: 'active'; roomToken: string; sessionToken: string }>
    | Readonly<{ status: 'unavailable' }>
    | Readonly<{ status: 'rejected'; reason: string }>
  >
  updatePresence(args: {
    resourceId: ResourceId
    clientId: number
    state: ArrayBuffer
  }): Promise<PresenceResult>
  watchPresence(
    resourceId: ResourceId,
    roomToken: string,
    apply: (snapshot: PresenceSnapshot) => void,
  ): () => void
  disconnectPresence(args: {
    resourceId: ResourceId
    sessionToken: string
  }): Promise<Readonly<{ status: 'released' | 'unavailable' }>>
}>

const REMOTE_UPDATE = Symbol('remote-resource-presence-update')
const UPDATE_INTERVAL_MS = 250
const HEARTBEAT_INTERVAL_MS = 10_000

class LiveResourcePresence {
  readonly collaboration: ContentCollaboration
  readonly #awareness: Awareness
  readonly #memberIds = new Map<number, CampaignMemberId>()
  readonly #sessionId = generateUuidV7()
  #available = false
  #connectRequest: Promise<void> | null = null
  #disposeRequest: Promise<void> | null = null
  #heartbeatTimer: ReturnType<typeof setInterval>
  #pendingState: ArrayBuffer | null = null
  #roomToken: string | null = null
  #sendRequest: Promise<void> | null = null
  #sessionToken: string | null = null
  #status: 'running' | 'stopped' | 'disposed' = 'running'
  #unsubscribe: (() => void) | null = null
  #updateTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    document: Y.Doc,
    private readonly resourceId: ResourceId,
    memberId: CampaignMemberId,
    user: CollaborationUser,
    private readonly backend: LiveResourcePresenceBackend,
    private readonly collaboratorsChanged: () => void,
  ) {
    this.#awareness = new Awareness(document)
    this.collaboration = { provider: { awareness: this.#awareness }, user }
    this.#memberIds.set(document.clientID, memberId)
    this.#awareness.on('update', this.#onAwarenessUpdate)
    this.#awareness.setLocalStateField('user', user)
    this.#heartbeatTimer = setInterval(() => void this.#connect(), HEARTBEAT_INTERVAL_MS)
    void this.#connect()
  }

  get awareness(): SessionAwareness {
    return this.#available
      ? { status: 'available', collaboratorIds: [...new Set(this.#memberIds.values())] }
      : { status: 'unavailable' }
  }

  async flush(): Promise<void> {
    this.#clearUpdateTimer()
    if (this.#connectRequest) await this.#connectRequest
    if (this.#sendRequest) {
      await this.#sendRequest
      if (this.#pendingState) await this.flush()
      return
    }
    if (!this.#available || !this.#pendingState) return

    const state = this.#pendingState
    this.#pendingState = null
    const request = this.backend
      .updatePresence({
        resourceId: this.resourceId,
        clientId: this.#awareness.doc.clientID,
        state,
      })
      .then((result) => {
        if (result.status !== 'active') this.#stop()
      })
      .catch(() => {
        this.#pendingState ??= state
        this.#setAvailable(false)
      })
      .finally(() => {
        if (this.#sendRequest === request) this.#sendRequest = null
        if (this.#pendingState && this.#available) this.#scheduleUpdate()
      })
    this.#sendRequest = request
    await request
  }

  dispose(): Promise<void> {
    this.#disposeRequest ??= this.#dispose()
    return this.#disposeRequest
  }

  async #dispose(): Promise<void> {
    this.#status = 'disposed'
    this.#awareness.off('update', this.#onAwarenessUpdate)
    clearInterval(this.#heartbeatTimer)
    this.#clearUpdateTimer()
    this.#unsubscribe?.()
    this.#unsubscribe = null
    if (this.#connectRequest) await this.#connectRequest
    await this.flush()
    this.#awareness.destroy()
    if (this.#sessionToken) {
      await this.backend
        .disconnectPresence({ resourceId: this.resourceId, sessionToken: this.#sessionToken })
        .catch(() => undefined)
    }
  }

  #connect(): Promise<void> {
    if (this.#status !== 'running') return Promise.resolve()
    this.#connectRequest ??= this.#connectOnce().finally(() => {
      this.#connectRequest = null
    })
    return this.#connectRequest
  }

  async #connectOnce(): Promise<void> {
    try {
      const result = await this.backend.heartbeatPresence({
        resourceId: this.resourceId,
        clientId: this.#awareness.doc.clientID,
        sessionId: this.#sessionId,
      })
      if (result.status !== 'active') {
        this.#stop()
        return
      }
      this.#sessionToken = result.sessionToken
      if (this.#status !== 'running') return
      if (this.#roomToken !== result.roomToken) {
        this.#unsubscribe?.()
        this.#roomToken = result.roomToken
        this.#unsubscribe = this.backend.watchPresence(
          this.resourceId,
          result.roomToken,
          this.#apply,
        )
      }
      this.#setAvailable(true)
      void this.flush()
    } catch {
      this.#setAvailable(false)
    }
  }

  readonly #apply = (snapshot: PresenceSnapshot) => {
    if (this.#status !== 'running') return
    if (snapshot.status !== 'ready') {
      this.#setAvailable(false)
      if (this.#replaceRemoteEntries([])) this.collaboratorsChanged()
      return
    }
    if (this.#replaceRemoteEntries(snapshot.entries)) this.collaboratorsChanged()
  }

  #replaceRemoteEntries(entries: ReadonlyArray<PresenceEntry>): boolean {
    const localClientId = this.#awareness.doc.clientID
    const current = new Set<number>()
    let changed = false
    for (const entry of entries) {
      if (entry.clientId === localClientId) continue
      const update = authenticatePresenceEntry(entry)
      if (!update) continue
      try {
        applyAwarenessUpdate(this.#awareness, update, REMOTE_UPDATE)
      } catch {
        continue
      }
      current.add(entry.clientId)
      if (this.#memberIds.get(entry.clientId) !== entry.memberId) changed = true
      this.#memberIds.set(entry.clientId, entry.memberId)
    }
    const removed = [...this.#memberIds.keys()].filter(
      (clientId) => clientId !== localClientId && !current.has(clientId),
    )
    if (removed.length > 0) {
      changed = true
      removeAwarenessStates(this.#awareness, removed, REMOTE_UPDATE)
      for (const clientId of removed) {
        // Presence reconnects may replay the same awareness clock after an explicit disconnect.
        this.#awareness.meta.delete(clientId)
        this.#memberIds.delete(clientId)
      }
    }
    return changed
  }

  readonly #onAwarenessUpdate = (
    update: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    if (this.#status !== 'running' || origin === REMOTE_UPDATE) return
    const clientId = this.#awareness.doc.clientID
    if (!update.added.includes(clientId) && !update.updated.includes(clientId)) return
    this.#pendingState = toArrayBuffer(encodeAwarenessUpdate(this.#awareness, [clientId]))
    this.#scheduleUpdate()
  }

  #scheduleUpdate(): void {
    if (this.#updateTimer || this.#status !== 'running') return
    this.#updateTimer = setTimeout(() => {
      this.#updateTimer = null
      void this.flush()
    }, UPDATE_INTERVAL_MS)
  }

  #stop(): void {
    if (this.#status !== 'running') return
    this.#status = 'stopped'
    this.#pendingState = null
    clearInterval(this.#heartbeatTimer)
    this.#clearUpdateTimer()
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.#roomToken = null
    this.#replaceRemoteEntries([])
    this.#setAvailable(false)
  }

  #setAvailable(available: boolean): void {
    if (this.#available === available) return
    this.#available = available
    this.collaboratorsChanged()
  }

  #clearUpdateTimer(): void {
    if (this.#updateTimer) clearTimeout(this.#updateTimer)
    this.#updateTimer = null
  }
}

export function createLiveResourcePresence(
  document: Y.Doc,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
  user: CollaborationUser,
  backend: LiveResourcePresenceBackend,
  collaboratorsChanged: () => void,
) {
  return new LiveResourcePresence(
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

function authenticatePresenceEntry(entry: PresenceEntry): Uint8Array | null {
  const document = new Y.Doc()
  const awareness = new Awareness(document)
  try {
    awareness.setLocalState(null)
    applyAwarenessUpdate(awareness, new Uint8Array(entry.state), null)
    const states = [...awareness.getStates()]
    if (states.length !== 1 || states[0]?.[0] !== entry.clientId || states[0][1] === null) {
      return null
    }
    return modifyAwarenessUpdate(new Uint8Array(entry.state), (state) => ({
      ...state,
      memberId: entry.memberId,
      user: entry.user,
    }))
  } catch {
    return null
  } finally {
    awareness.destroy()
    document.destroy()
  }
}
