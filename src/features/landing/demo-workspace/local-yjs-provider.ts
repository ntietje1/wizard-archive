import type * as Y from 'yjs'
import { ObservableV2 } from 'lib0/observable'
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness'

type LocalYjsProviderEvents = {
  sync: (synced: boolean) => void
}

const destroyedProviders = new WeakSet<LocalYjsProvider>()

export class LocalYjsProvider extends ObservableV2<LocalYjsProviderEvents> {
  readonly awareness: Awareness

  constructor(readonly doc: Y.Doc) {
    super()
    this.awareness = new Awareness(doc)
    queueMicrotask(() => {
      if (!destroyedProviders.has(this)) {
        this.emit('sync', [true])
      }
    })
  }
}

export function destroyLocalYjsProvider(provider: LocalYjsProvider) {
  destroyedProviders.add(provider)
  removeAwarenessStates(provider.awareness, [provider.doc.clientID], 'local-disconnect')
  provider.awareness.destroy()
  provider.destroy()
}
