import * as Y from 'yjs'
import type { SidebarItemId } from '../../../../shared/common/ids'
import { uint8ToArrayBuffer } from '../../../../shared/yjs-sync/uint8ToArrayBuffer'

export type YjsUpdateSyncEntry = {
  revision: number
  seq: number
  update: ArrayBuffer
}

export type YjsUpdateSyncTransport = {
  pushUpdate: (args: {
    documentId: string
    revision: number
    update: ArrayBuffer
  }) => Promise<
    { status: 'accepted'; seq: number } | { status: 'rejected'; reason: 'revision_mismatch' }
  >
  reportError: (message: string, error?: unknown) => void
}

type YjsUpdateSyncControllerState = {
  destroyed: boolean
  writable: boolean
  synced: boolean
  isApplyingRemoteUpdate: boolean
  pendingUpdates: Array<Uint8Array>
  debounceTimer: ReturnType<typeof setTimeout> | null
  maxWaitTimer: ReturnType<typeof setTimeout> | null
  pushInFlight: boolean
  pushInFlightPromise: Promise<void>
}

const UPDATE_DEBOUNCE_MS = 50
const UPDATE_MAX_BATCH_MS = 200
const UPDATE_RETRY_INITIAL_MS = 100
const UPDATE_RETRY_MAX_MS = 5_000

export class YjsUpdateSyncController {
  private lastAppliedSeqValue = -1
  private revisionValue: number | null = null
  private retryDelayMs = 0
  private state: YjsUpdateSyncControllerState = {
    destroyed: false,
    writable: false,
    synced: false,
    isApplyingRemoteUpdate: false,
    pendingUpdates: [],
    debounceTimer: null,
    maxWaitTimer: null,
    pushInFlight: false,
    pushInFlightPromise: Promise.resolve(),
  }

  constructor(
    private readonly input: {
      doc: Y.Doc
      documentId: SidebarItemId
      emitSync: (synced: boolean) => void
      origin: unknown
      requestReset: () => void
      transport: YjsUpdateSyncTransport
    },
  ) {}

  get lastAppliedSeq() {
    return this.lastAppliedSeqValue
  }

  isApplyingRemoteUpdate() {
    return this.state.isApplyingRemoteUpdate
  }

  setWritable(value: boolean) {
    if (this.state.writable === value) return

    if (!value) {
      void this.flushUpdates()
      this.state.writable = false
      this.clearTimers()
    } else {
      this.state.writable = true
    }
  }

  queueLocalUpdate(update: Uint8Array, origin: unknown) {
    if (origin === this.input.origin || this.state.destroyed || !this.state.writable) return
    this.state.pendingUpdates.push(update)
    this.scheduleFlush()
  }

  applyRemoteUpdates(updates: Array<YjsUpdateSyncEntry>, { sync = true }: { sync?: boolean } = {}) {
    if (this.state.destroyed) return

    const revision = updates[0]?.revision
    if (revision !== undefined) {
      if (updates.some((entry) => entry.revision !== revision)) {
        this.input.transport.reportError(
          `Yjs update page mixed document revisions for ${this.input.documentId}`,
        )
        this.requestReset()
        return
      }
      if (this.revisionValue !== null && revision !== this.revisionValue) {
        this.requestReset()
        return
      }
      this.revisionValue = revision
    }

    this.state.isApplyingRemoteUpdate = true
    try {
      for (const entry of updates) {
        if (entry.seq > this.lastAppliedSeqValue) {
          Y.applyUpdate(this.input.doc, new Uint8Array(entry.update), this.input.origin)
          this.lastAppliedSeqValue = entry.seq
        }
      }
    } finally {
      this.state.isApplyingRemoteUpdate = false
    }

    if (sync && !this.state.synced) {
      this.state.synced = true
      this.input.emitSync(true)
    }
  }

  flushPendingUpdates() {
    return this.flushAllUpdates()
  }

  flushUpdates(): Promise<void> {
    this.clearTimers()
    if (this.state.pushInFlight) return this.state.pushInFlightPromise
    if (this.state.pendingUpdates.length === 0) return Promise.resolve()

    const merged =
      this.state.pendingUpdates.length === 1
        ? this.state.pendingUpdates[0]
        : Y.mergeUpdates(this.state.pendingUpdates)
    this.state.pendingUpdates = []

    this.state.pushInFlight = true
    this.state.pushInFlightPromise = this.input.transport
      .pushUpdate({
        documentId: this.input.documentId,
        revision: this.revisionValue ?? 0,
        update: uint8ToArrayBuffer(merged),
      })
      .then((result) => {
        if (result.status === 'rejected') {
          this.requestReset()
          return
        }
        this.retryDelayMs = 0
      })
      .catch((err: unknown) => {
        this.input.transport.reportError(`Yjs update push failed for ${this.input.documentId}`, err)
        this.state.pendingUpdates.unshift(merged)
        this.retryDelayMs = Math.min(
          this.retryDelayMs === 0 ? UPDATE_RETRY_INITIAL_MS : this.retryDelayMs * 2,
          UPDATE_RETRY_MAX_MS,
        )
      })
      .finally(() => {
        this.state.pushInFlight = false
        if (this.state.pendingUpdates.length > 0) {
          if (this.retryDelayMs > 0) {
            this.scheduleRetry()
          } else {
            this.scheduleFlush()
          }
        }
      })
    return this.state.pushInFlightPromise
  }

  destroy({ discardPendingUpdates = false }: { discardPendingUpdates?: boolean } = {}) {
    this.state.destroyed = true
    this.clearTimers()
    if (discardPendingUpdates) this.state.pendingUpdates = []
  }

  private requestReset() {
    if (this.state.destroyed) return
    this.state.writable = false
    this.state.pendingUpdates = []
    this.clearTimers()
    this.input.requestReset()
  }

  private clearTimers() {
    if (this.state.debounceTimer) {
      clearTimeout(this.state.debounceTimer)
      this.state.debounceTimer = null
    }
    if (this.state.maxWaitTimer) {
      clearTimeout(this.state.maxWaitTimer)
      this.state.maxWaitTimer = null
    }
  }

  private scheduleFlush() {
    if (this.state.destroyed || !this.state.writable) return

    if (this.state.debounceTimer) clearTimeout(this.state.debounceTimer)
    this.state.debounceTimer = setTimeout(() => {
      void this.flushUpdates()
    }, UPDATE_DEBOUNCE_MS)

    if (!this.state.maxWaitTimer) {
      this.state.maxWaitTimer = setTimeout(() => {
        void this.flushUpdates()
      }, UPDATE_MAX_BATCH_MS)
    }
  }

  private scheduleRetry() {
    if (this.state.destroyed || !this.state.writable || this.state.debounceTimer) return

    this.state.debounceTimer = setTimeout(() => {
      void this.flushUpdates()
    }, this.retryDelayMs)
  }

  private flushAllUpdates(): Promise<boolean> {
    return (async () => {
      this.clearTimers()

      let attempts = 0
      while ((this.state.pushInFlight || this.state.pendingUpdates.length > 0) && attempts < 10) {
        attempts += 1
        if (this.state.pushInFlight) {
          await this.state.pushInFlightPromise
        } else {
          await this.flushUpdates()
        }
      }

      if (this.state.pushInFlight || this.state.pendingUpdates.length > 0) {
        this.input.transport.reportError(
          `Yjs flush did not drain all pending updates for ${this.input.documentId}`,
        )
        return false
      }
      return true
    })()
  }
}
