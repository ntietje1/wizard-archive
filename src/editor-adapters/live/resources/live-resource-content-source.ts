import * as Y from 'yjs'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ContentSessionState,
  ResourceContentSource,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  FileResourceContent,
  MapResourceContent,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { createResourceWatchStore } from './resource-watch-store'

type ResourceContentSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type ResourceContentKind = 'file' | 'map' | 'canvas'
type ResourceContent = FileResourceContent | MapResourceContent | Y.Doc
type ResourceContentState = ContentSessionState<null, ResourceContent>
type ResourceContentStore = ReturnType<
  typeof createResourceWatchStore<ResourceContentSnapshot, ResourceContentState>
>

export type LiveResourceContentBackend = Readonly<{
  watch(resourceId: ResourceId, apply: (snapshot: ResourceContentSnapshot) => void): () => void
}>

class LiveResourceContentSource implements ResourceContentSource<null, ResourceContent> {
  readonly #store: ResourceContentStore
  readonly #disposers = new Map<ResourceId, () => void>()

  constructor(
    private readonly kind: ResourceContentKind,
    backend: LiveResourceContentBackend,
  ) {
    this.#store = createResourceWatchStore(backend.watch, (resourceId, snapshot) =>
      this.#apply(resourceId, snapshot),
    )
  }

  get(resourceId: ResourceId): ResourceContentState {
    return this.#store.get(resourceId) ?? { status: 'loading' }
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  dispose(): void {
    this.#store.dispose()
    for (const dispose of this.#disposers.values()) dispose()
    this.#disposers.clear()
  }

  #apply(resourceId: ResourceId, snapshot: ResourceContentSnapshot): void {
    switch (snapshot.status) {
      case 'initializing':
        try {
          this.#setState(resourceId, {
            status: 'initializing',
            operationId: assertDomainId(DOMAIN_ID_KIND.operation, snapshot.operationId),
            local: null,
          })
        } catch {
          this.#setState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
        }
        return
      case 'unavailable':
      case 'integrity_error':
        this.#setState(resourceId, snapshot)
        return
      case 'ready':
        if (snapshot.kind !== this.kind) {
          this.#setState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
          return
        }
        let version
        try {
          version = assertVersionStamp(snapshot.version)
        } catch {
          this.#setState(resourceId, { status: 'integrity_error', issue: 'version_mismatch' })
          return
        }
        try {
          if (snapshot.kind === 'file') {
            this.#setState(resourceId, { status: 'ready', content: snapshot.content, version })
            return
          }
          if (snapshot.kind === 'map') {
            this.#setState(resourceId, {
              status: 'ready',
              content: {
                ...snapshot.content,
                pins: snapshot.content.pins.map((pin) => ({
                  ...pin,
                  id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.id),
                  targetResourceId: assertDomainId(DOMAIN_ID_KIND.resource, pin.targetResourceId),
                })),
              },
              version,
            })
            return
          }
          const doc = new Y.Doc()
          Y.applyUpdate(doc, new Uint8Array(snapshot.update))
          this.#setState(resourceId, { status: 'ready', content: doc, version }, () =>
            doc.destroy(),
          )
        } catch {
          this.#setState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
        }
    }
  }

  #setState(resourceId: ResourceId, state: ResourceContentState, dispose?: () => void): void {
    this.#disposers.get(resourceId)?.()
    this.#disposers.delete(resourceId)
    if (dispose) this.#disposers.set(resourceId, dispose)
    this.#store.set(resourceId, state)
  }
}

export function createLiveResourceContentSource(
  kind: 'file',
  backend: LiveResourceContentBackend,
): ResourceContentSource<null, FileResourceContent> & { dispose(): void }
export function createLiveResourceContentSource(
  kind: 'map',
  backend: LiveResourceContentBackend,
): ResourceContentSource<null, MapResourceContent> & { dispose(): void }
export function createLiveResourceContentSource(
  kind: 'canvas',
  backend: LiveResourceContentBackend,
): ResourceContentSource<null, Y.Doc> & { dispose(): void }
export function createLiveResourceContentSource(
  kind: ResourceContentKind,
  backend: LiveResourceContentBackend,
) {
  const source = new LiveResourceContentSource(kind, backend)
  return {
    dispose: () => source.dispose(),
    get: (resourceId: ResourceId) => source.get(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      source.subscribe(resourceId, listener),
  }
}
