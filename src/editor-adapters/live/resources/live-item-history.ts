import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import type { WorkspaceResourceIndex } from '@wizard-archive/editor/resources/index-contract'
import type {
  CanvasSessionState,
  CanvasSessionSource,
  MapImageAttachment,
  MapResourceContent,
  MapSessionSource,
  NoteSessionState,
  NoteSessionSource,
} from '@wizard-archive/editor/resources/content-session-contract'
import {
  assertSha256Digest,
  assertVersionStamp,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import { mapImageAttachment } from '@wizard-archive/editor/resources/map-session-policy'
import type {
  ItemHistoryEntry,
  ItemHistoryPreview,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ItemHistoryBackend } from '@wizard-archive/editor/resources/item-history-controller'
import { createItemHistoryController } from '@wizard-archive/editor/resources/item-history-controller'
import { downloadMapImage } from './map-image-download'

type NoteSnapshot = FunctionReturnType<typeof api.resources.queries.loadNoteContent>
type CanvasSnapshot = FunctionReturnType<typeof api.resources.queries.loadCanvasContent>
type MapSnapshot = FunctionReturnType<typeof api.resources.queries.loadMapContent>

type LiveItemHistoryBackend = Readonly<{
  watchPage: ItemHistoryBackend['watchPage']
  loadCheckpoint: ItemHistoryBackend['loadCheckpoint']
  restore(args: {
    campaignId: CampaignId
    resourceId: ResourceId
    entryId: Parameters<ItemHistoryBackend['restore']>[1]
    expectedVersion: VersionStamp
  }): ReturnType<ItemHistoryBackend['restore']>
  loadNote(resourceId: ResourceId): Promise<NoteSnapshot>
  loadCanvas(resourceId: ResourceId): Promise<CanvasSnapshot>
  loadMap(resourceId: ResourceId): Promise<MapSnapshot>
}>

export function createLiveItemHistory(
  campaignId: CampaignId,
  index: WorkspaceResourceIndex,
  content: Readonly<{
    notes: NoteSessionSource
    canvases: CanvasSessionSource
    maps: MapSessionSource
  }>,
  backend: LiveItemHistoryBackend,
) {
  return createItemHistoryController({
    watchPage: backend.watchPage,
    loadCheckpoint: backend.loadCheckpoint,
    restore: async (resourceId, entryId) => {
      const expectedVersion = await currentContentVersion(resourceId, index, content, backend)
      if (!expectedVersion) return { status: 'unavailable' }
      return await backend.restore({
        campaignId,
        resourceId,
        entryId,
        expectedVersion,
      })
    },
  })
}

async function currentContentVersion(
  resourceId: ResourceId,
  index: WorkspaceResourceIndex,
  content: Readonly<{
    notes: NoteSessionSource
    canvases: CanvasSessionSource
    maps: MapSessionSource
  }>,
  backend: Pick<LiveItemHistoryBackend, 'loadNote' | 'loadCanvas' | 'loadMap'>,
): Promise<VersionStamp | null> {
  const resolution = index.getSnapshot().lookup(resourceId)
  if (resolution.state !== 'known') return null
  switch (resolution.value.kind) {
    case 'note':
      return await currentYjsContentVersion(content.notes.get(resourceId), () =>
        backend.loadNote(resourceId),
      )
    case 'canvas':
      return await currentYjsContentVersion(content.canvases.get(resourceId), () =>
        backend.loadCanvas(resourceId),
      )
    case 'map': {
      const state = content.maps.get(resourceId)
      if (state.status === 'ready') return state.session.version
      const snapshot = await backend.loadMap(resourceId)
      return snapshot.status === 'ready' ? assertVersionStamp(snapshot.version) : null
    }
    case 'file':
    case 'folder':
      return null
  }
}

async function currentYjsContentVersion(
  state: NoteSessionState | CanvasSessionState,
  load: () => Promise<NoteSnapshot | CanvasSnapshot>,
): Promise<VersionStamp | null> {
  if (state.status === 'ready') {
    const result = await state.session.flush()
    return result.status === 'completed' ? result.version : null
  }
  const snapshot = await load()
  return snapshot.status === 'ready' ? assertVersionStamp(snapshot.version) : null
}

type StoredHistoryPage = FunctionReturnType<typeof api.resources.queries.loadItemHistoryPage>
type StoredHistoryEntry = Extract<StoredHistoryPage, { status: 'ready' }>['entries'][number]
type StoredHistoryPreview = Extract<
  FunctionReturnType<typeof api.resources.queries.loadItemHistoryCheckpoint>,
  { status: 'ready' }
>['preview']

export function readLiveItemHistoryEntry(entry: StoredHistoryEntry): ItemHistoryEntry {
  const metadata =
    entry.action === 'copied'
      ? {
          ...entry.metadata,
          sourceResourceId: assertDomainId(
            DOMAIN_ID_KIND.resource,
            entry.metadata.sourceResourceId,
          ),
        }
      : entry.metadata
  return {
    ...entry,
    id: assertDomainId(DOMAIN_ID_KIND.historyEntry, entry.id),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, entry.resourceId),
    metadata,
    ...('checkpoint' in entry
      ? {
          checkpoint: {
            ...entry.checkpoint,
            snapshotId: assertDomainId(DOMAIN_ID_KIND.snapshot, entry.checkpoint.snapshotId),
            version: assertVersionStamp(entry.checkpoint.version),
          },
        }
      : {}),
  } as ItemHistoryEntry
}

export function readLiveItemHistoryPreview(preview: StoredHistoryPreview): ItemHistoryPreview {
  const snapshotId = assertDomainId(DOMAIN_ID_KIND.snapshot, preview.snapshotId)
  const version = assertVersionStamp(preview.version)
  if (preview.kind !== 'map') {
    return {
      kind: preview.kind,
      snapshotId,
      version,
      update: new Uint8Array(preview.update),
    }
  }
  return {
    kind: 'map',
    snapshotId,
    version,
    ...readHistoryMapPreview(preview),
  }
}

type StoredMapPreview = Extract<StoredHistoryPreview, { kind: 'map' }>

function readHistoryMapContent(content: StoredMapPreview['content']): MapResourceContent {
  return {
    image: readHistoryMapImage(content.image),
    layers: content.layers.map((layer) => ({
      ...layer,
      image: readHistoryMapImage(layer.image),
    })),
    pins: content.pins.map((pin) => {
      const destination = parseAuthoredDestination(pin.destination)
      if (!destination) throw new TypeError('Invalid item history map destination')
      return {
        ...pin,
        id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.id),
        destination,
      }
    }),
  }
}

function readHistoryMapPreview(preview: StoredMapPreview) {
  const content = readHistoryMapContent(preview.content)
  return {
    content,
    loadImage: async (layerId: string | null) => {
      const image = mapImageAttachment(content, layerId)
      const source = preview.images.find((candidate) => candidate.layerId === layerId)
      return source && image
        ? await downloadMapImage(image, image, source.url)
        : { status: 'integrity_error' as const, issue: 'content_missing' as const }
    },
  }
}

function readHistoryMapImage(image: StoredMapPreview['content']['image']): MapImageAttachment {
  return image.status === 'unattached'
    ? image
    : { ...image, digest: assertSha256Digest(image.digest) }
}
