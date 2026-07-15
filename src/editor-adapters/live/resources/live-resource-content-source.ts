import * as Y from 'yjs'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CanvasSessionSource,
  CanvasSessionState,
  FileContentSource,
  FileContentState,
  MapSessionSource,
  MapSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import { createResourceWatchStore } from './resource-watch-store'

type ResourceContentSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type ResourceContentKind = 'file' | 'map' | 'canvas'
type ResourceContentState = FileContentState | MapSessionState | CanvasSessionState
type ResourceContentStore = ReturnType<
  typeof createResourceWatchStore<ResourceContentSnapshot, ResourceContentState>
>

export type LiveResourceContentBackend = Readonly<{
  watch(resourceId: ResourceId, apply: (snapshot: ResourceContentSnapshot) => void): () => void
}>

class LiveResourceContentSource {
  readonly #store: ResourceContentStore
  readonly #disposers = new Map<ResourceId, () => void>()

  constructor(
    private readonly kind: ResourceContentKind,
    backend: LiveResourceContentBackend,
  ) {
    this.#store = createResourceWatchStore<ResourceContentSnapshot, ResourceContentState>(
      backend.watch,
      (resourceId, snapshot) => this.#apply(resourceId, snapshot),
      { status: 'loading' },
    )
  }

  get(resourceId: ResourceId): ResourceContentState {
    return this.#store.get(resourceId)
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
        this.#applyReady(resourceId, snapshot)
    }
  }

  #applyReady(
    resourceId: ResourceId,
    snapshot: Extract<ResourceContentSnapshot, { status: 'ready' }>,
  ): void {
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
        this.#setState(resourceId, {
          status: 'ready',
          content: {
            ...snapshot.content,
            assetId:
              snapshot.content.assetId === null
                ? null
                : assertDomainId(DOMAIN_ID_KIND.asset, snapshot.content.assetId),
          },
          version,
        })
        return
      }
      if (snapshot.kind === 'map') {
        this.#setState(resourceId, {
          status: 'ready',
          session: {
            content: {
              ...snapshot.content,
              imageAssetId:
                snapshot.content.imageAssetId === null
                  ? null
                  : assertDomainId(DOMAIN_ID_KIND.asset, snapshot.content.imageAssetId),
              layers: snapshot.content.layers.map((layer) => ({
                ...layer,
                imageAssetId:
                  layer.imageAssetId === null
                    ? null
                    : assertDomainId(DOMAIN_ID_KIND.asset, layer.imageAssetId),
              })),
              pins: snapshot.content.pins.map((pin) => ({
                ...pin,
                id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.id),
                destination: authoredDestination(pin.destination),
              })),
            },
            version,
            awareness: { status: 'unavailable' },
          },
        })
        return
      }
      const doc = new Y.Doc()
      Y.applyUpdate(doc, new Uint8Array(snapshot.update))
      this.#setState(
        resourceId,
        {
          status: 'ready',
          session: { document: doc, version, awareness: { status: 'unavailable' } },
        },
        () => doc.destroy(),
      )
    } catch {
      this.#setState(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
    }
  }

  #setState(resourceId: ResourceId, state: ResourceContentState, dispose?: () => void): void {
    this.#disposers.get(resourceId)?.()
    this.#disposers.delete(resourceId)
    if (dispose) this.#disposers.set(resourceId, dispose)
    this.#store.set(resourceId, state)
  }
}

function authoredDestination(value: unknown) {
  const destination = parseAuthoredDestination(value)
  if (!destination) throw new TypeError('Invalid authored destination')
  return destination
}

export function createLiveResourceContentSource(
  kind: 'file',
  backend: LiveResourceContentBackend,
): FileContentSource
export function createLiveResourceContentSource(
  kind: 'map',
  backend: LiveResourceContentBackend,
): MapSessionSource
export function createLiveResourceContentSource(
  kind: 'canvas',
  backend: LiveResourceContentBackend,
): CanvasSessionSource
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
