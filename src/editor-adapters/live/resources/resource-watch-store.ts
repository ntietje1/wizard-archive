import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ContentSessionState } from '@wizard-archive/editor/resources/content-session-contract'
import { MutableResourceContentSource } from '@wizard-archive/editor/resources/mutable-content-source'

export function createResourceWatchStore<TSnapshot, TLocal, TReady>(
  watch: (resourceId: ResourceId, apply: (snapshot: TSnapshot) => void) => () => void,
  apply: (resourceId: ResourceId, snapshot: TSnapshot) => void,
) {
  const source = new MutableResourceContentSource<TLocal, TReady>()
  const watches = new Map<ResourceId, () => void>()

  const ensure = (resourceId: ResourceId) => {
    if (watches.has(resourceId)) return
    watches.set(
      resourceId,
      watch(resourceId, (snapshot) => apply(resourceId, snapshot)),
    )
  }

  return {
    dispose: () => {
      for (const unsubscribe of watches.values()) unsubscribe()
      watches.clear()
      source.dispose()
    },
    get: (resourceId: ResourceId) => {
      ensure(resourceId)
      return source.get(resourceId)
    },
    set: (resourceId: ResourceId, state: ContentSessionState<TLocal, TReady>) => {
      source.set(resourceId, state)
    },
    subscribe: (resourceId: ResourceId, listener: () => void) => {
      ensure(resourceId)
      return source.subscribe(resourceId, listener)
    },
  }
}
