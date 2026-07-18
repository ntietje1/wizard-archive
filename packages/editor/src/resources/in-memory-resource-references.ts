import {
  MAX_RESOURCE_REFERENCE_OCCURRENCES,
  projectReferenceEdges,
  projectReferenceOccurrences,
  resourceAuthoredDestinationOccurrences,
} from './authored-destination'
import type {
  AuthoredDestinationOccurrence,
  ReferenceGraphEdge,
  ReferenceGraphOccurrence,
} from './authored-destination'
import type {
  CanvasSessionSource,
  MapSessionSource,
  NoteSessionSource,
} from './content-session-contract'
import type {
  ResourceReferenceDirection,
  ResourceReferenceSource,
  ResourceReferenceState,
} from './editor-runtime-contract'
import type { NoteBlock } from '../notes/document/model'
import { noteAuthoredDestinationOccurrences } from '../notes/document/authored-destinations'
import { NOTE_YJS_FRAGMENT, decodeNoteYjsUpdatesToBlocks } from '../notes/document/headless-yjs'
import { canvasAuthoredDestinations, parseCanvasDocumentContent } from '../canvas/document-contract'
import type { ResourceId } from './domain-id'
import type { WorkspaceResourceIndex } from './resource-index-contract'
import type { ResourceRecord } from './resource-record'
import * as Y from 'yjs'

type ContentSources = Readonly<{
  notes: NoteSessionSource
  maps: MapSessionSource
  canvases: CanvasSessionSource
}>

export function createInMemoryResourceReferenceSource(
  index: WorkspaceResourceIndex,
  resources: () => ReadonlyArray<ResourceRecord>,
  content: ContentSources,
): Readonly<{ source: ResourceReferenceSource; dispose(): void }> {
  const listeners = new Map<ResourceId, Set<() => void>>()
  const contentSubscriptions = new Map<ResourceId, () => void>()
  const states = new Map<ResourceId, ResourceReferenceState>()
  const publish = () => {
    states.clear()
    for (const resourceListeners of listeners.values()) {
      for (const listener of resourceListeners) listener()
    }
  }
  const syncContentSubscriptions = () => {
    const activeContentIds = new Set(
      resources().flatMap((resource) =>
        resource.lifecycle.state === 'active' &&
        (resource.kind === 'note' || resource.kind === 'map' || resource.kind === 'canvas')
          ? [resource.id]
          : [],
      ),
    )
    for (const [resourceId, dispose] of contentSubscriptions) {
      if (activeContentIds.has(resourceId)) continue
      dispose()
      contentSubscriptions.delete(resourceId)
    }
    for (const resourceId of activeContentIds) {
      if (contentSubscriptions.has(resourceId)) continue
      const resource = resources().find((candidate) => candidate.id === resourceId)
      if (!resource) continue
      const source =
        resource.kind === 'note'
          ? content.notes
          : resource.kind === 'map'
            ? content.maps
            : content.canvases
      contentSubscriptions.set(resourceId, source.subscribe(resourceId, publish))
    }
  }
  syncContentSubscriptions()
  const disposeIndex = index.subscribe(() => {
    syncContentSubscriptions()
    publish()
  })
  return {
    source: {
      get: (resourceId) => {
        const current = states.get(resourceId)
        if (current) return current
        const projected = projectReferences(resourceId, index, resources(), content)
        states.set(resourceId, projected)
        return projected
      },
      subscribe: (resourceId, listener) => {
        const resourceListeners = listeners.get(resourceId) ?? new Set()
        resourceListeners.add(listener)
        listeners.set(resourceId, resourceListeners)
        return () => {
          resourceListeners.delete(listener)
          if (resourceListeners.size === 0) listeners.delete(resourceId)
        }
      },
    },
    dispose: () => {
      disposeIndex()
      for (const dispose of contentSubscriptions.values()) dispose()
      contentSubscriptions.clear()
      listeners.clear()
      states.clear()
    },
  }
}

function projectReferences(
  resourceId: ResourceId,
  index: WorkspaceResourceIndex,
  resources: ReadonlyArray<ResourceRecord>,
  content: ContentSources,
): ResourceReferenceState {
  if (index.getSnapshot().lookup(resourceId).state !== 'known') {
    return { status: 'unavailable' }
  }
  try {
    const graph = projectGraph(resources, index, content)
    const outgoing = graph.capacitySources.has(resourceId)
      ? { status: 'capacity_exceeded' as const }
      : projectDirection(
          graph.occurrences.filter((occurrence) => occurrence.sourceResourceId === resourceId),
          'outgoing',
        )
    const backlinks =
      graph.capacitySources.size > 0
        ? { status: 'capacity_exceeded' as const }
        : projectDirection(
            graph.occurrences.filter((occurrence) => occurrence.target.resourceId === resourceId),
            'backlinks',
          )
    return { status: 'ready', outgoing, backlinks }
  } catch {
    return { status: 'error' }
  }
}

function projectGraph(
  resources: ReadonlyArray<ResourceRecord>,
  index: WorkspaceResourceIndex,
  content: ContentSources,
): Readonly<{
  occurrences: ReadonlyArray<ReferenceGraphOccurrence>
  capacitySources: ReadonlySet<ResourceId>
}> {
  const occurrences: Array<ReferenceGraphOccurrence> = []
  const capacitySources = new Set<ResourceId>()
  const visibleNotes = new Map<ResourceId, ReadonlySet<string>>()
  for (const resource of resources) {
    if (
      resource.lifecycle.state !== 'active' ||
      index.getSnapshot().lookup(resource.id).state !== 'known'
    ) {
      continue
    }
    const projected = projectResourceOccurrences(resource, content, visibleNotes)
    if (projected === null) continue
    try {
      occurrences.push(
        ...projectReferenceOccurrences(resource.id, projected.version, projected.occurrences),
      )
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      capacitySources.add(resource.id)
    }
  }
  return {
    occurrences: occurrences.filter(
      (occurrence) =>
        index.getSnapshot().lookup(occurrence.target.resourceId).state === 'known' &&
        targetBlockIsVisible(occurrence, visibleNotes),
    ),
    capacitySources,
  }
}

function projectResourceOccurrences(
  resource: ResourceRecord,
  content: ContentSources,
  visibleNotes: Map<ResourceId, ReadonlySet<string>>,
): Readonly<{
  version: ReferenceGraphEdge['sourceVersion']
  occurrences: ReadonlyArray<AuthoredDestinationOccurrence>
}> | null {
  if (resource.kind === 'note') {
    const state = content.notes.get(resource.id)
    if (state.status !== 'ready') return null
    const blocks = decodeNoteYjsUpdatesToBlocks(
      [{ update: Uint8Array.from(Y.encodeStateAsUpdate(state.session.document)).buffer }],
      NOTE_YJS_FRAGMENT,
    )
    visibleNotes.set(resource.id, new Set(flattenBlockIds(blocks)))
    return {
      version: state.session.version,
      occurrences: noteAuthoredDestinationOccurrences(blocks),
    }
  }
  if (resource.kind === 'map') {
    const state = content.maps.get(resource.id)
    return state.status === 'ready'
      ? {
          version: state.session.version,
          occurrences: resourceAuthoredDestinationOccurrences(
            state.session.content.pins.map((pin) => pin.destination),
          ),
        }
      : null
  }
  if (resource.kind === 'canvas') {
    const state = content.canvases.get(resource.id)
    if (state.status !== 'ready') return null
    const parsed = parseCanvasDocumentContent(state.session.document)
    if (!parsed) throw new TypeError('Canvas content is corrupt')
    return {
      version: state.session.version,
      occurrences: resourceAuthoredDestinationOccurrences(canvasAuthoredDestinations(parsed.nodes)),
    }
  }
  return null
}

function flattenBlockIds(blocks: ReadonlyArray<NoteBlock>): Array<string> {
  return blocks.flatMap((block) => [block.id, ...flattenBlockIds(block.children ?? [])])
}

function targetBlockIsVisible(
  occurrence: ReferenceGraphOccurrence,
  visibleNotes: ReadonlyMap<ResourceId, ReadonlySet<string>>,
): boolean {
  return (
    occurrence.target.kind !== 'noteBlock' ||
    visibleNotes.get(occurrence.target.resourceId)?.has(occurrence.target.blockId) === true
  )
}

function projectDirection(
  occurrences: ReadonlyArray<ReferenceGraphOccurrence>,
  kind: 'outgoing' | 'backlinks',
): ResourceReferenceDirection {
  const edges = projectReferenceEdges(occurrences, kind)
  if (edges.length > MAX_RESOURCE_REFERENCE_OCCURRENCES) {
    return { status: 'capacity_exceeded' }
  }
  return { status: 'ready', edges }
}
