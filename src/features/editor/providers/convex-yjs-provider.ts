import * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
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

type PushUpdateFn = (args: {
  documentId: Id<'notes'>
  update: ArrayBuffer
}) => Promise<{ seq: number }>
type PushAwarenessFn = (args: {
  documentId: Id<'notes'>
  clientId: number
  state: ArrayBuffer
}) => Promise<null>
type RemoveAwarenessFn = (args: {
  documentId: Id<'notes'>
  clientId: number
}) => Promise<null>

function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength) {
    return uint8.buffer as ArrayBuffer
  }
  return new Uint8Array(uint8).buffer
}

export class ConvexYjsProvider extends ObservableV2<ProviderEvents> {
  doc: Y.Doc
  awareness: Awareness
  private documentId: Id<'notes'>
  private lastAppliedSeq = -1
  private knownRemoteClientIds = new Set<number>()
  private pushUpdateFn: PushUpdateFn | null = null
  private pushAwarenessFn: PushAwarenessFn | null = null
  private removeAwarenessFn: RemoveAwarenessFn | null = null
  private destroyed = false
  synced = false

  constructor(doc: Y.Doc, documentId: Id<'notes'>) {
    super()
    this.doc = doc
    this.documentId = documentId
    this.awareness = new Awareness(doc)

    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)
  }

  setPushUpdate(fn: PushUpdateFn) {
    this.pushUpdateFn = fn
  }

  setPushAwareness(fn: PushAwarenessFn) {
    this.pushAwarenessFn = fn
  }

  setRemoveAwareness(fn: RemoveAwarenessFn) {
    this.removeAwarenessFn = fn
  }

  applyRemoteUpdates(updates: Array<UpdateEntry>) {
    if (this.destroyed) return

    const sorted = [...updates].sort((a, b) => a.seq - b.seq)

    let applied = false
    for (const entry of sorted) {
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

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || this.destroyed) return
    this.pushUpdateFn?.({
      documentId: this.documentId,
      update: uint8ToArrayBuffer(update),
    }).catch((err: unknown) => {
      console.error('Failed to push Yjs update for', this.documentId, err)
    })
  }

  private handleAwarenessUpdate = (
    {
      added,
      updated,
    }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    if (origin === this || this.destroyed) return

    const myClientId = this.doc.clientID
    const changed = [...added, ...updated].filter((id) => id === myClientId)
    if (changed.length === 0) return

    const encoded = encodeAwarenessUpdate(this.awareness, [myClientId])
    this.pushAwarenessFn?.({
      documentId: this.documentId,
      clientId: myClientId,
      state: uint8ToArrayBuffer(encoded),
    }).catch((err: unknown) => {
      console.error('Failed to push awareness for', this.documentId, err)
    })
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true

    this.removeAwarenessFn?.({
      documentId: this.documentId,
      clientId: this.doc.clientID,
    })

    removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      'local-disconnect',
    )

    this.doc.off('update', this.handleDocUpdate)
    this.awareness.off('update', this.handleAwarenessUpdate)
    this.awareness.destroy()

    super.destroy()
  }
}
