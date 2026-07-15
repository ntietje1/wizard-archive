import * as Y from 'yjs'
import { createCanvasDocumentDoc, parseCanvasDocumentContent } from '../canvas/document-contract'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../canvas/document-contract'
import type {
  CanvasSessionState,
  FileContentState,
  MapSessionState,
  NoteSessionState,
} from './content-session-contract'
import type {
  CanonicalTargetMapEntry,
  ContentCopyContext,
  ContentCopyPlanner,
} from './content-copy-contract'
import { initialVersion, sha256Digest } from './component-version'
import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { CanvasNodeId, MapPinId, ResourceId } from './domain-id'
import { initialNoteContentVersion } from './resource-content-version'
import type { ResourceKind } from './resource-record'

interface ContentStore<TState> {
  get(resourceId: ResourceId): TState
  set(resourceId: ResourceId, state: TState): void
}

type ContentStores = Readonly<{
  notes: ContentStore<NoteSessionState>
  files: ContentStore<FileContentState>
  maps: ContentStore<MapSessionState>
  canvases: ContentStore<CanvasSessionState>
}>

type PreparedContent =
  | Readonly<{ kind: 'folder'; destinationId: ResourceId }>
  | Readonly<{ kind: 'note'; destinationId: ResourceId; source: Y.Doc }>
  | Readonly<{
      kind: 'file'
      destinationId: ResourceId
      source: Extract<FileContentState, { status: 'ready' }>
    }>
  | Readonly<{
      kind: 'map'
      destinationId: ResourceId
      source: Extract<MapSessionState, { status: 'ready' }>
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
        entries.push({ kind, destinationId, source: source.session.document })
        break
      }
      case 'file': {
        const source = stores.files.get(sourceId)
        assertReady(source)
        entries.push({ kind, destinationId, source })
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
        entries.push({ kind, destinationId, source, pinIds })
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
      const content = cloneDocument(entry.source)
      const version = await initialNoteContentVersion(Y.encodeStateAsUpdate(content))
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.notes.set(entry.destinationId, {
          status: 'ready',
          session: { document: content, version, awareness: { status: 'unavailable' } },
        })
      }
    }
    case 'file':
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.files.set(entry.destinationId, {
          status: 'ready',
          content: { ...entry.source.content },
          version: initialVersion(entry.source.version.digest),
        })
      }
    case 'map': {
      const content = {
        imageAssetId: entry.source.session.content.imageAssetId,
        layers: entry.source.session.content.layers.map((layer) => ({ ...layer })),
        pins: entry.source.session.content.pins.map((pin) => ({
          ...pin,
          id: entry.pinIds.get(pin.id)!,
          targetResourceId: remapResourceId(pin.targetResourceId, targetMap),
        })),
      }
      const version = initialVersion(
        await sha256Digest(new TextEncoder().encode(JSON.stringify(content))),
      )
      return () => {
        kinds.set(entry.destinationId, entry.kind)
        stores.maps.set(entry.destinationId, {
          status: 'ready',
          session: { content, version, awareness: { status: 'unavailable' } },
        })
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
        stores.canvases.set(entry.destinationId, {
          status: 'ready',
          session: { document: content, version, awareness: { status: 'unavailable' } },
        })
      }
    }
  }
}

function cloneDocument(source: Y.Doc): Y.Doc {
  const destination = new Y.Doc()
  Y.applyUpdate(destination, Y.encodeStateAsUpdate(source))
  return destination
}

function remapResourceId(
  sourceId: ResourceId,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): ResourceId {
  const mapped = targetMap.find(
    (entry) => entry.source.kind === 'resource' && entry.source.resourceId === sourceId,
  )
  return mapped?.destination.kind === 'resource' ? mapped.destination.resourceId : sourceId
}

function remapCanvasNode(
  node: CanvasDocumentNode,
  nodeIds: ReadonlyMap<CanvasNodeId, CanvasNodeId>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): CanvasDocumentNode {
  const id = nodeIds.get(node.id)!
  if (node.type !== 'embed' || node.data.target?.kind !== 'resource') return { ...node, id }
  return {
    ...node,
    id,
    data: {
      ...node.data,
      target: {
        ...node.data.target,
        resourceId: remapResourceId(node.data.target.resourceId, targetMap),
      },
    },
  }
}
