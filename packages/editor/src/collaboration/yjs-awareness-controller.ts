import type * as Y from 'yjs'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type { SidebarItemId } from '../../../../shared/common/ids'
import { uint8ToArrayBuffer } from '../../../../shared/yjs-sync/uint8ToArrayBuffer'
import { AWARENESS_HEARTBEAT_MS } from '../../../../shared/yjs-sync/awareness'
import type {
  AwarenessLeaseResult,
  AwarenessReleaseResult,
} from '../../../../shared/yjs-sync/awareness'
import { formatUuid } from '../types/uuid'
import type { YjsProviderUser } from './yjs-provider'

export type YjsAwarenessEntry = {
  clientId: number
  state: ArrayBuffer
  updatedAt: number
}

export type YjsAwarenessTransport = {
  pushAwareness: (args: {
    documentId: string
    clientId: number
    sessionId: string
    state: ArrayBuffer
  }) => Promise<AwarenessLeaseResult>
  removeAwareness: (args: {
    documentId: string
    clientId: number
    sessionId: string
  }) => Promise<AwarenessReleaseResult>
  reportError: (message: string, error?: unknown) => void
}

type YjsAwarenessControllerState = {
  knownRemoteClientIds: Set<number>
  destroyed: boolean
  throttleTimer: ReturnType<typeof setTimeout> | null
  heartbeatTimer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  inFlightPromise: Promise<void>
  dirty: boolean
}

const AWARENESS_THROTTLE_MS = 16

function createSessionId() {
  try {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through to a locally generated UUID in restricted browser contexts.
  }

  const bytes = new Uint8Array(16)
  if (typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return formatUuid(bytes)
}

export class YjsAwarenessController {
  private state: YjsAwarenessControllerState = {
    knownRemoteClientIds: new Set<number>(),
    destroyed: false,
    throttleTimer: null,
    heartbeatTimer: null,
    inFlight: false,
    inFlightPromise: Promise.resolve(),
    dirty: false,
  }

  readonly awareness: Awareness
  private readonly sessionId: string

  constructor(
    private readonly input: {
      doc: Y.Doc
      documentId: SidebarItemId
      origin: unknown
      transport: YjsAwarenessTransport
    },
  ) {
    this.awareness = new Awareness(input.doc)
    this.sessionId = createSessionId()
  }

  updateUser(user: YjsProviderUser) {
    this.awareness.setLocalStateField('user', user)
  }

  applyRemoteAwareness(entries: Array<YjsAwarenessEntry>) {
    if (this.state.destroyed) return

    const currentRemoteIds = new Set<number>()
    for (const entry of entries) {
      currentRemoteIds.add(entry.clientId)
      if (entry.clientId !== this.input.doc.clientID) {
        applyAwarenessUpdate(this.awareness, new Uint8Array(entry.state), this.input.origin)
      }
    }

    const removedIds = [...this.state.knownRemoteClientIds].filter(
      (id) => !currentRemoteIds.has(id) && id !== this.input.doc.clientID,
    )
    if (removedIds.length > 0) {
      removeAwarenessStates(this.awareness, removedIds, this.input.origin)
    }

    this.state.knownRemoteClientIds = currentRemoteIds
  }

  handleLocalAwarenessUpdate(
    { added, updated }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) {
    if (origin === this.input.origin || this.state.destroyed) return

    const myClientId = this.input.doc.clientID
    if (!added.includes(myClientId) && !updated.includes(myClientId)) return

    this.scheduleFlush()
  }

  destroy(): Promise<void> {
    this.state.destroyed = true
    this.clearThrottleTimer()
    this.clearHeartbeatTimer()

    return this.flushAwareness({ flushQueued: true })
      .then(() =>
        this.input.transport.removeAwareness({
          documentId: this.input.documentId,
          clientId: this.input.doc.clientID,
          sessionId: this.sessionId,
        }),
      )
      .then(() => undefined)
      .catch(() => {})
      .finally(() => {
        removeAwarenessStates(this.awareness, [this.input.doc.clientID], 'local-disconnect')
        this.awareness.destroy()
      })
  }

  private clearThrottleTimer() {
    if (this.state.throttleTimer) {
      clearTimeout(this.state.throttleTimer)
      this.state.throttleTimer = null
    }
  }

  private clearHeartbeatTimer() {
    if (this.state.heartbeatTimer) {
      clearTimeout(this.state.heartbeatTimer)
      this.state.heartbeatTimer = null
    }
  }

  private flushAwareness({ flushQueued = false }: { flushQueued?: boolean } = {}): Promise<void> {
    this.clearThrottleTimer()
    if (this.state.inFlight) {
      this.state.dirty = true
      if (flushQueued) {
        return this.state.inFlightPromise.then(() => {
          if (!this.state.dirty) return
          this.state.dirty = false
          return this.flushAwareness({ flushQueued })
        })
      }
      return this.state.inFlightPromise
    }

    const myClientId = this.input.doc.clientID
    const encoded = encodeAwarenessUpdate(this.awareness, [myClientId])
    this.clearHeartbeatTimer()

    this.state.inFlight = true
    this.state.inFlightPromise = this.input.transport
      .pushAwareness({
        documentId: this.input.documentId,
        clientId: myClientId,
        sessionId: this.sessionId,
        state: uint8ToArrayBuffer(encoded),
      })
      .then((result) => {
        if (result.status === 'active') {
          this.scheduleHeartbeat()
          return
        }
        this.input.transport.reportError(
          `Yjs awareness session rejected for ${this.input.documentId}: ${result.reason}`,
        )
      })
      .catch((err: unknown) => {
        this.input.transport.reportError(
          `Yjs awareness push failed for ${this.input.documentId}`,
          err,
        )
        this.scheduleHeartbeat()
      })
      .finally(() => {
        this.state.inFlight = false
        if (this.state.dirty && !this.state.destroyed) {
          this.state.dirty = false
          this.scheduleFlush()
        }
      })
    return this.state.inFlightPromise
  }

  private scheduleFlush() {
    if (this.state.throttleTimer) {
      this.state.dirty = true
      return
    }

    void this.flushAwareness()
    this.state.throttleTimer = setTimeout(() => {
      this.state.throttleTimer = null
      if (this.state.dirty) {
        this.state.dirty = false
        this.scheduleFlush()
      }
    }, AWARENESS_THROTTLE_MS)
  }

  private scheduleHeartbeat() {
    this.clearHeartbeatTimer()
    if (this.state.destroyed) return

    this.state.heartbeatTimer = setTimeout(() => {
      this.state.heartbeatTimer = null
      void this.flushAwareness()
    }, AWARENESS_HEARTBEAT_MS)
  }
}
