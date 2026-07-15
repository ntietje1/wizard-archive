import type { ResourceId } from './domain-id'
import type { ContentSessionState, ResourceContentSource } from './content-session-contract'

export class MutableResourceContentSource<TLocal, TReady> implements ResourceContentSource<
  TLocal,
  TReady
> {
  readonly #listeners = new Map<ResourceId, Set<() => void>>()
  readonly #states = new Map<ResourceId, ContentSessionState<TLocal, TReady>>()

  get(resourceId: ResourceId): ContentSessionState<TLocal, TReady> {
    return this.#states.get(resourceId) ?? { status: 'loading' }
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    const listeners = this.#listeners.get(resourceId) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(resourceId, listeners)
    return () => listeners.delete(listener)
  }

  set(resourceId: ResourceId, state: ContentSessionState<TLocal, TReady>): void {
    this.#states.set(resourceId, state)
    for (const listener of this.#listeners.get(resourceId) ?? []) listener()
  }

  dispose(): void {
    this.#listeners.clear()
    this.#states.clear()
  }
}
