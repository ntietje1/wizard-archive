import type { ResourceId } from './domain-id'

export class ResourceSessionStore<TState> {
  readonly #listeners = new Map<ResourceId, Set<() => void>>()
  readonly #states = new Map<ResourceId, TState>()

  constructor(private readonly initialState: TState) {}

  get(resourceId: ResourceId): TState {
    return this.#states.get(resourceId) ?? this.initialState
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    const listeners = this.#listeners.get(resourceId) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(resourceId, listeners)
    return () => listeners.delete(listener)
  }

  set(resourceId: ResourceId, state: TState): void {
    this.#states.set(resourceId, state)
    for (const listener of this.#listeners.get(resourceId) ?? []) listener()
  }

  dispose(): void {
    this.#listeners.clear()
    this.#states.clear()
  }
}
