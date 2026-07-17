import type { CanvasNodeId } from '../resources/domain-id'
import type {
  CanvasConnectionAnchor,
  CanvasDrawPoint,
  CanvasPoint,
  CanvasResizeHandle,
  CanvasSelection,
  CanvasTool,
  CanvasToolSettings,
  CanvasViewport,
} from './interaction-types'
import { DEFAULT_CANVAS_VIEWPORT } from './canvas-viewport'
import { canvasBoundsUnion, canvasNodeBounds } from './canvas-bounds'
import type { CanvasBounds } from './canvas-bounds'
import { createCanvasConnectionCandidateIndex } from './canvas-edge-geometry'
import { createCanvasEraserCandidateIndex } from './canvas-stroke-geometry'
import {
  canvasSnapThreshold,
  createCanvasSnapTargetIndex,
  resolveCanvasDrag,
} from './canvas-snap-geometry'
import type { CanvasSnapGuide } from './canvas-snap-geometry'
import { resolveCanvasResize } from './canvas-resize-geometry'
import { canvasBoundsFromPoints, createCanvasSelectionCandidateIndex } from './selection-geometry'
import type { CanvasDocumentContent } from './document-contract'
import { CANVAS_WORKLOAD_LIMITS } from './workload'
import { resolveCanvasTextPlacementBounds } from './canvas-node-placement'

type CanvasSelectionKind = 'lasso' | 'marquee'
type CanvasSelectionMode = 'add' | 'replace'

type CanvasDrawStyle = Readonly<{
  color: string
  size: number
  opacity: number
}>

type CanvasResizeCommit = Readonly<{
  initialBounds: CanvasBounds
  bounds: CanvasBounds
  initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>
}>

type CanvasInteraction =
  | Readonly<{ type: 'idle' }>
  | Readonly<{
      type: 'selecting'
      kind: 'marquee'
      pointerId: number
      mode: CanvasSelectionMode
      origin: CanvasPoint
      current: CanvasPoint
      candidate: CanvasSelection | null
    }>
  | Readonly<{
      type: 'selecting'
      kind: 'lasso'
      pointerId: number
      mode: CanvasSelectionMode
      points: ReadonlyArray<CanvasPoint>
      current: CanvasPoint
      sampleDistance: number
      candidate: CanvasSelection | null
    }>
  | Readonly<{
      type: 'dragging'
      pointerId: number
      anchor: CanvasPoint
      initialPositions: ReadonlyMap<CanvasNodeId, CanvasPoint>
      delta: CanvasPoint
      guides: ReadonlyArray<CanvasSnapGuide>
    }>
  | Readonly<{
      type: 'drawing'
      pointerId: number
      rawPoints: ReadonlyArray<CanvasDrawPoint>
      current: CanvasDrawPoint
      sampleDistance: number
      constrain: boolean
      style: CanvasDrawStyle
    }>
  | Readonly<{
      type: 'placing-text'
      pointerId: number
      origin: CanvasPoint
      current: CanvasPoint
      square: boolean
    }>
  | Readonly<{
      type: 'panning'
      pointerId: number
      anchor: CanvasPoint
      initialViewport: CanvasViewport
    }>
  | Readonly<{
      type: 'editing'
      nodeId: CanvasNodeId
      activation: Readonly<{ x: number; y: number }> | null
    }>
  | Readonly<{
      type: 'erasing'
      pointerId: number
      current: CanvasPoint
      nodeIds: ReadonlySet<CanvasNodeId>
    }>
  | Readonly<{
      type: 'connecting'
      pointerId: number
      source: CanvasConnectionAnchor
      current: CanvasPoint
      target: CanvasConnectionAnchor | null
    }>
  | Readonly<{
      type: 'resizing'
      pointerId: number
      handle: CanvasResizeHandle
      initialBounds: CanvasBounds
      bounds: CanvasBounds
      initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>
      guides: ReadonlyArray<CanvasSnapGuide>
    }>

type CanvasGestureCandidates =
  | Readonly<{
      type: 'selecting'
      index: ReturnType<typeof createCanvasSelectionCandidateIndex>
    }>
  | Readonly<{
      type: 'dragging'
      draggedBounds: ReadonlyArray<CanvasBounds>
      index: ReturnType<typeof createCanvasSnapTargetIndex>
    }>
  | Readonly<{
      type: 'erasing'
      index: ReturnType<typeof createCanvasEraserCandidateIndex>
    }>
  | Readonly<{
      type: 'connecting'
      index: ReturnType<typeof createCanvasConnectionCandidateIndex>
    }>
  | Readonly<{
      type: 'resizing'
      index: ReturnType<typeof createCanvasSnapTargetIndex>
    }>

export type CanvasInteractionSnapshot = Readonly<{
  tool: CanvasTool
  toolSettings: CanvasToolSettings
  viewport: CanvasViewport
  selection: CanvasSelection
  interaction: CanvasInteraction
}>

const MIN_CANVAS_ZOOM = 0.1
const MAX_CANVAS_ZOOM = 4
const INITIAL_CANVAS_TOOL_SETTINGS: CanvasToolSettings = {
  edgeType: 'bezier',
  strokeColor: 'var(--foreground)',
  strokeOpacity: 100,
  strokeSize: 4,
}
const CREATION_TOOLS = new Set<CanvasTool>(['draw', 'eraser', 'text', 'edge'])

function emptySelection(): CanvasSelection {
  return { nodeIds: new Set(), edgeIds: new Set() }
}

function cloneSelection(selection: CanvasSelection): CanvasSelection {
  let remaining: number = CANVAS_WORKLOAD_LIMITS.selectedElements
  const nodeIds = new Set<CanvasNodeId>()
  const edgeIds = new Set<string>()
  for (const id of selection.nodeIds) {
    if (remaining === 0) break
    nodeIds.add(id)
    remaining -= 1
  }
  for (const id of selection.edgeIds) {
    if (remaining === 0) break
    edgeIds.add(id)
    remaining -= 1
  }
  return {
    nodeIds,
    edgeIds,
  }
}

function setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  if (left === right) return true
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

function selectionsEqual(left: CanvasSelection, right: CanvasSelection): boolean {
  return setsEqual(left.nodeIds, right.nodeIds) && setsEqual(left.edgeIds, right.edgeIds)
}

function boundsEqual(left: CanvasBounds, right: CanvasBounds): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  )
}

function snapGuidesEqual(
  left: ReadonlyArray<CanvasSnapGuide>,
  right: ReadonlyArray<CanvasSnapGuide>,
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (guide, index) =>
        guide.orientation === right[index]?.orientation &&
        guide.position === right[index]?.position &&
        guide.start === right[index]?.start &&
        guide.end === right[index]?.end,
    )
  )
}

function normalizeViewport(viewport: CanvasViewport): CanvasViewport {
  return {
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: Math.min(
      MAX_CANVAS_ZOOM,
      Math.max(MIN_CANVAS_ZOOM, Number.isFinite(viewport.zoom) ? viewport.zoom : 1),
    ),
  }
}

function mergeSelection(current: CanvasSelection, incoming: CanvasSelection): CanvasSelection {
  return cloneSelection({
    nodeIds: new Set([...current.nodeIds, ...incoming.nodeIds]),
    edgeIds: new Set([...current.edgeIds, ...incoming.edgeIds]),
  })
}

function toggleSelectionId<T>(selected: ReadonlySet<T>, id: T, additive: boolean): ReadonlySet<T> {
  if (!additive) return new Set([id])
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function filterSelection(
  selection: CanvasSelection,
  nodeIds: ReadonlySet<CanvasNodeId>,
  edgeIds: ReadonlySet<string>,
): CanvasSelection {
  return {
    nodeIds: new Set(Array.from(selection.nodeIds).filter((id) => nodeIds.has(id))),
    edgeIds: new Set(Array.from(selection.edgeIds).filter((id) => edgeIds.has(id))),
  }
}

function reconcileInteraction(
  interaction: CanvasInteraction,
  nodeIds: ReadonlySet<CanvasNodeId>,
  edgeIds: ReadonlySet<string>,
): CanvasInteraction {
  switch (interaction.type) {
    case 'selecting':
      return reconcileSelecting(interaction, nodeIds, edgeIds)
    case 'dragging':
      return reconcileDragging(interaction, nodeIds)
    case 'editing':
      return nodeIds.has(interaction.nodeId) ? interaction : { type: 'idle' }
    case 'connecting':
      return reconcileConnecting(interaction, nodeIds)
    case 'erasing':
      return reconcileErasing(interaction, nodeIds)
    case 'resizing':
      return reconcileResizing(interaction, nodeIds)
    case 'drawing':
    case 'idle':
    case 'panning':
    case 'placing-text':
      return interaction
  }
}

function reconcileSelecting(
  interaction: Extract<CanvasInteraction, { type: 'selecting' }>,
  nodeIds: ReadonlySet<CanvasNodeId>,
  edgeIds: ReadonlySet<string>,
): CanvasInteraction {
  if (interaction.candidate === null) return interaction
  const candidate = filterSelection(interaction.candidate, nodeIds, edgeIds)
  return selectionsEqual(candidate, interaction.candidate)
    ? interaction
    : { ...interaction, candidate }
}

function reconcileDragging(
  interaction: Extract<CanvasInteraction, { type: 'dragging' }>,
  nodeIds: ReadonlySet<CanvasNodeId>,
): CanvasInteraction {
  const initialPositions = new Map(
    Array.from(interaction.initialPositions).filter(([id]) => nodeIds.has(id)),
  )
  if (initialPositions.size === 0) return { type: 'idle' }
  return initialPositions.size === interaction.initialPositions.size
    ? interaction
    : { ...interaction, initialPositions }
}

function reconcileConnecting(
  interaction: Extract<CanvasInteraction, { type: 'connecting' }>,
  nodeIds: ReadonlySet<CanvasNodeId>,
): CanvasInteraction {
  if (!nodeIds.has(interaction.source.nodeId)) return { type: 'idle' }
  return interaction.target && !nodeIds.has(interaction.target.nodeId)
    ? { ...interaction, target: null }
    : interaction
}

function reconcileErasing(
  interaction: Extract<CanvasInteraction, { type: 'erasing' }>,
  nodeIds: ReadonlySet<CanvasNodeId>,
): CanvasInteraction {
  const markedNodeIds = new Set(Array.from(interaction.nodeIds).filter((id) => nodeIds.has(id)))
  return markedNodeIds.size === interaction.nodeIds.size
    ? interaction
    : { ...interaction, nodeIds: markedNodeIds }
}

function reconcileResizing(
  interaction: Extract<CanvasInteraction, { type: 'resizing' }>,
  nodeIds: ReadonlySet<CanvasNodeId>,
): CanvasInteraction {
  for (const nodeId of interaction.initialNodeBounds.keys()) {
    if (!nodeIds.has(nodeId)) return { type: 'idle' }
  }
  return interaction
}

function appendAdaptivePoint<TPoint>(
  points: ReadonlyArray<TPoint>,
  point: TPoint,
  limit: number,
  sampleDistance: number,
  distance: (left: TPoint, right: TPoint) => number,
): Readonly<{ points: ReadonlyArray<TPoint>; sampleDistance: number }> {
  if (distance(points[points.length - 1]!, point) < sampleDistance) {
    return { points, sampleDistance }
  }
  if (points.length < limit) return { points: [...points, point], sampleDistance }
  const resampled: Array<TPoint> = [points[0]!]
  for (let index = 2; index < points.length; index += 2) resampled.push(points[index]!)
  return { points: [...resampled, point], sampleDistance: sampleDistance * 2 }
}

function appendDrawPoint(
  points: ReadonlyArray<CanvasDrawPoint>,
  point: CanvasDrawPoint,
  sampleDistance: number,
) {
  return appendAdaptivePoint(
    points,
    point,
    CANVAS_WORKLOAD_LIMITS.pointsPerStroke,
    sampleDistance,
    (left, right) => Math.hypot(right[0] - left[0], right[1] - left[1]),
  )
}

function appendGesturePoint(
  points: ReadonlyArray<CanvasPoint>,
  point: CanvasPoint,
  sampleDistance: number,
) {
  return appendAdaptivePoint(
    points,
    point,
    CANVAS_WORKLOAD_LIMITS.gesturePoints,
    sampleDistance,
    (left, right) => Math.hypot(right.x - left.x, right.y - left.y),
  )
}

export function getVisualCanvasSelection(snapshot: CanvasInteractionSnapshot): CanvasSelection {
  const { interaction, selection } = snapshot
  if (interaction.type !== 'selecting' || interaction.candidate === null) return selection
  return interaction.mode === 'replace'
    ? interaction.candidate
    : mergeSelection(selection, interaction.candidate)
}

export function getCanvasNodeInteractionPosition(
  snapshot: CanvasInteractionSnapshot,
  nodeId: CanvasNodeId,
  documentPosition: CanvasPoint,
): CanvasPoint {
  const { interaction } = snapshot
  if (interaction.type !== 'dragging') return documentPosition
  const initial = interaction.initialPositions.get(nodeId)
  return initial
    ? { x: initial.x + interaction.delta.x, y: initial.y + interaction.delta.y }
    : documentPosition
}

export function getCanvasDrawingPoints(
  interaction: Extract<CanvasInteraction, { type: 'drawing' }>,
): ReadonlyArray<CanvasDrawPoint> {
  const rawPoints = appendCurrentDrawPoint(interaction.rawPoints, interaction.current)
  if (!interaction.constrain || rawPoints.length < 2) return rawPoints
  const start = rawPoints[0]!
  const end = rawPoints[rawPoints.length - 1]!
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  return Math.abs(deltaX) >= Math.abs(deltaY)
    ? [start, [end[0], start[1], end[2]]]
    : [start, [start[0], end[1], end[2]]]
}

function appendCurrentDrawPoint(
  points: ReadonlyArray<CanvasDrawPoint>,
  current: CanvasDrawPoint,
): ReadonlyArray<CanvasDrawPoint> {
  const last = points[points.length - 1]
  return last && last[0] === current[0] && last[1] === current[1] ? points : [...points, current]
}

function lassoPoints(
  points: ReadonlyArray<CanvasPoint>,
  current: CanvasPoint,
): ReadonlyArray<CanvasPoint> {
  const last = points[points.length - 1]
  return last && last.x === current.x && last.y === current.y ? points : [...points, current]
}

function squareSelectionPoint(origin: CanvasPoint, point: CanvasPoint): CanvasPoint {
  const size = Math.max(Math.abs(point.x - origin.x), Math.abs(point.y - origin.y))
  return {
    x: origin.x + (point.x < origin.x ? -size : size),
    y: origin.y + (point.y < origin.y ? -size : size),
  }
}

export type CanvasInteractionController = CanvasInteractionControllerState

const EMPTY_CANVAS_CONTENT: CanvasDocumentContent = Object.freeze({ nodes: [], edges: [] })

export function createCanvasInteractionController(
  options: Readonly<{
    viewport?: CanvasViewport
    readContent?: () => CanvasDocumentContent
  }> = {},
): CanvasInteractionController {
  return new CanvasInteractionControllerState(
    options.viewport ?? DEFAULT_CANVAS_VIEWPORT,
    options.readContent ?? (() => EMPTY_CANVAS_CONTENT),
  )
}

class CanvasInteractionControllerState {
  #candidates: CanvasGestureCandidates | null = null
  readonly #listeners = new Set<() => void>()
  readonly #readContent: () => CanvasDocumentContent
  readonly #viewportCommitListeners = new Set<(viewport: CanvasViewport) => void>()
  #disposed = false
  #snapshot: CanvasInteractionSnapshot

  constructor(viewport: CanvasViewport, readContent: () => CanvasDocumentContent) {
    this.#readContent = readContent
    this.#snapshot = {
      tool: 'select',
      toolSettings: INITIAL_CANVAS_TOOL_SETTINGS,
      viewport: normalizeViewport(viewport),
      selection: emptySelection(),
      interaction: { type: 'idle' },
    }
  }

  get = (): CanvasInteractionSnapshot => {
    this.#assertActive()
    return this.#snapshot
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#assertActive()
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  subscribeViewportCommit = (listener: (viewport: CanvasViewport) => void): (() => void) => {
    this.#assertActive()
    this.#viewportCommitListeners.add(listener)
    return () => this.#viewportCommitListeners.delete(listener)
  }

  setTool(tool: CanvasTool): void {
    this.#assertActive()
    const selection = CREATION_TOOLS.has(tool) ? emptySelection() : this.#snapshot.selection
    if (
      tool === this.#snapshot.tool &&
      selectionsEqual(selection, this.#snapshot.selection) &&
      this.#snapshot.interaction.type === 'idle'
    ) {
      return
    }
    this.#publish({ ...this.#snapshot, tool, selection, interaction: { type: 'idle' } })
  }

  setToolSettings(settings: CanvasToolSettings): void {
    this.#assertActive()
    const next = normalizeToolSettings(settings)
    const current = this.#snapshot.toolSettings
    if (
      next.edgeType === current.edgeType &&
      next.strokeColor === current.strokeColor &&
      next.strokeOpacity === current.strokeOpacity &&
      next.strokeSize === current.strokeSize
    ) {
      return
    }
    this.#publish({ ...this.#snapshot, toolSettings: next })
  }

  setSelection(selection: CanvasSelection): void {
    this.#assertActive()
    if (CREATION_TOOLS.has(this.#snapshot.tool)) return
    const nextSelection = cloneSelection(selection)
    if (
      selectionsEqual(nextSelection, this.#snapshot.selection) &&
      this.#snapshot.interaction.type === 'idle'
    ) {
      return
    }
    this.#publish({
      ...this.#snapshot,
      selection: nextSelection,
      interaction: { type: 'idle' },
    })
  }

  clearSelection(): void {
    this.setSelection(emptySelection())
  }

  selectNode(nodeId: CanvasNodeId, additive: boolean): void {
    this.setSelection({
      nodeIds: toggleSelectionId(this.#snapshot.selection.nodeIds, nodeId, additive),
      edgeIds: additive ? this.#snapshot.selection.edgeIds : new Set(),
    })
  }

  selectEdge(edgeId: string, additive: boolean): void {
    if (edgeId.trim().length === 0) throw new TypeError('Expected a non-empty canvas edge id')
    this.setSelection({
      nodeIds: additive ? this.#snapshot.selection.nodeIds : new Set(),
      edgeIds: toggleSelectionId(this.#snapshot.selection.edgeIds, edgeId, additive),
    })
  }

  beginSelection(
    kind: CanvasSelectionKind,
    mode: CanvasSelectionMode,
    pointerId: number,
    point: CanvasPoint,
  ): void {
    this.#assertActive()
    this.#candidates = {
      type: 'selecting',
      index: createCanvasSelectionCandidateIndex(this.#readContent()),
    }
    this.#publish({
      ...this.#snapshot,
      interaction:
        kind === 'marquee'
          ? {
              type: 'selecting',
              kind,
              pointerId,
              mode,
              origin: point,
              current: point,
              candidate: null,
            }
          : {
              type: 'selecting',
              kind,
              pointerId,
              mode,
              points: [point],
              current: point,
              sampleDistance: 1,
              candidate: null,
            },
    })
  }

  beginDrag(
    pointerId: number,
    anchor: CanvasPoint,
    initialPositions: ReadonlyMap<CanvasNodeId, CanvasPoint>,
  ): void {
    this.#assertActive()
    if (
      initialPositions.size === 0 ||
      initialPositions.size > CANVAS_WORKLOAD_LIMITS.selectedElements
    ) {
      throw new Error('Canvas drag requires a bounded non-empty node selection')
    }
    const content = this.#readContent()
    const selectedNodeIds = new Set(initialPositions.keys())
    this.#candidates = {
      type: 'dragging',
      draggedBounds: content.nodes.flatMap((node) => {
        const position = initialPositions.get(node.id)
        return position ? [canvasNodeBounds({ ...node, position })] : []
      }),
      index: createCanvasSnapTargetIndex(content.nodes, selectedNodeIds),
    }
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'dragging',
        pointerId,
        anchor,
        initialPositions: new Map(initialPositions),
        delta: { x: 0, y: 0 },
        guides: [],
      },
    })
  }

  beginDrawing(pointerId: number, point: CanvasPoint, pressure: number): void {
    this.#assertActive()
    const settings = this.#snapshot.toolSettings
    const style: CanvasDrawStyle = {
      color: settings.strokeColor,
      opacity: settings.strokeOpacity,
      size: settings.strokeSize,
    }
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'drawing',
        pointerId,
        rawPoints: [drawPoint(point, pressure)],
        current: drawPoint(point, pressure),
        sampleDistance: 1,
        constrain: false,
        style: { ...style },
      },
    })
  }

  beginTextPlacement(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'placing-text',
        pointerId,
        origin: point,
        current: point,
        square: false,
      },
    })
  }

  updateTextPlacement(pointerId: number, point: CanvasPoint, square: boolean): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'placing-text' || interaction.pointerId !== pointerId) return
    if (
      interaction.current.x === point.x &&
      interaction.current.y === point.y &&
      interaction.square === square
    ) {
      return
    }
    this.#publish({
      ...this.#snapshot,
      interaction: { ...interaction, current: point, square },
    })
  }

  commitTextPlacement(pointerId: number): CanvasBounds | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'placing-text' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    return resolveCanvasTextPlacementBounds(
      interaction.origin,
      interaction.current,
      interaction.square,
    )
  }

  beginErasing(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    this.#candidates = {
      type: 'erasing',
      index: createCanvasEraserCandidateIndex(this.#readContent().nodes),
    }
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'erasing',
        pointerId,
        current: point,
        nodeIds: new Set(),
      },
    })
  }

  beginConnection(pointerId: number, source: CanvasConnectionAnchor, point: CanvasPoint): void {
    this.#assertActive()
    this.#candidates = {
      type: 'connecting',
      index: createCanvasConnectionCandidateIndex(this.#readContent().nodes),
    }
    this.#publish({
      ...this.#snapshot,
      interaction: { type: 'connecting', pointerId, source, current: point, target: null },
    })
  }

  beginResize(
    pointerId: number,
    handle: CanvasResizeHandle,
    bounds: CanvasBounds,
    nodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>,
  ): void {
    this.#assertActive()
    if (nodeBounds.size === 0 || nodeBounds.size > CANVAS_WORKLOAD_LIMITS.selectedElements) {
      throw new TypeError('Canvas resize requires a bounded non-empty node selection')
    }
    this.#candidates = {
      type: 'resizing',
      index: createCanvasSnapTargetIndex(this.#readContent().nodes, new Set(nodeBounds.keys())),
    }
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'resizing',
        pointerId,
        handle,
        initialBounds: { ...bounds },
        bounds: { ...bounds },
        initialNodeBounds: new Map(nodeBounds),
        guides: [],
      },
    })
  }

  updateResize(pointerId: number, point: CanvasPoint, square = false, snap = false): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    const candidates = this.#candidates
    if (
      interaction.type !== 'resizing' ||
      interaction.pointerId !== pointerId ||
      candidates?.type !== 'resizing'
    ) {
      return
    }
    const unsnapped = resolveCanvasResize({
      handle: interaction.handle,
      initialBounds: interaction.initialBounds,
      point,
      initialNodeBounds: interaction.initialNodeBounds,
      targetBounds: [],
      square,
      snap: false,
      zoom: this.#snapshot.viewport.zoom,
    })
    const targetBounds = snap
      ? candidates.index.near(unsnapped.bounds, canvasSnapThreshold(this.#snapshot.viewport.zoom))
      : []
    const resolved = resolveCanvasResize({
      handle: interaction.handle,
      initialBounds: interaction.initialBounds,
      point,
      initialNodeBounds: interaction.initialNodeBounds,
      targetBounds,
      square,
      snap,
      zoom: this.#snapshot.viewport.zoom,
    })
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        bounds: { ...resolved.bounds },
        guides: [...resolved.guides],
      },
    })
  }

  commitResize(pointerId: number): CanvasResizeCommit | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'resizing' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    if (boundsEqual(interaction.bounds, interaction.initialBounds)) return null
    return {
      initialBounds: interaction.initialBounds,
      bounds: interaction.bounds,
      initialNodeBounds: interaction.initialNodeBounds,
    }
  }

  updateConnection(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    const candidates = this.#candidates
    if (
      interaction.type !== 'connecting' ||
      interaction.pointerId !== pointerId ||
      candidates?.type !== 'connecting'
    ) {
      return
    }
    const target = candidates.index.find(
      interaction.source.nodeId,
      point,
      20 / this.#snapshot.viewport.zoom,
    )
    this.#publish({
      ...this.#snapshot,
      interaction: { ...interaction, current: point, target },
    })
  }

  commitConnection(
    pointerId: number,
  ): Readonly<{ source: CanvasConnectionAnchor; target: CanvasConnectionAnchor }> | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'connecting' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    return interaction.target ? { source: interaction.source, target: interaction.target } : null
  }

  updateErasing(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    const candidates = this.#candidates
    if (
      interaction.type !== 'erasing' ||
      interaction.pointerId !== pointerId ||
      candidates?.type !== 'erasing'
    ) {
      return
    }
    const nodeIds = candidates.index.erase([interaction.current, point], interaction.nodeIds)
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        current: point,
        nodeIds: new Set(Array.from(nodeIds).slice(0, CANVAS_WORKLOAD_LIMITS.selectedElements)),
      },
    })
  }

  commitErasing(pointerId: number): ReadonlySet<CanvasNodeId> | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'erasing' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    return interaction.nodeIds.size > 0 ? new Set(interaction.nodeIds) : null
  }

  updateDrawing(
    pointerId: number,
    points: ReadonlyArray<CanvasDrawPoint>,
    constrain: boolean,
  ): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (
      interaction.type !== 'drawing' ||
      interaction.pointerId !== pointerId ||
      points.length === 0
    ) {
      return
    }
    let rawPoints = interaction.rawPoints
    let sampleDistance = interaction.sampleDistance
    for (const point of points) {
      const sampled = appendDrawPoint(rawPoints, point, sampleDistance)
      rawPoints = sampled.points
      sampleDistance = sampled.sampleDistance
    }
    const current = points[points.length - 1]!
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        rawPoints,
        current,
        sampleDistance,
        constrain,
      },
    })
  }

  commitDrawing(
    pointerId: number,
  ): Readonly<{ points: ReadonlyArray<CanvasDrawPoint>; style: CanvasDrawStyle }> | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'drawing' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    const points = getCanvasDrawingPoints(interaction)
    return points.length >= 2 ? { points, style: interaction.style } : null
  }

  updateDrag(pointerId: number, point: CanvasPoint, constrain = false, snap = false): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    const candidates = this.#candidates
    if (
      interaction.type !== 'dragging' ||
      interaction.pointerId !== pointerId ||
      candidates?.type !== 'dragging'
    ) {
      return
    }
    const unconstrainedDelta = {
      x: point.x - interaction.anchor.x,
      y: point.y - interaction.anchor.y,
    }
    const translated = canvasBoundsUnion(
      candidates.draggedBounds.map((bounds) => ({
        ...bounds,
        x: bounds.x + unconstrainedDelta.x,
        y: bounds.y + unconstrainedDelta.y,
      })),
    )
    const targetBounds =
      snap && !constrain && translated
        ? candidates.index.near(translated, canvasSnapThreshold(this.#snapshot.viewport.zoom))
        : []
    const resolved = resolveCanvasDrag({
      delta: unconstrainedDelta,
      draggedBounds: candidates.draggedBounds,
      targetBounds,
      constrain,
      snap,
      zoom: this.#snapshot.viewport.zoom,
    })
    const { delta, guides } = resolved
    if (
      delta.x === interaction.delta.x &&
      delta.y === interaction.delta.y &&
      snapGuidesEqual(guides, interaction.guides)
    ) {
      return
    }
    this.#publish({
      ...this.#snapshot,
      interaction: { ...interaction, delta: { ...delta }, guides: [...guides] },
    })
  }

  commitDrag(pointerId: number): ReadonlyMap<CanvasNodeId, CanvasPoint> | null {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'dragging' || interaction.pointerId !== pointerId) return null
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    if (interaction.delta.x === 0 && interaction.delta.y === 0) return null
    return new Map(
      Array.from(interaction.initialPositions, ([nodeId, position]) => [
        nodeId,
        { x: position.x + interaction.delta.x, y: position.y + interaction.delta.y },
      ]),
    )
  }

  beginPan(pointerId: number, anchor: CanvasPoint): void {
    this.#assertActive()
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'panning',
        pointerId,
        anchor,
        initialViewport: this.#snapshot.viewport,
      },
    })
  }

  updatePan(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'panning' || interaction.pointerId !== pointerId) return
    this.setViewport({
      ...interaction.initialViewport,
      x: interaction.initialViewport.x + point.x - interaction.anchor.x,
      y: interaction.initialViewport.y + point.y - interaction.anchor.y,
    })
  }

  commitPan(pointerId: number): boolean {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'panning' || interaction.pointerId !== pointerId) return false
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
    this.#notifyViewportCommit(this.#snapshot.viewport)
    return true
  }

  editNode(
    nodeId: CanvasNodeId,
    activation: Readonly<{ x: number; y: number }> | null = null,
  ): void {
    this.#assertActive()
    if (
      this.#snapshot.interaction.type === 'editing' &&
      this.#snapshot.interaction.nodeId === nodeId &&
      this.#snapshot.interaction.activation === activation
    ) {
      return
    }
    this.#publish({ ...this.#snapshot, interaction: { type: 'editing', nodeId, activation } })
  }

  finishEditing(): void {
    this.#assertActive()
    if (this.#snapshot.interaction.type !== 'editing') return
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
  }

  updateSelection(pointerId: number, point: CanvasPoint, square = false): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    const candidates = this.#candidates
    if (
      interaction.type !== 'selecting' ||
      interaction.pointerId !== pointerId ||
      candidates?.type !== 'selecting'
    ) {
      return
    }
    if (interaction.kind === 'marquee') {
      const current = square ? squareSelectionPoint(interaction.origin, point) : point
      const bounds = canvasBoundsFromPoints(interaction.origin, current)
      const distance = Math.hypot(bounds.width, bounds.height) * this.#snapshot.viewport.zoom
      const result =
        distance <= 1 ? null : candidates.index.rectangle(bounds, this.#snapshot.viewport.zoom)
      this.#publish({
        ...this.#snapshot,
        interaction: {
          ...interaction,
          current,
          candidate: result ? cloneSelection(result) : null,
        },
      })
      return
    }
    const sampled = appendGesturePoint(interaction.points, point, interaction.sampleDistance)
    const polygon = lassoPoints(sampled.points, point)
    const result = polygon.length < 3 ? null : candidates.index.polygon(polygon)
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        points: sampled.points,
        current: point,
        sampleDistance: sampled.sampleDistance,
        candidate: result ? cloneSelection(result) : null,
      },
    })
  }

  commitSelection(pointerId: number): boolean {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'selecting' || interaction.pointerId !== pointerId) return false
    if (interaction.candidate === null) {
      this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
      return false
    }
    const selection = getVisualCanvasSelection(this.#snapshot)
    this.#publish({
      ...this.#snapshot,
      selection: cloneSelection(selection),
      interaction: { type: 'idle' },
    })
    return true
  }

  cancelInteraction(): void {
    this.#assertActive()
    if (this.#snapshot.interaction.type === 'idle') return
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
  }

  reconcileDocument(nodeIds: ReadonlySet<CanvasNodeId>, edgeIds: ReadonlySet<string>): void {
    this.#assertActive()
    const selection = filterSelection(this.#snapshot.selection, nodeIds, edgeIds)
    const currentInteraction = this.#snapshot.interaction
    const interaction = reconcileInteraction(currentInteraction, nodeIds, edgeIds)
    if (
      selectionsEqual(selection, this.#snapshot.selection) &&
      interaction === currentInteraction
    ) {
      return
    }
    this.#publish({ ...this.#snapshot, selection, interaction })
  }

  setViewport(viewport: CanvasViewport, commit = false): void {
    this.#assertActive()
    const nextViewport = normalizeViewport(viewport)
    if (
      nextViewport.x !== this.#snapshot.viewport.x ||
      nextViewport.y !== this.#snapshot.viewport.y ||
      nextViewport.zoom !== this.#snapshot.viewport.zoom
    ) {
      this.#publish({ ...this.#snapshot, viewport: nextViewport })
    }
    if (commit) this.#notifyViewportCommit(nextViewport)
  }

  panBy(delta: CanvasPoint, commit = false): void {
    const { viewport } = this.#snapshot
    this.setViewport({ ...viewport, x: viewport.x + delta.x, y: viewport.y + delta.y }, commit)
  }

  zoomTo(zoom: number, center: CanvasPoint = { x: 0, y: 0 }, commit = false): void {
    const viewport = this.#snapshot.viewport
    const nextZoom = normalizeViewport({ ...viewport, zoom }).zoom
    const scale = nextZoom / viewport.zoom
    this.setViewport(
      {
        x: center.x - (center.x - viewport.x) * scale,
        y: center.y - (center.y - viewport.y) * scale,
        zoom: nextZoom,
      },
      commit,
    )
  }

  commitViewport(): void {
    this.#assertActive()
    this.#notifyViewportCommit(this.#snapshot.viewport)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#candidates = null
    this.#listeners.clear()
    this.#viewportCommitListeners.clear()
  }

  #publish(snapshot: CanvasInteractionSnapshot): void {
    const nextSnapshot = CREATION_TOOLS.has(snapshot.tool)
      ? { ...snapshot, selection: emptySelection() }
      : snapshot
    if (this.#candidates?.type !== nextSnapshot.interaction.type) this.#candidates = null
    this.#snapshot = nextSnapshot
    for (const listener of this.#listeners) listener()
  }

  #notifyViewportCommit(viewport: CanvasViewport): void {
    for (const listener of this.#viewportCommitListeners) listener(viewport)
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('CanvasInteractionController is disposed')
  }
}

function normalizeToolSettings(settings: CanvasToolSettings): CanvasToolSettings {
  if (
    settings.edgeType !== 'bezier' &&
    settings.edgeType !== 'straight' &&
    settings.edgeType !== 'step'
  ) {
    throw new TypeError('Canvas edge type is invalid')
  }
  const strokeColor = settings.strokeColor.trim()
  if (strokeColor.length === 0) throw new TypeError('Canvas stroke color cannot be empty')
  if (
    !Number.isFinite(settings.strokeSize) ||
    settings.strokeSize < 1 ||
    settings.strokeSize > 99
  ) {
    throw new TypeError('Canvas stroke size must be between one and ninety-nine')
  }
  if (
    !Number.isFinite(settings.strokeOpacity) ||
    settings.strokeOpacity < 0 ||
    settings.strokeOpacity > 100
  ) {
    throw new TypeError('Canvas stroke opacity must be between zero and one hundred')
  }
  return {
    edgeType: settings.edgeType,
    strokeColor,
    strokeOpacity: settings.strokeOpacity,
    strokeSize: settings.strokeSize,
  }
}

function drawPoint(point: CanvasPoint, pressure: number): CanvasDrawPoint {
  return [point.x, point.y, Number.isFinite(pressure) && pressure > 0 ? Math.min(1, pressure) : 0.5]
}
