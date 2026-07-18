import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import {
  assertSha256Digest,
  assertVersionStamp,
  sha256Digest,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ContentExportResult,
  FileResourceSource,
  MapContentMutationResult,
  MapContentCommand,
  MapImageAttachment,
  MapPreviewState,
  MapResourceContent,
  MapSession,
  MapSessionSource,
  MapSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { ResourceUndoRecording } from '@wizard-archive/editor/resources/undo-history'
import { encodeWizardMapDocument } from '@wizard-archive/editor/resources/map-native-document'
import {
  mapImageAttachment,
  reconcileMapSnapshot,
} from '@wizard-archive/editor/resources/map-session-policy'
import { createResourceWatchStore } from './resource-watch-store'
import { liveContentPendingState } from './live-content-pending-state'
import { createLiveFixedContentResource } from './live-fixed-content-create'
import type { LiveFixedContentCreateBackend } from './live-fixed-content-create'

type MapSnapshot = FunctionReturnType<typeof api.resources.queries.loadMapContent>
type RawMapImage =
  | Readonly<{ status: 'unattached' }>
  | Readonly<{ status: 'attached'; byteSize: number; digest: string; mediaType: string }>
type RawMapContent = Readonly<{
  image: RawMapImage
  layers: ReadonlyArray<Readonly<{ id: string; image: RawMapImage; name: string }>>
  pins: ReadonlyArray<
    Readonly<{
      id: string
      destination: unknown
      layerId: string | null
      visible: boolean
      x: number
      y: number
    }>
  >
}>
type MapImageDownload = FunctionReturnType<typeof api.resources.queries.loadMapImage>
type ReplaceMapImageArgs = FunctionArgs<typeof api.resources.actions.replaceMapImage>
type ReplaceMapImageResult = FunctionReturnType<typeof api.resources.actions.replaceMapImage>
type ExecuteMapCommandArgs = FunctionArgs<typeof api.resources.mutations.executeMapContentCommand>
type ExecuteMapCommandResult = FunctionReturnType<
  typeof api.resources.mutations.executeMapContentCommand
>
type LiveMapBackend = LiveFixedContentCreateBackend &
  Readonly<{
    load(resourceId: ResourceId): Promise<MapSnapshot>
    watch(resourceId: ResourceId, apply: (snapshot: MapSnapshot) => void): () => void
    discard(sessionId: Id<'fileStorage'>): Promise<void>
    download(resourceId: ResourceId, layerId: string | null): Promise<MapImageDownload>
    execute(args: ExecuteMapCommandArgs): Promise<ExecuteMapCommandResult>
    refresh(resourceId: ResourceId, parentId: ResourceId | null): Promise<void>
    replace(args: ReplaceMapImageArgs): Promise<ReplaceMapImageResult>
    upload(source: FileResourceSource): Promise<Id<'fileStorage'>>
  }>

type MapStore = ReturnType<typeof createResourceWatchStore<MapSnapshot, MapSessionState>>
type MapPreviewStore = ReturnType<typeof createResourceWatchStore<MapSnapshot, MapPreviewState>>

export function createLiveMapSessionSource(
  campaignId: CampaignId,
  backend: LiveMapBackend,
  beginCreateUndo: () => ResourceUndoRecording,
): MapSessionSource {
  const sessions = new Map<ResourceId, LiveMapSession>()
  let store: MapStore
  let previewStore: MapPreviewStore
  const apply = (resourceId: ResourceId, snapshot: MapSnapshot) => {
    if (snapshot.status !== 'ready') {
      sessions.get(resourceId)?.dispose()
      sessions.delete(resourceId)
      store.set(resourceId, liveContentPendingState(snapshot))
      return
    }
    try {
      const content = readMapContent(snapshot.content)
      const version = assertVersionStamp(snapshot.version)
      const session =
        sessions.get(resourceId) ??
        new LiveMapSession(campaignId, resourceId, content, version, backend, () => {
          const current = sessions.get(resourceId)
          if (current) store.set(resourceId, { status: 'ready', session: current })
        })
      if (session.apply(content, version) === 'conflict') {
        throw new TypeError('Conflicting map snapshot')
      }
      sessions.set(resourceId, session)
      store.set(resourceId, { status: 'ready', session })
    } catch {
      sessions.get(resourceId)?.dispose()
      sessions.delete(resourceId)
      store.set(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
    }
  }
  store = createResourceWatchStore<MapSnapshot, MapSessionState>(backend.watch, apply, {
    status: 'loading',
  })
  previewStore = createResourceWatchStore<MapSnapshot, MapPreviewState>(
    backend.watch,
    (resourceId, snapshot) => {
      if (snapshot.status !== 'ready') {
        const pending = liveContentPendingState(snapshot)
        previewStore.set(
          resourceId,
          pending.status === 'initializing' ? { status: 'loading' } : pending,
        )
        return
      }
      try {
        const content = readMapContent(snapshot.content)
        previewStore.set(resourceId, {
          status: 'ready',
          preview: {
            content,
            version: assertVersionStamp(snapshot.version),
            loadImage: (layerId) =>
              loadMapImage(resourceId, layerId, mapImageAttachment(content, layerId), backend),
          },
        })
      } catch {
        previewStore.set(resourceId, { status: 'integrity_error', issue: 'content_corrupt' })
      }
    },
    { status: 'loading' },
  )

  return {
    create: async (envelope) =>
      await createLiveFixedContentResource(campaignId, envelope, backend, beginCreateUndo),
    dispose: () => {
      store.dispose()
      previewStore.dispose()
      for (const session of sessions.values()) session.dispose()
      sessions.clear()
    },
    export: async (resourceId) => {
      const state = await loadMap(resourceId, backend, apply, store)
      if (state.status !== 'ready') {
        return state.status === 'initializing' ? { status: 'loading' } : state
      }
      return {
        status: 'ready',
        bytes: encodeWizardMapDocument(state.session.content),
        extension: 'wizardmap',
        mediaType: 'application/vnd.wizard-archive.map+json',
      }
    },
    get: (resourceId) => store.get(resourceId),
    previews: {
      get: (resourceId) => previewStore.get(resourceId),
      subscribe: (resourceId, listener) => previewStore.subscribe(resourceId, listener),
    },
    subscribe: (resourceId, listener) => store.subscribe(resourceId, listener),
  }
}

class LiveMapSession implements MapSession {
  readonly awareness = { status: 'unavailable' as const }
  #disposed = false

  constructor(
    private readonly campaignId: CampaignId,
    private readonly resourceId: ResourceId,
    private currentContent: MapResourceContent,
    private currentVersion: ReturnType<typeof assertVersionStamp>,
    private readonly backend: LiveMapBackend,
    private readonly publish: () => void,
  ) {}

  get content(): MapResourceContent {
    return this.currentContent
  }

  get version() {
    return this.currentVersion
  }

  apply(
    content: MapResourceContent,
    version: ReturnType<typeof assertVersionStamp>,
  ): ReturnType<typeof reconcileMapSnapshot> {
    if (this.#disposed) return 'retain'
    const decision = reconcileMapSnapshot(this.resourceId, this.currentVersion, content, version)
    if (decision === 'apply') {
      this.currentContent = content
      this.currentVersion = version
    }
    return decision
  }

  async execute(command: MapContentCommand): Promise<MapContentMutationResult> {
    if (this.#disposed) return { status: 'rejected', reason: 'resource_missing' }
    const args = {
      campaignId: this.campaignId,
      resourceId: this.resourceId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      expectedVersion: this.currentVersion,
      command: storedMapCommand(command),
    }
    try {
      let result: ExecuteMapCommandResult
      try {
        result = await this.backend.execute(args)
      } catch {
        result = await this.backend.execute(args)
      }
      if (result.status !== 'completed') return result
      return this.#complete(result.content, result.version)
    } catch {
      return { status: 'retryable', reason: 'response_lost' }
    }
  }

  async loadImage(layerId: string | null): Promise<ContentExportResult> {
    if (this.#disposed) return { status: 'unavailable', reason: 'scope_unavailable' }
    const expected = mapImageAttachment(this.currentContent, layerId)
    return await loadMapImage(this.resourceId, layerId, expected, this.backend)
  }

  async replaceImage(
    layerId: string | null,
    expectedVersion: VersionStamp,
    source: FileResourceSource,
  ): Promise<MapContentMutationResult> {
    if (this.#disposed) return { status: 'rejected', reason: 'resource_missing' }
    let sessionId: Id<'fileStorage'> | null = null
    try {
      sessionId = await this.backend.upload(source)
      const args = {
        campaignId: this.campaignId,
        resourceId: this.resourceId,
        expectedVersion,
        layerId,
        uploadSessionId: sessionId,
      }
      let result: ReplaceMapImageResult
      try {
        result = await this.backend.replace(args)
      } catch {
        result = await this.backend.replace(args)
      }
      if (result.status !== 'completed') {
        await this.backend.discard(sessionId).catch(() => undefined)
        return result
      }
      return this.#complete(result.content, result.version)
    } catch {
      if (sessionId) await this.backend.discard(sessionId).catch(() => undefined)
      return { status: 'retryable', reason: 'response_lost' }
    }
  }

  #complete(content: RawMapContent, version: unknown): MapContentMutationResult {
    const decision = this.apply(readMapContent(content), assertVersionStamp(version))
    if (decision === 'conflict') return { status: 'rejected', reason: 'content_corrupt' }
    if (decision === 'apply') this.publish()
    return { status: 'completed', content: this.currentContent, version: this.currentVersion }
  }

  dispose(): void {
    this.#disposed = true
  }
}

async function loadMapImage(
  resourceId: ResourceId,
  layerId: string | null,
  expected: MapImageAttachment | undefined,
  backend: Pick<LiveMapBackend, 'download'>,
): Promise<ContentExportResult> {
  if (!expected || expected.status !== 'attached') {
    return { status: 'integrity_error', issue: 'content_missing' }
  }
  const download = await backend.download(resourceId, layerId)
  if (download.status !== 'ready') return download
  assertVersionStamp(download.version)
  const image = readMapImage(download.image)
  if (image.status !== 'attached' || !sameMapImage(expected, image)) {
    return { status: 'integrity_error', issue: 'version_mismatch' }
  }
  const response = await fetch(download.url)
  if (!response.ok) return { status: 'integrity_error', issue: 'content_missing' }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== image.byteSize || (await sha256Digest(bytes)) !== image.digest) {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
  return {
    status: 'ready',
    bytes,
    extension: image.mediaType.split('/')[1] ?? 'bin',
    mediaType: image.mediaType,
  }
}

function storedMapCommand(command: MapContentCommand): ExecuteMapCommandArgs['command'] {
  switch (command.type) {
    case 'createPins':
      return {
        type: 'createPins',
        pins: command.pins.map((pin) => ({
          id: pin.id,
          destination: storedDestination(pin.destination),
          layerId: pin.layerId,
          x: pin.x,
          y: pin.y,
        })),
      }
    case 'movePin':
      return { type: 'movePin', pinId: command.pinId, x: command.x, y: command.y }
    case 'setPinVisibility':
      return { type: 'setPinVisibility', pinId: command.pinId, visible: command.visible }
    case 'removePin':
      return { type: 'removePin', pinId: command.pinId }
  }
}

type MapPinDestination = Extract<
  MapContentCommand,
  { type: 'createPins' }
>['pins'][number]['destination']

function storedDestination(
  destination: MapPinDestination,
): Extract<
  ExecuteMapCommandArgs['command'],
  { type: 'createPins' }
>['pins'][number]['destination'] {
  if (destination.kind === 'externalUrl') {
    return { kind: 'externalUrl', url: destination.url }
  }
  if (destination.kind === 'unresolved') {
    return { kind: 'unresolved', rawTarget: destination.rawTarget }
  }
  switch (destination.target.kind) {
    case 'resource':
      return {
        kind: 'internal',
        target: { kind: 'resource', resourceId: destination.target.resourceId },
      }
    case 'noteBlock':
      return {
        kind: 'internal',
        target: {
          kind: 'noteBlock',
          resourceId: destination.target.resourceId,
          blockId: destination.target.blockId,
          presentation: destination.target.presentation,
        },
      }
    case 'mapPin':
      return {
        kind: 'internal',
        target: {
          kind: 'mapPin',
          resourceId: destination.target.resourceId,
          pinId: destination.target.pinId,
        },
      }
    case 'canvasNode':
      return {
        kind: 'internal',
        target: {
          kind: 'canvasNode',
          resourceId: destination.target.resourceId,
          nodeId: destination.target.nodeId,
        },
      }
  }
}

async function loadMap(
  resourceId: ResourceId,
  backend: LiveMapBackend,
  apply: (resourceId: ResourceId, snapshot: MapSnapshot) => void,
  store: MapStore,
): Promise<MapSessionState> {
  const before = store.get(resourceId)
  if (before.status === 'ready') return before
  const snapshot = await backend.load(resourceId)
  const current = store.get(resourceId)
  if (current !== before) return current
  apply(resourceId, snapshot)
  return store.get(resourceId)
}

function readMapContent(content: RawMapContent | MapResourceContent): MapResourceContent {
  return {
    image: readMapImage(content.image),
    layers: content.layers.map((layer) => ({
      id: layer.id,
      image: readMapImage(layer.image),
      name: layer.name,
    })),
    pins: content.pins.map((pin) => {
      const destination = parseAuthoredDestination(pin.destination)
      if (!destination) throw new TypeError('Invalid map pin destination')
      return {
        ...pin,
        id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.id),
        destination,
      }
    }),
  }
}

function readMapImage(image: RawMapImage | MapImageAttachment): MapImageAttachment {
  return image.status === 'unattached'
    ? image
    : {
        status: 'attached',
        byteSize: image.byteSize,
        digest: assertSha256Digest(image.digest),
        mediaType: image.mediaType,
      }
}

function sameMapImage(left: MapImageAttachment, right: MapImageAttachment): boolean {
  return (
    left.status === right.status &&
    (left.status === 'unattached' ||
      (right.status === 'attached' &&
        left.byteSize === right.byteSize &&
        left.digest === right.digest &&
        left.mediaType === right.mediaType))
  )
}
