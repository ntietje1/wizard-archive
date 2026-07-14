import type { ResourceId } from '../resources/domain-id'
import type * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'

import type { YjsProviderUser } from './yjs-provider'
import { YjsAwarenessController } from './yjs-awareness-controller'
import type { YjsAwarenessEntry, YjsAwarenessTransport } from './yjs-awareness-controller'
import { YjsUpdateSyncController } from './yjs-update-sync-controller'
import type { YjsUpdateSyncEntry, YjsUpdateSyncTransport } from './yjs-update-sync-controller'

type YjsProviderEvents = {
  sync: (synced: boolean) => void
}

type YjsProviderConfig = YjsUpdateSyncTransport &
  YjsAwarenessTransport & {
    requestReset: () => void
  }

export class YjsProvider extends ObservableV2<YjsProviderEvents> {
  doc: Y.Doc
  readonly awareness: YjsAwarenessController['awareness']

  private readonly awarenessController: YjsAwarenessController
  private readonly updateSyncController: YjsUpdateSyncController
  private readonly reportError: YjsProviderConfig['reportError']
  private destroyed = false

  constructor(doc: Y.Doc, documentId: ResourceId, config: YjsProviderConfig) {
    super()
    this.reportError = config.reportError
    this.doc = doc
    this.updateSyncController = new YjsUpdateSyncController({
      doc,
      documentId,
      emitSync: (synced) => this.emit('sync', [synced]),
      origin: this,
      requestReset: config.requestReset,
      transport: config,
    })
    this.awarenessController = new YjsAwarenessController({
      doc,
      documentId,
      origin: this,
      transport: config,
    })
    this.awareness = this.awarenessController.awareness

    this.doc.on('update', this.handleDocUpdate)
    this.awareness.on('update', this.handleAwarenessUpdate)
  }

  get lastAppliedSeq() {
    return this.updateSyncController.lastAppliedSeq
  }

  destroy({ discardPendingUpdates = false }: { discardPendingUpdates?: boolean } = {}) {
    if (this.destroyed) return
    this.destroyed = true
    this.updateSyncController.destroy({ discardPendingUpdates })

    const teardown = async () => {
      await this.flushUpdates()
      await this.awarenessController.destroy()
    }

    teardown()
      .catch((error: unknown) => {
        this.reportError(`Yjs provider teardown failed for ${this.doc.guid}`, error)
      })
      .finally(() => {
        this.doc.off('update', this.handleDocUpdate)
        this.awareness.off('update', this.handleAwarenessUpdate)

        super.destroy()
      })
  }

  setWritable(value: boolean) {
    this.updateSyncController.setWritable(value)
  }

  updateUser(user: YjsProviderUser) {
    this.awarenessController.updateUser(user)
  }

  isApplyingRemoteUpdate() {
    return this.updateSyncController.isApplyingRemoteUpdate()
  }

  applyRemoteUpdates(updates: Array<YjsUpdateSyncEntry>, options?: { sync?: boolean }) {
    this.updateSyncController.applyRemoteUpdates(updates, options)
  }

  applyRemoteAwareness(entries: Array<YjsAwarenessEntry>) {
    this.awarenessController.applyRemoteAwareness(entries)
  }

  flushPendingUpdates() {
    return this.updateSyncController.flushPendingUpdates()
  }

  flushUpdates(): Promise<void> {
    return this.updateSyncController.flushUpdates()
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    this.updateSyncController.queueLocalUpdate(update, origin)
  }

  private handleAwarenessUpdate = (
    update: { added: Array<number>; updated: Array<number>; removed: Array<number> },
    origin: unknown,
  ) => {
    this.awarenessController.handleLocalAwarenessUpdate(update, origin)
  }
}
