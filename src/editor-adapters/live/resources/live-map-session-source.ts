import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import {
  assertSha256Digest,
  assertVersionStamp,
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
  MapContentSnapshotState,
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
import {
  createResourceSubscriptionRetainer,
  createResourceWatchStore,
} from './resource-watch-store'
import { liveContentPendingState } from './live-content-pending-state'
import { createLiveFixedContentResource } from './live-fixed-content-create'
import type { LiveFixedContentCreateBackend } from './live-fixed-content-create'
import type { LiveResourceContentAuthority } from './live-resource-content-authority'
import { downloadMapImage } from './map-image-download'
import { ResourceSessionStore } from '@wizard-archive/editor/resources/session-store'

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

type MapSnapshotStore = ReturnType<
  typeof createResourceWatchStore<MapSnapshot, MapContentSnapshotState>
>

export function createLiveMapSessionSource(
  campaignId: CampaignId,
  backend: LiveMapBackend,
  beginCreateUndo: () => ResourceUndoRecording,
  authority: LiveResourceContentAuthority,
): MapSessionSource {
  const sessions = new Map<ResourceId, LiveMapSession>()
  const store = new ResourceSessionStore<MapSessionState>({ status: 'loading' })
  let snapshotStore: MapSnapshotStore
  const reconcileSession = (resourceId: ResourceId) => {
    const state = snapshotStore.get(resourceId)
    if (state.status !== 'ready') {
      sessions.get(resourceId)?.dispose()
      sessions.delete(resourceId)
      store.set(resourceId, state)
      return
    }
    try {
      const { content, version } = state.snapshot
      const session =
        sessions.get(resourceId) ??
        new LiveMapSession(campaignId, resourceId, content, version, backend, authority, () => {
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
  snapshotStore = createResourceWatchStore<MapSnapshot, MapContentSnapshotState>(
    backend.watch,
    (resourceId, snapshot) =>
      snapshotStore.set(resourceId, decodeMapSnapshot(resourceId, snapshot, backend)),
    { status: 'loading' },
  )
  const sessionSubscriptions = createResourceSubscriptionRetainer(
    (resourceId) => {
      const releaseSnapshot = snapshotStore.subscribe(resourceId, () =>
        reconcileSession(resourceId),
      )
      reconcileSession(resourceId)
      return releaseSnapshot
    },
    (resourceId) => {
      sessions.get(resourceId)?.dispose()
      sessions.delete(resourceId)
      store.set(resourceId, { status: 'loading' })
    },
  )

  return {
    create: async (envelope) =>
      await createLiveFixedContentResource(campaignId, envelope, backend, beginCreateUndo),
    dispose: () => {
      sessionSubscriptions.dispose()
      snapshotStore.dispose()
      store.dispose()
      for (const session of sessions.values()) session.dispose()
      sessions.clear()
    },
    export: async (resourceId) => {
      const before = store.get(resourceId)
      if (before.status === 'ready') return exportMapContent(before.session.content)
      const loaded = decodeMapSnapshot(resourceId, await backend.load(resourceId), backend)
      const current = store.get(resourceId)
      if (current !== before && current.status === 'ready') {
        return exportMapContent(current.session.content)
      }
      return loaded.status === 'ready' ? exportMapContent(loaded.snapshot.content) : loaded
    },
    get: (resourceId) => store.get(resourceId),
    snapshots: {
      get: (resourceId) => snapshotStore.get(resourceId),
      subscribe: (resourceId, listener) => snapshotStore.subscribe(resourceId, listener),
    },
    subscribe: (resourceId, listener) => {
      const releaseStore = store.subscribe(resourceId, listener)
      const releaseSession = sessionSubscriptions.retain(resourceId)
      return () => {
        releaseStore()
        releaseSession()
      }
    },
  }
}

function exportMapContent(content: MapResourceContent): ContentExportResult {
  return {
    status: 'ready',
    bytes: encodeWizardMapDocument(content),
    extension: 'wizardmap',
    mediaType: 'application/vnd.wizard-archive.map+json',
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
    private readonly authority: LiveResourceContentAuthority,
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
    if (!this.authority.canEdit(this.resourceId)) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
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
    if (!this.authority.canEdit(this.resourceId)) {
      return { status: 'rejected', reason: 'unauthorized' }
    }
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
  return await downloadMapImage(expected, image, download.url)
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

function decodeMapSnapshot(
  resourceId: ResourceId,
  source: MapSnapshot,
  backend: LiveMapBackend,
): MapContentSnapshotState {
  if (source.status !== 'ready') {
    const pending = liveContentPendingState(source)
    return pending.status === 'initializing' ? { status: 'loading' } : pending
  }
  try {
    const content = readMapContent(source.content)
    return {
      status: 'ready',
      snapshot: {
        content,
        version: assertVersionStamp(source.version),
        loadImage: (layerId) =>
          loadMapImage(resourceId, layerId, mapImageAttachment(content, layerId), backend),
      },
    }
  } catch {
    return { status: 'integrity_error', issue: 'content_corrupt' }
  }
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
