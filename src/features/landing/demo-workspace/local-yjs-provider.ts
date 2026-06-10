import type * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness'

type LocalYjsProviderEvents = {
  sync: (synced: boolean) => void
}

export class LocalYjsProvider extends ObservableV2<LocalYjsProviderEvents> {
  readonly awareness: Awareness
  private destroyed = false

  constructor(readonly doc: Y.Doc) {
    super()
    this.awareness = new Awareness(doc)
    queueMicrotask(() => {
      if (!this.destroyed) {
        this.emit('sync', [true])
      }
    })
  }

  override destroy() {
    if (this.destroyed) return

    this.destroyed = true
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'local-disconnect')
    this.awareness.destroy()
    super.destroy()
  }
}
