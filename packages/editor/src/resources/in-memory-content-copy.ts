import * as Y from 'yjs'
import { remapAuthoredDestination } from './authored-destination'
import { createCanvasDocumentDoc, parseCanvasDocumentContent } from '../canvas/document-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../canvas/document-contract'
import type { NoteBlock } from '../notes/document/model'
import {
  NOTE_YJS_FRAGMENT,
  noteBlocksToYDoc,
  noteYDocToBlocks,
} from '../notes/document/headless-yjs'
import { remapNoteAuthoredDestinations } from '../notes/document/authored-destinations'
import type {
  CanvasSessionState,
  FileContentState,
  MapResourceContent,
  MapSessionState,
  NoteSessionState,
} from './content-session-contract'
import type {
  CanonicalTargetMapEntry,
  ContentCopyContext,
  ContentCopyPlanner,
} from './content-copy-contract'
import { initialVersion, sha256Digest } from './component-version'
import type { VersionStamp } from './component-version'
import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { CanvasNodeId, MapPinId, ResourceId } from './domain-id'
import { initialNoteContentVersion } from './resource-content-version'
import type { ResourceKind } from './resource-record'
import { createInMemoryNoteSession } from './in-memory-note-session'
import { copyMapImageBytes, initialMapContentVersion } from './map-session-policy'
import type { MapImageBytes } from './map-session-policy'

interface ContentStore<TState> {
  get(resourceId: ResourceId): TState
  set(resourceId: ResourceId, state: TState): void
}

type ContentStores = Readonly<{
  notes: ContentStore<NoteSessionState> & {
    setReady?(resourceId: ResourceId, document: Y.Doc, version: VersionStamp): void
  }
  files: ContentStore<FileContentState> & {
    readBytes(resourceId: ResourceId): Uint8Array
    setReady(
      resourceId: ResourceId,
      content: Extract<FileContentState, { status: 'ready' }>['content'],
      version: VersionStamp,
      bytes: Uint8Array,
    ): void
  }
  maps: ContentStore<MapSessionState> & {
    readImages(resourceId: ResourceId): ReadonlyArray<MapImageBytes>
    setReady(
      resourceId: ResourceId,
      content: MapResourceContent,
      version: VersionStamp,
      images: ReadonlyArray<MapImageBytes>,
    ): void
  }
  canvases: ContentStore<CanvasSessionState> & {
    setReady(resourceId: ResourceId, document: Y.Doc, version: VersionStamp): void
  }
}>

type PreparedContent =
  | Readonly<{ kind: 'folder'; destinationId: ResourceId }>
  | Readonly<{ kind: 'note'; destinationId: ResourceId; blocks: ReadonlyArray<NoteBlock> }>
  | Readonly<{
      kind: 'file'
      destinationId: ResourceId
      bytes: Uint8Array
      source: Extract<FileContentState, { status: 'ready' }>
    }>
  | Readonly<{
      kind: 'map'
      destinationId: ResourceId
      content: MapResourceContent
      images: ReadonlyArray<MapImageBytes>
      pinIds: ReadonlyMap<MapPinId, MapPinId>
    }>
  | Readonly<{
      kind: 'canvas'
      destinationId: ResourceId
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
      nodeIds: ReadonlyMap<CanvasNodeId, CanvasNodeId>
    }>

type ContentCopyPlan = Readonly<{
  entries: ReadonlyArray<PreparedContent>
  referenceableTargets: ReadonlyArray<CanonicalTargetMapEntry>
}>

export function createInMemoryContentCopyPlanner(
  kinds: Map<ResourceId, ResourceKind>,
  stores: ContentStores,
): ContentCopyPlanner<ContentCopyPlan, () => void> {
  return {
    prepare: (context) => Promise.resolve(prepareContentCopy(context, kinds, stores)),
    referenceableTargets: (plan) => plan.referenceableTargets,
    finalize: async (plan, targetMap) => {
      const commits = await Promise.all(
        plan.entries.map((entry) => finalizeContentCopy(entry, targetMap, kinds, stores)),
      )
      return () => {
        for (const commit of commits) commit()
      }
    },
  }
}

function prepareContentCopy(
  context: ContentCopyContext,
  kinds: ReadonlyMap<ResourceId, ResourceKind>,
  stores: ContentStores,
): ContentCopyPlan {
  const entries: Array<PreparedContent> = []
  const referenceableTargets: Array<CanonicalTargetMapEntry> = []
  for (const { sourceId, destinationId } of context.resourceMap) {
    const kind = kinds.get(sourceId)
    if (!kind) throw new TypeError('Copied resource kind is unavailable')
    switch (kind) {
      case 'folder':
        entries.push({ kind, destinationId })
        break
      case 'note': {
        const source = stores.notes.get(sourceId)
        assertReady(source)
        const blocks = noteYDocToBlocks(source.session.document, NOTE_YJS_FRAGMENT).map((block) =>
          allocateNoteBlock(block, sourceId, destinationId, referenceableTargets),
        )
        entries.push({ kind, destinationId, blocks })
        break
      }
      case 'file': {
        const source = stores.files.get(sourceId)
        assertReady(source)
        entries.push({ kind, destinationId, source, bytes: stores.files.readBytes(sourceId) })
        break
      }
      case 'map': {
        const source = stores.maps.get(sourceId)
        assertReady(source)
        const pinIds = new Map(
          source.session.content.pins.map((pin) => [
            pin.id,
            generateDomainId(DOMAIN_ID_KIND.mapPin),
          ]),
        )
        for (const pin of source.session.content.pins) {
          referenceableTargets.push({
            source: { kind: 'mapPin', resourceId: sourceId, pinId: pin.id },
            destination: {
              kind: 'mapPin',
              resourceId: destinationId,
              pinId: pinIds.get(pin.id)!,
            },
          })
        }
        entries.push({
          kind,
          destinationId,
          content: copyMapContent(source.session.content),
          images: stores.maps.readImages(sourceId),
          pinIds,
        })
        break
      }
      case 'canvas': {
        const source = stores.canvases.get(sourceId)
        assertReady(source)
        const { nodes, edges } = readCanvas(source.session.document)
        const nodeIds = new Map(
          nodes.map((node) => [node.id, generateDomainId(DOMAIN_ID_KIND.canvasNode)]),
        )
        for (const node of nodes) {
          referenceableTargets.push({
            source: { kind: 'canvasNode', resourceId: sourceId, nodeId: node.id },
            destination: {
              kind: 'canvasNode',
              resourceId: destinationId,
              nodeId: nodeIds.get(node.id)!,
            },
          })
        }
        entries.push({ kind, destinationId, nodes, edges, nodeIds })
        break
      }
    }
  }
  return { entries, referenceableTargets }
}

function assertReady<TState extends { status: string }>(
  state: TState,
): asserts state is TState & { status: 'ready' } {
  if (state.status !== 'ready') throw new TypeError('Copied resource content is unavailable')
}

function readCanvas(document: Y.Doc) {
  const content = parseCanvasDocumentContent(document)
  if (!content) throw new TypeError('Copied canvas content is invalid')
  return content
}

async function finalizeContentCopy(
  entry: PreparedContent,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  kinds: Map<ResourceId, ResourceKind>,
  stores: ContentStores,
): Promise<() => void> {
  switch (entry.kind) {
    case 'folder':
      return () => kinds.set(entry.destinationId, entry.kind)
    case 'note': {
      const remapped = remapNoteAuthoredDestinations(entry.blocks, targetMap, 'same_campaign_copy')
      if (remapped.status !== 'completed') throw new TypeError('Unmapped authored destination')
      const content = noteBlocksToYDoc(remapped.blocks, NOTE_YJS_FRAGMENT)
      const version = await initialNoteContentVersion(Y.encodeStateAsUpdate(content))
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        if (stores.notes.setReady) {
          stores.notes.setReady(entry.destinationId, content, version)
        } else {
          stores.notes.set(entry.destinationId, {
            status: 'ready',
            session: createInMemoryNoteSession(content, version),
          })
        }
      }
    }
    case 'file':
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.files.setReady(
          entry.destinationId,
          { ...entry.source.content },
          initialVersion(entry.source.version.digest),
          entry.bytes,
        )
      }
    case 'map': {
      const content = {
        image: entry.content.image,
        layers: entry.content.layers.map((layer) => ({ ...layer })),
        pins: entry.content.pins.map((pin) => ({
          ...pin,
          id: entry.pinIds.get(pin.id)!,
          destination: remapMapDestination(pin.destination, targetMap),
        })),
      }
      const [version, images] = await Promise.all([
        initialMapContentVersion(content),
        copyMapImageBytes(content, entry.images),
      ])
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.maps.setReady(entry.destinationId, content, version, images)
      }
    }
    case 'canvas': {
      const nodes = entry.nodes.map((node) => remapCanvasNode(node, entry.nodeIds, targetMap))
      const edges = entry.edges.map((edge) => ({
        ...edge,
        id: `${edge.id}:${entry.nodeIds.get(edge.source)!}:${entry.nodeIds.get(edge.target)!}`,
        source: entry.nodeIds.get(edge.source)!,
        target: entry.nodeIds.get(edge.target)!,
      }))
      const content = createCanvasDocumentDoc({ nodes, edges })
      const version = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(content)))
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.canvases.setReady(entry.destinationId, content, version)
      }
    }
  }
}

function copyMapContent(content: MapResourceContent): MapResourceContent {
  return {
    image: { ...content.image },
    layers: content.layers.map((layer) => ({ ...layer, image: { ...layer.image } })),
    pins: content.pins.map((pin) => ({ ...pin })),
  }
}

function remapMapDestination(
  destination: MapResourceContent['pins'][number]['destination'],
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
) {
  const result = remapAuthoredDestination(destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return result.destination
}

function allocateNoteBlock(
  source: NoteBlock,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
  targetMap: Array<CanonicalTargetMapEntry>,
): NoteBlock {
  const id = generateDomainId(DOMAIN_ID_KIND.noteBlock)
  const presentations =
    source.type === 'heading' ? (['block', 'heading'] as const) : (['block'] as const)
  for (const presentation of presentations) {
    targetMap.push({
      source: { kind: 'noteBlock', resourceId: sourceResourceId, blockId: source.id, presentation },
      destination: {
        kind: 'noteBlock',
        resourceId: destinationResourceId,
        blockId: id,
        presentation,
      },
    })
  }
  return {
    ...source,
    id,
    ...(source.children
      ? {
          children: source.children.map((child) =>
            allocateNoteBlock(child, sourceResourceId, destinationResourceId, targetMap),
          ),
        }
      : {}),
  } as NoteBlock
}

function remapCanvasNode(
  node: CanvasDocumentNode,
  nodeIds: ReadonlyMap<CanvasNodeId, CanvasNodeId>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): CanvasDocumentNode {
  const id = nodeIds.get(node.id)!
  if (node.type !== 'embed' || node.data.destination === undefined) return { ...node, id }
  const result = remapAuthoredDestination(node.data.destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return {
    ...node,
    id,
    data: {
      ...node.data,
      destination: result.destination,
    },
  }
}
