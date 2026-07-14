import type { ResourceId } from '../resources/domain-id'
import type {
  CanvasViewportStore,
  PersistedCanvasViewport,
} from '../canvas/runtime/interaction/canvas-viewport-storage'
import { DEFAULT_MAP_TRANSFORM } from '../game-maps/viewer/transform-state'
import type { MapTransformState, MapTransformStore } from '../game-maps/viewer/transform-state'
import type { NoteScrollStore } from '../notes/viewer/use-scroll-persistence'

const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1 } satisfies PersistedCanvasViewport

export function createMemoryCanvasViewportStore(
  initialViewports: ReadonlyMap<ResourceId, PersistedCanvasViewport> = new Map(),
): CanvasViewportStore {
  const viewports = new Map(initialViewports)

  return {
    loadCanvasViewport: (canvasId) => viewports.get(canvasId) ?? DEFAULT_CANVAS_VIEWPORT,
    saveCanvasViewport: (canvasId, viewport) => {
      viewports.set(canvasId, viewport)
    },
  }
}

export function createMemoryMapTransformStore(
  initialTransforms: ReadonlyMap<ResourceId, MapTransformState> = new Map(),
): MapTransformStore {
  const transforms = new Map(initialTransforms)

  return {
    loadMapTransform: (mapId) => transforms.get(mapId) ?? DEFAULT_MAP_TRANSFORM,
    saveMapTransform: (mapId, value) => {
      transforms.set(mapId, value)
    },
  }
}

export function createMemoryNoteScrollStore(
  initialPositions: ReadonlyMap<ResourceId, number> = new Map(),
): NoteScrollStore {
  const positions = new Map(initialPositions)

  return {
    loadNoteScrollTop: (noteId) => positions.get(noteId) ?? 0,
    saveNoteScrollTop: (noteId, scrollTop) => {
      positions.set(noteId, scrollTop)
    },
  }
}
