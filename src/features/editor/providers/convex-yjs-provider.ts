import * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { PERSIST_INTERVAL_MS } from 'convex/yjsSync/constants'
import type { Id } from 'convex/_generated/dataModel'

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
  pushUpdate: (args: {
    documentId: Id<'notes'>
    update: ArrayBuffer
  }) => Promise<{ seq: number }>
  pushAwareness: (args: {
    documentId: Id<'notes'>
    clientId: number
    state: ArrayBuffer
  }) => Promise<null>
  removeAwareness: (args: {
    documentId: Id<'notes'>
    clientId: number
  }) => Promise<null>
  persistBlocks: (args: { documentId: Id<'notes'> }) => Promise<null>
}

function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength) {
    return uint8.buffer as ArrayBuffer
  }
  return uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength,
  ) as ArrayBuffer
}

const UPDATE_DEBOUNCE_MS = 50
const UPDATE_MAX_BATCH_MS = 200
const AWARENESS_DEBOUNCE_MS = 100

export class ConvexYjsProvider extends ObservableV2<ProviderEvents> {
  doc: Y.Doc
  awareness: Awareness
  synced = false
  lastAppliedSeq = -1

  private documentId: Id<'notes'>
  private config: ConvexYjsProviderConfig
  private knownRemoteClientIds = new Set<number>()
  private destroyed = false
  private _writable = false
  private pendingUpdates: Array<Uint8Array> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null
  private pushInFlight = false
  private persistTimer: ReturnType<typeof setInterval> | null = null
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null
  private awarenessInFlight = false

  constructor(
    doc: Y.Doc,
    documentId: Id<'notes'>,
    config: ConvexYjsProviderConfig,
  ) {
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
      this.flushUpdates()
      this._writable = false
      this.stopPersistInterval()
      this.clearUpdateTimers()
    } else {
      this._writable = true
      this.startPersistInterval()
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

    this.stopPersistInterval()
    this.clearAwarenessTimer()

    const teardown = async () => {
      if (this._writable) {
        await this.flushUpdates()
        this.persist()
      }

      await this.flushAwareness()

      this.config
        .removeAwareness({
          documentId: this.documentId,
          clientId: this.doc.clientID,
        })
        .catch(() => {})
    }

    teardown().finally(() => {
      removeAwarenessStates(
        this.awareness,
        [this.doc.clientID],
        'local-disconnect',
      )

      this.doc.off('update', this.handleDocUpdate)
      this.awareness.off('update', this.handleAwarenessUpdate)
      this.awareness.destroy()

      super.destroy()
    })
  }

  private persist() {
    this.config.persistBlocks({ documentId: this.documentId }).catch(() => {})
  }

  private startPersistInterval() {
    this.stopPersistInterval()
    this.persistTimer = setInterval(() => this.persist(), PERSIST_INTERVAL_MS)
  }

  private stopPersistInterval() {
    if (this.persistTimer) {
      clearInterval(this.persistTimer)
      this.persistTimer = null
    }
  }

  // -- Document update batching --

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.destroyed || !this._writable) return
    this.pendingUpdates.push(update)

    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(
      () => this.flushUpdates(),
      UPDATE_DEBOUNCE_MS,
    )

    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(
        () => this.flushUpdates(),
        UPDATE_MAX_BATCH_MS,
      )
    }
  }

  private flushUpdates(): Promise<void> {
    this.clearUpdateTimers()
    if (this.pushInFlight) return Promise.resolve()
    if (this.pendingUpdates.length === 0) return Promise.resolve()

    const merged =
      this.pendingUpdates.length === 1
        ? this.pendingUpdates[0]
        : Y.mergeUpdates(this.pendingUpdates)
    this.pendingUpdates = []

    this.pushInFlight = true
    return this.config
      .pushUpdate({
        documentId: this.documentId,
        update: uint8ToArrayBuffer(merged),
      })
      .then(({ seq }) => {
        if (seq > this.lastAppliedSeq) this.lastAppliedSeq = seq
      })
      .catch((err: unknown) => {
        console.error('[YJS] push failed for', this.documentId, err)
        if (this._writable && !this.destroyed) {
          this.pendingUpdates.unshift(merged)
        }
      })
      .finally(() => {
        this.pushInFlight = false
        if (this.pendingUpdates.length > 0) this.scheduleFlush()
      })
  }

  private scheduleFlush() {
    if (this.destroyed || !this._writable) return

    if (!this.debounceTimer) {
      this.debounceTimer = setTimeout(
        () => this.flushUpdates(),
        UPDATE_DEBOUNCE_MS,
      )
    }
    if (!this.maxWaitTimer) {
      this.maxWaitTimer = setTimeout(
        () => this.flushUpdates(),
        UPDATE_MAX_BATCH_MS,
      )
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

  // -- Awareness debouncing --

  private handleAwarenessUpdate = (
    {
      added,
      updated,
    }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    if (origin === this || this.destroyed) return

    const myClientId = this.doc.clientID
    if (!added.includes(myClientId) && !updated.includes(myClientId)) return

    this.scheduleAwarenessFlush()
  }

  private scheduleAwarenessFlush() {
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer)
    this.awarenessTimer = setTimeout(
      () => this.flushAwareness(),
      AWARENESS_DEBOUNCE_MS,
    )
  }

  private clearAwarenessTimer() {
    if (this.awarenessTimer) {
      clearTimeout(this.awarenessTimer)
      this.awarenessTimer = null
    }
  }

  private flushAwareness(): Promise<void> {
    this.clearAwarenessTimer()
    if (this.awarenessInFlight) return Promise.resolve()

    const myClientId = this.doc.clientID
    const encoded = encodeAwarenessUpdate(this.awareness, [myClientId])

    this.awarenessInFlight = true
    return this.config
      .pushAwareness({
        documentId: this.documentId,
        clientId: myClientId,
        state: uint8ToArrayBuffer(encoded),
      })
      .then(() => {})
      .catch((err: unknown) => {
        console.error('[YJS] awareness push failed for', this.documentId, err)
      })
      .finally(() => {
        this.awarenessInFlight = false
      })
  }
}
