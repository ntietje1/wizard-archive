import * as Y from 'yjs'
import { encodeWizardCanvasDocument } from '@wizard-archive/editor/canvas/native-document'
import { encodeWizardMapDocument } from '@wizard-archive/editor/resources/map-native-document'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CanvasSessionSource,
  CanvasSessionState,
  ContentExportResult,
  CreateCanvasResourceCommand,
  CreateMapResourceCommand,
  FileContentSource,
  FileContentState,
  MapSessionSource,
  MapSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type {
  CommandDelivery,
  CommandEnvelope,
  ResourceStructureCommandResult,
} from '@wizard-archive/editor/resources/command-contract'
import { normalizeResourceStructureCommand } from '@wizard-archive/editor/resources/command-protocol'
import type { ResourceHistoryRecording } from '@wizard-archive/editor/resources/undo-history'
import { createResourceWatchStore } from './resource-watch-store'
import {
  deliverExpectedCreateResult,
  readLiveStructureResult,
  toLiveStructureMutationCommand,
} from './live-resource-structure-gateway'

type ResourceContentSnapshot = FunctionReturnType<typeof api.resources.queries.loadContent>
type ResourceContentKind = 'file' | 'map' | 'canvas'
type ResourceContentState = FileContentState | MapSessionState | CanvasSessionState
type LiveFileContentStateSource = Pick<FileContentSource, 'dispose' | 'get' | 'subscribe'> & {
  load(resourceId: ResourceId): Promise<FileContentState>
}
type LiveMapSessionStateSource = Pick<
  MapSessionSource,
  'dispose' | 'export' | 'get' | 'subscribe'
> & {
  load(resourceId: ResourceId): Promise<MapSessionState>
}
type LiveCanvasSessionStateSource = Pick<
  CanvasSessionSource,
  'dispose' | 'export' | 'get' | 'subscribe'
> & { load(resourceId: ResourceId): Promise<CanvasSessionState> }
type LiveContentSourceForKind<TKind extends ResourceContentKind> = TKind extends 'file'
  ? LiveFileContentStateSource
  : TKind extends 'map'
    ? LiveMapSessionStateSource
    : LiveCanvasSessionStateSource
type ResourceContentStore = ReturnType<
  typeof createResourceWatchStore<ResourceContentSnapshot, ResourceContentState>
>

export type LiveResourceContentBackend = Readonly<{
  load(resourceId: ResourceId): Promise<ResourceContentSnapshot>
  watch(resourceId: ResourceId, apply: (snapshot: ResourceContentSnapshot) => void): () => void
}>

class LiveResourceContentSource {
  readonly #store: ResourceContentStore
  readonly #disposers = new Map<ResourceId, () => void>()

  constructor(
    private readonly kind: ResourceContentKind,
    private readonly backend: LiveResourceContentBackend,
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

  async load(resourceId: ResourceId): Promise<ResourceContentState> {
    this.#apply(resourceId, await this.backend.load(resourceId))
    return this.get(resourceId)
  }

  subscribe(resourceId: ResourceId, listener: () => void): () => void {
    return this.#store.subscribe(resourceId, listener)
  }

  dispose(): void {
    this.#store.dispose()
    for (const dispose of this.#disposers.values()) dispose()
    this.#disposers.clear()
  }

  async export(resourceId: ResourceId): Promise<ContentExportResult> {
    const state = await this.load(resourceId)
    if (state.status !== 'ready') {
      return state.status === 'initializing' ? { status: 'loading' } : state
    }
    if (this.kind === 'map' && 'session' in state && 'content' in state.session) {
      return {
        status: 'ready',
        bytes: encodeWizardMapDocument(state.session.content),
        extension: 'wizardmap',
        mediaType: 'application/vnd.wizard-archive.map+json',
      }
    }
    if (this.kind === 'canvas' && 'session' in state && 'document' in state.session) {
      return {
        status: 'ready',
        bytes: encodeWizardCanvasDocument(state.session.document),
        extension: 'wizardcanvas',
        mediaType: 'application/vnd.wizard-archive.canvas',
      }
    }
    return { status: 'unavailable', reason: 'capability_not_supported' }
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

export function createLiveResourceContentSource<TKind extends ResourceContentKind>(
  kind: TKind,
  backend: LiveResourceContentBackend,
): LiveContentSourceForKind<TKind> {
  const source = new LiveResourceContentSource(kind, backend)
  return {
    dispose: () => source.dispose(),
    export: (resourceId: ResourceId) => source.export(resourceId),
    get: (resourceId: ResourceId) => source.get(resourceId),
    load: (resourceId: ResourceId) => source.load(resourceId),
    subscribe: (resourceId: ResourceId, listener: () => void) =>
      source.subscribe(resourceId, listener),
  } as LiveContentSourceForKind<TKind>
}

type ContentCreateArgs = FunctionArgs<typeof api.resources.mutations.createMapResource>
type ContentCreateResult = FunctionReturnType<typeof api.resources.mutations.createMapResource>
type LiveContentCreateBackend = LiveResourceContentBackend &
  Readonly<{
    create(args: ContentCreateArgs): Promise<ContentCreateResult>
    refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
  }>

export async function finalizeLiveContentCreate(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
  parentId: ResourceId | null,
  backend: Pick<LiveContentCreateBackend, 'refresh'>,
  recording: ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
    recording.abandon()
    return delivery
  }
  await backend.refresh(resourceId, parentId)
  recording.completed(delivery.result.receipt)
  return delivery
}

async function createLiveContentResource(
  campaignId: CampaignId,
  envelope: CommandEnvelope<CreateMapResourceCommand | CreateCanvasResourceCommand>,
  backend: LiveContentCreateBackend,
  beginCreate: () => ResourceHistoryRecording,
): Promise<CommandDelivery<ResourceStructureCommandResult>> {
  if (envelope.campaignId !== campaignId) {
    return { status: 'received', result: { status: 'rejected', reason: 'invalid_command' } }
  }
  const recording = beginCreate()
  try {
    const delivery = deliverExpectedCreateResult(
      readLiveStructureResult(
        await backend.create({
          campaignId,
          operationId: envelope.operationId,
          command: toLiveStructureMutationCommand(
            normalizeResourceStructureCommand(envelope.command),
          ),
        }),
      ),
      campaignId,
      envelope.operationId,
      envelope.command.resourceId,
    )
    return await finalizeLiveContentCreate(
      delivery,
      envelope.command.resourceId,
      envelope.command.parentId,
      backend,
      recording,
    )
  } catch {
    return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
  }
}

export function createLiveMapSessionSource(
  campaignId: CampaignId,
  backend: LiveContentCreateBackend,
  beginCreate: () => ResourceHistoryRecording,
): MapSessionSource {
  const content = createLiveResourceContentSource('map', backend)
  return {
    create: (envelope) => createLiveContentResource(campaignId, envelope, backend, beginCreate),
    dispose: content.dispose,
    export: content.export,
    get: content.get,
    subscribe: content.subscribe,
  }
}

export function createLiveCanvasSessionSource(
  campaignId: CampaignId,
  backend: LiveContentCreateBackend,
  beginCreate: () => ResourceHistoryRecording,
): CanvasSessionSource {
  const content = createLiveResourceContentSource('canvas', backend)
  return {
    create: (envelope) => createLiveContentResource(campaignId, envelope, backend, beginCreate),
    dispose: content.dispose,
    export: content.export,
    get: content.get,
    subscribe: content.subscribe,
  }
}
