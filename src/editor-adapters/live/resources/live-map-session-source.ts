import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import {
  assertSha256Digest,
  assertVersionStamp,
  sha256Digest,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
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
  MapResourceContent,
  MapSession,
  MapSessionSource,
  MapSessionState,
} from '@wizard-archive/editor/resources/content-session-contract'
import type { ResourceUndoRecording } from '@wizard-archive/editor/resources/undo-history'
import { encodeWizardMapDocument } from '@wizard-archive/editor/resources/map-native-document'
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

export function createLiveMapSessionSource(
  campaignId: CampaignId,
  backend: LiveMapBackend,
  beginCreateUndo: () => ResourceUndoRecording,
): MapSessionSource {
  const sessions = new Map<ResourceId, LiveMapSession>()
  let store: MapStore
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
      session.apply(content, version)
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

  return {
    create: async (envelope) =>
      await createLiveFixedContentResource(campaignId, envelope, backend, beginCreateUndo),
    dispose: () => {
      store.dispose()
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

  apply(content: MapResourceContent, version: ReturnType<typeof assertVersionStamp>): void {
    if (this.#disposed) return
    this.currentContent = content
    this.currentVersion = version
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
      this.apply(readMapContent(result.content), assertVersionStamp(result.version))
      this.publish()
      return { status: 'completed', content: this.currentContent, version: this.currentVersion }
    } catch {
      return { status: 'retryable', reason: 'response_lost' }
    }
  }

  async loadImage(layerId: string | null): Promise<ContentExportResult> {
    if (this.#disposed) return { status: 'unavailable', reason: 'scope_unavailable' }
    const expected = mapImage(this.currentContent, layerId)
    if (!expected || expected.status !== 'attached') {
      return { status: 'integrity_error', issue: 'content_missing' }
    }
    const download = await this.backend.download(this.resourceId, layerId)
    if (download.status !== 'ready') return download
    const version = assertVersionStamp(download.version)
    const image = readMapImage(download.image)
    if (
      image.status !== 'attached' ||
      !versionStampEquals(version, this.currentVersion) ||
      !sameMapImage(expected, image)
    ) {
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

  async replaceImage(
    layerId: string | null,
    source: FileResourceSource,
  ): Promise<MapContentMutationResult> {
    if (this.#disposed) return { status: 'rejected', reason: 'resource_missing' }
    let sessionId: Id<'fileStorage'> | null = null
    try {
      sessionId = await this.backend.upload(source)
      const args = {
        campaignId: this.campaignId,
        resourceId: this.resourceId,
        expectedVersion: this.currentVersion,
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
      this.apply(readMapContent(result.content), assertVersionStamp(result.version))
      this.publish()
      return { status: 'completed', content: this.currentContent, version: this.currentVersion }
    } catch {
      if (sessionId) await this.backend.discard(sessionId).catch(() => undefined)
      return { status: 'retryable', reason: 'response_lost' }
    }
  }

  dispose(): void {
    this.#disposed = true
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
  apply(resourceId, await backend.load(resourceId))
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

function mapImage(content: MapResourceContent, layerId: string | null) {
  return layerId === null
    ? content.image
    : content.layers.find((layer) => layer.id === layerId)?.image
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
