import * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type { YjsDocumentId } from 'convex/yjsSync/functions/types'
import { logger } from '~/shared/utils/logger'

type AwarenessEntry = {
  clientId: number
  state: ArrayBuffer
  updatedAt: number
}

type UpdateEntry = {
  seq: number
  update: ArrayBuffer
}

type ProviderEvents = {
  sync: (synced: boolean) => void
}

export type ConvexYjsProviderConfig = {
  pushUpdate: (args: { documentId: string; update: ArrayBuffer }) => Promise<{ seq: number }>
  pushAwareness: (args: {
    documentId: string
    clientId: number
    state: ArrayBuffer
  }) => Promise<null>
  removeAwareness: (args: { documentId: string; clientId: number }) => Promise<null>
}

function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength) {
    return uint8.buffer as ArrayBuffer
  }
  return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer
}

const UPDATE_DEBOUNCE_MS = 50
const UPDATE_MAX_BATCH_MS = 200
const AWARENESS_THROTTLE_MS = 16

export class ConvexYjsProvider extends ObservableV2<ProviderEvents> {
  doc: Y.Doc
  awareness: Awareness
  synced = false
  lastAppliedSeq = -1

  private documentId: YjsDocumentId
  private config: ConvexYjsProviderConfig
  private knownRemoteClientIds = new Set<number>()
  private destroyed = false
  private _writable = false
  private pendingUpdates: Array<Uint8Array> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  private pushInFlight = false
  private pushInFlightPromise: Promise<void> = Promise.resolve()
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null
  private awarenessInFlight = false
  private awarenessInFlightPromise: Promise<void> = Promise.resolve()
  private awarenessDirty = false

  constructor(doc: Y.Doc, documentId: YjsDocumentId, config: ConvexYjsProviderConfig) {
    super()
    this.doc = doc
    this.documentId = documentId
    this.config = config
    this.awareness = new Awareness(doc)

    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)
  }

  set writable(value: boolean) {
    if (this._writable === value) return

    if (!value) {
      void this.flushUpdates()
      this._writable = false
      this.clearUpdateTimers()
    } else {
      this._writable = true
    }
  }

  setUser(user: { name: string; color: string }) {
    this.awareness.setLocalStateField('user', user)
  }

  applyRemoteUpdates(updates: Array<UpdateEntry>) {
    if (this.destroyed) return

    let applied = false
    for (const entry of updates) {
      if (entry.seq > this.lastAppliedSeq) {
        Y.applyUpdate(this.doc, new Uint8Array(entry.update), this)
        this.lastAppliedSeq = entry.seq
        applied = true
      }
    }

    if (applied && !this.synced) {
      this.synced = true
      this.emit('sync', [true])
    }
  }

  applyRemoteAwareness(entries: Array<AwarenessEntry>) {
    if (this.destroyed) return

    const currentRemoteIds = new Set<number>()
    for (const entry of entries) {
      currentRemoteIds.add(entry.clientId)
      if (entry.clientId !== this.doc.clientID) {
        applyAwarenessUpdate(this.awareness, new Uint8Array(entry.state), this)
      }
    }

    const removedIds = [...this.knownRemoteClientIds].filter(
      (id) => !currentRemoteIds.has(id) && id !== this.doc.clientID,
    )
    if (removedIds.length > 0) {
      removeAwarenessStates(this.awareness, removedIds, this)
    }

    this.knownRemoteClientIds = currentRemoteIds
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true

    this.clearAwarenessTimer()

    const teardown = async () => {
      if (this._writable) {
        await this.flushUpdates()
      }

      await this.flushAwareness()

      this.config
        .removeAwareness({
          documentId: this.documentId,
          clientId: this.doc.clientID,
        })
        .catch(() => {})
    }

    teardown()
      .catch(() => {})
      .finally(() => {
        removeAwarenessStates(this.awareness, [this.doc.clientID], 'local-disconnect')

        this.doc.off('update', this.handleDocUpdate)
        this.awareness.off('update', this.handleAwarenessUpdate)
        this.awareness.destroy()

        super.destroy()
      })
  }

  // -- Document update batching --

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.destroyed || !this._writable) return
    this.pendingUpdates.push(update)

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.flushUpdates(), UPDATE_DEBOUNCE_MS)

    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => this.flushUpdates(), UPDATE_MAX_BATCH_MS)
    }
  }

  private flushUpdates(): Promise<void> {
    this.clearUpdateTimers()
    if (this.pushInFlight) return this.pushInFlightPromise
    if (this.pendingUpdates.length === 0) return Promise.resolve()

    const merged =
      this.pendingUpdates.length === 1
        ? this.pendingUpdates[0]
        : Y.mergeUpdates(this.pendingUpdates)
    this.pendingUpdates = []

    this.pushInFlight = true
    this.pushInFlightPromise = this.config
      .pushUpdate({
        documentId: this.documentId,
        update: uint8ToArrayBuffer(merged),
      })
      .then(({ seq }) => {
        if (seq > this.lastAppliedSeq) this.lastAppliedSeq = seq
      })
      .catch((err: unknown) => {
        logger.error('[YJS] push failed for', this.documentId, err)
        if (this._writable && !this.destroyed) {
          this.pendingUpdates.unshift(merged)
        }
      })
      .finally(() => {
        this.pushInFlight = false
        if (this.pendingUpdates.length > 0) this.scheduleFlush()
      })
    return this.pushInFlightPromise
  }

  private scheduleFlush() {
    if (this.destroyed || !this._writable) return

    if (!this.debounceTimer) {
      this.debounceTimer = setTimeout(() => this.flushUpdates(), UPDATE_DEBOUNCE_MS)
    }
    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(() => this.flushUpdates(), UPDATE_MAX_BATCH_MS)
    }
  }

  private clearUpdateTimers() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.maxWaitTimer) {
      clearTimeout(this.maxWaitTimer)
      this.maxWaitTimer = null
    }
  }

  // -- Awareness throttling --

  private handleAwarenessUpdate = (
    { added, updated }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    if (origin === this || this.destroyed) return

    const myClientId = this.doc.clientID
    if (!added.includes(myClientId) && !updated.includes(myClientId)) return

    this.scheduleAwarenessFlush()
  }

  private scheduleAwarenessFlush() {
    if (this.awarenessTimer) {
      this.awarenessDirty = true
      return
    }

    void this.flushAwareness()
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = null
      if (this.awarenessDirty) {
        this.awarenessDirty = false
        this.scheduleAwarenessFlush()
      }
    }, AWARENESS_THROTTLE_MS)
  }

  private clearAwarenessTimer() {
    if (this.awarenessTimer) {
      clearTimeout(this.awarenessTimer)
      this.awarenessTimer = null
    }
  }

  private flushAwareness(): Promise<void> {
    this.clearAwarenessTimer()
    if (this.awarenessInFlight) {
      this.awarenessDirty = true
      return this.awarenessInFlightPromise
    }

    const myClientId = this.doc.clientID
    const encoded = encodeAwarenessUpdate(this.awareness, [myClientId])

    this.awarenessInFlight = true
    this.awarenessInFlightPromise = this.config
      .pushAwareness({
        documentId: this.documentId,
        clientId: myClientId,
        state: uint8ToArrayBuffer(encoded),
      })
      .then(() => {})
      .catch((err: unknown) => {
        logger.error('[YJS] awareness push failed for', this.documentId, err)
      })
      .finally(() => {
        this.awarenessInFlight = false
        if (this.awarenessDirty && !this.destroyed) {
          this.awarenessDirty = false
          this.scheduleAwarenessFlush()
        }
      })
    return this.awarenessInFlightPromise
  }
}
