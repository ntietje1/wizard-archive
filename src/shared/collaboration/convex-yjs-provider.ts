import * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import type { YjsDocumentId } from 'shared/yjs-sync/types'
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

type ProviderUser = {
  name: string
  color: string
}

type ProviderEvents = {
  sync: (synced: boolean) => void
}

type ConvexYjsProviderConfig = {
  pushUpdate: (args: { documentId: string; update: ArrayBuffer }) => Promise<{ seq: number }>
  pushAwareness: (args: {
    documentId: string
    clientId: number
    state: ArrayBuffer
  }) => Promise<null>
  removeAwareness: (args: { documentId: string; clientId: number }) => Promise<null>
}

type ConvexYjsProviderState = {
  documentId: YjsDocumentId
  config: ConvexYjsProviderConfig
  knownRemoteClientIds: Set<number>
  destroyed: boolean
  writable: boolean
  synced: boolean
  isApplyingRemoteUpdate: boolean
  pendingUpdates: Array<Uint8Array>
  debounceTimer: ReturnType<typeof setTimeout> | null
  maxWaitTimer: ReturnType<typeof setTimeout> | null
  pushInFlight: boolean
  pushInFlightPromise: Promise<void>
  awarenessTimer: ReturnType<typeof setTimeout> | null
  awarenessInFlight: boolean
  awarenessInFlightPromise: Promise<void>
  awarenessDirty: boolean
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

const providerStates = new WeakMap<ConvexYjsProvider, ConvexYjsProviderState>()

function getProviderState(provider: ConvexYjsProvider): ConvexYjsProviderState {
  const state = providerStates.get(provider)
  if (!state) throw new Error('ConvexYjsProvider state is not initialized')
  return state
}

export function setConvexYjsProviderWritable(provider: ConvexYjsProvider, value: boolean) {
  const state = getProviderState(provider)
  if (state.writable === value) return

  if (!value) {
    void provider.flushUpdates()
    state.writable = false
    clearProviderUpdateTimers(provider)
  } else {
    state.writable = true
  }
}

export function updateConvexYjsProviderUser(provider: ConvexYjsProvider, user: ProviderUser) {
  provider.awareness.setLocalStateField('user', user)
}

export function isConvexYjsProviderApplyingRemoteUpdate(provider: ConvexYjsProvider) {
  return getProviderState(provider).isApplyingRemoteUpdate
}

export function applyConvexYjsProviderRemoteUpdates(
  provider: ConvexYjsProvider,
  updates: Array<UpdateEntry>,
) {
  const state = getProviderState(provider)
  if (state.destroyed) return

  let applied = false
  state.isApplyingRemoteUpdate = true
  try {
    for (const entry of updates) {
      if (entry.seq > provider.lastAppliedSeq) {
        Y.applyUpdate(provider.doc, new Uint8Array(entry.update), provider)
        provider.lastAppliedSeq = entry.seq
        applied = true
      }
    }
  } finally {
    state.isApplyingRemoteUpdate = false
  }

  if (applied && !state.synced) {
    state.synced = true
    provider.emit('sync', [true])
  }
}

export function applyConvexYjsProviderRemoteAwareness(
  provider: ConvexYjsProvider,
  entries: Array<AwarenessEntry>,
) {
  const state = getProviderState(provider)
  if (state.destroyed) return

  const currentRemoteIds = new Set<number>()
  for (const entry of entries) {
    currentRemoteIds.add(entry.clientId)
    if (entry.clientId !== provider.doc.clientID) {
      applyAwarenessUpdate(provider.awareness, new Uint8Array(entry.state), provider)
    }
  }

  const removedIds = [...state.knownRemoteClientIds].filter(
    (id) => !currentRemoteIds.has(id) && id !== provider.doc.clientID,
  )
  if (removedIds.length > 0) {
    removeAwarenessStates(provider.awareness, removedIds, provider)
  }

  state.knownRemoteClientIds = currentRemoteIds
}

export function flushConvexYjsProviderPendingUpdates(provider: ConvexYjsProvider) {
  return flushAllProviderUpdates(provider)
}

function clearProviderUpdateTimers(provider: ConvexYjsProvider) {
  const state = getProviderState(provider)
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer)
    state.debounceTimer = null
  }
  if (state.maxWaitTimer) {
    clearTimeout(state.maxWaitTimer)
    state.maxWaitTimer = null
  }
}

function scheduleProviderFlush(provider: ConvexYjsProvider) {
  const state = getProviderState(provider)
  if (state.destroyed || !state.writable) return

  if (!state.debounceTimer) {
    state.debounceTimer = setTimeout(() => {
      void provider.flushUpdates()
    }, UPDATE_DEBOUNCE_MS)
  }
  if (!state.maxWaitTimer) {
    state.maxWaitTimer = setTimeout(() => {
      void provider.flushUpdates()
    }, UPDATE_MAX_BATCH_MS)
  }
}

function clearProviderAwarenessTimer(provider: ConvexYjsProvider) {
  const state = getProviderState(provider)
  if (state.awarenessTimer) {
    clearTimeout(state.awarenessTimer)
    state.awarenessTimer = null
  }
}

function flushProviderAwareness(provider: ConvexYjsProvider): Promise<void> {
  const state = getProviderState(provider)
  clearProviderAwarenessTimer(provider)
  if (state.awarenessInFlight) {
    state.awarenessDirty = true
    return state.awarenessInFlightPromise
  }

  const myClientId = provider.doc.clientID
  const encoded = encodeAwarenessUpdate(provider.awareness, [myClientId])

  state.awarenessInFlight = true
  state.awarenessInFlightPromise = state.config
    .pushAwareness({
      documentId: state.documentId,
      clientId: myClientId,
      state: uint8ToArrayBuffer(encoded),
    })
    .then(() => {})
    .catch((err: unknown) => {
      logger.error('[YJS] awareness push failed for', state.documentId, err)
    })
    .finally(() => {
      state.awarenessInFlight = false
      if (state.awarenessDirty && !state.destroyed) {
        state.awarenessDirty = false
        scheduleProviderAwarenessFlush(provider)
      }
    })
  return state.awarenessInFlightPromise
}

function scheduleProviderAwarenessFlush(provider: ConvexYjsProvider) {
  const state = getProviderState(provider)
  if (state.awarenessTimer) {
    state.awarenessDirty = true
    return
  }

  void flushProviderAwareness(provider)
  state.awarenessTimer = setTimeout(() => {
    state.awarenessTimer = null
    if (state.awarenessDirty) {
      state.awarenessDirty = false
      scheduleProviderAwarenessFlush(provider)
    }
  }, AWARENESS_THROTTLE_MS)
}

function flushAllProviderUpdates(provider: ConvexYjsProvider): Promise<boolean> {
  return (async () => {
    const state = getProviderState(provider)
    clearProviderUpdateTimers(provider)

    let attempts = 0
    while ((state.pushInFlight || state.pendingUpdates.length > 0) && attempts < 10) {
      attempts += 1
      if (state.pushInFlight) {
        await state.pushInFlightPromise
      } else {
        await provider.flushUpdates()
      }
    }

    if (state.pushInFlight || state.pendingUpdates.length > 0) {
      logger.error('[YJS] flush did not drain all pending updates for', state.documentId)
      return false
    }
    return true
  })()
}

export class ConvexYjsProvider extends ObservableV2<ProviderEvents> {
  doc: Y.Doc
  awareness: Awareness
  lastAppliedSeq = -1

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    const state = getProviderState(this)
    if (origin === this || state.destroyed || !state.writable) return
    state.pendingUpdates.push(update)

    if (state.debounceTimer) clearTimeout(state.debounceTimer)
    state.debounceTimer = setTimeout(() => {
      void this.flushUpdates()
    }, UPDATE_DEBOUNCE_MS)

    if (!state.maxWaitTimer) {
      state.maxWaitTimer = setTimeout(() => {
        void this.flushUpdates()
      }, UPDATE_MAX_BATCH_MS)
    }
  }

  private handleAwarenessUpdate = (
    { added, updated }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    const state = getProviderState(this)
    if (origin === this || state.destroyed) return

    const myClientId = this.doc.clientID
    if (!added.includes(myClientId) && !updated.includes(myClientId)) return

    scheduleProviderAwarenessFlush(this)
  }

  constructor(doc: Y.Doc, documentId: YjsDocumentId, config: ConvexYjsProviderConfig) {
    super()
    this.doc = doc
    this.awareness = new Awareness(doc)
    providerStates.set(this, {
      documentId,
      config,
      knownRemoteClientIds: new Set<number>(),
      destroyed: false,
      writable: false,
      synced: false,
      isApplyingRemoteUpdate: false,
      pendingUpdates: [],
      debounceTimer: null,
      maxWaitTimer: null,
      pushInFlight: false,
      pushInFlightPromise: Promise.resolve(),
      awarenessTimer: null,
      awarenessInFlight: false,
      awarenessInFlightPromise: Promise.resolve(),
      awarenessDirty: false,
    })

    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)
  }

  destroy() {
    const state = getProviderState(this)
    if (state.destroyed) return
    state.destroyed = true

    clearProviderAwarenessTimer(this)

    const teardown = async () => {
      if (state.writable) {
        await this.flushUpdates()
      }

      await flushProviderAwareness(this)

      state.config
        .removeAwareness({
          documentId: state.documentId,
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

  flushUpdates(): Promise<void> {
    const state = getProviderState(this)
    clearProviderUpdateTimers(this)
    if (state.pushInFlight) return state.pushInFlightPromise
    if (state.pendingUpdates.length === 0) return Promise.resolve()

    const merged =
      state.pendingUpdates.length === 1
        ? state.pendingUpdates[0]
        : Y.mergeUpdates(state.pendingUpdates)
    state.pendingUpdates = []

    state.pushInFlight = true
    state.pushInFlightPromise = state.config
      .pushUpdate({
        documentId: state.documentId,
        update: uint8ToArrayBuffer(merged),
      })
      .then(({ seq }) => {
        if (seq > this.lastAppliedSeq) this.lastAppliedSeq = seq
      })
      .catch((err: unknown) => {
        logger.error('[YJS] push failed for', state.documentId, err)
        if (state.writable && !state.destroyed) {
          state.pendingUpdates.unshift(merged)
        }
      })
      .finally(() => {
        state.pushInFlight = false
        if (state.pendingUpdates.length > 0) scheduleProviderFlush(this)
      })
    return state.pushInFlightPromise
  }
}
