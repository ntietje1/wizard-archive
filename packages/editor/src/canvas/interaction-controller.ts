import type { CanvasNodeId } from '../resources/domain-id'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasSnapGuide } from './canvas-snap-geometry'
import { CANVAS_WORKLOAD_LIMITS } from './workload'

export type CanvasTool = 'draw' | 'edge' | 'eraser' | 'hand' | 'lasso' | 'select' | 'text'

export type CanvasPoint = Readonly<{ x: number; y: number }>

export type CanvasViewport = CanvasPoint & Readonly<{ zoom: number }>

export type CanvasSelection = Readonly<{
  nodeIds: ReadonlySet<CanvasNodeId>
  edgeIds: ReadonlySet<string>
}>

export type CanvasSelectionKind = 'lasso' | 'marquee'
export type CanvasSelectionMode = 'add' | 'replace'

export type CanvasDrawStyle = Readonly<{
  color: string
  size: number
  opacity: number
}>

export type CanvasDrawPoint = readonly [x: number, y: number, pressure: number]

export type CanvasConnectionHandle = 'bottom' | 'left' | 'right' | 'top'

export type CanvasConnectionAnchor = Readonly<{
  nodeId: CanvasNodeId
  handle: CanvasConnectionHandle
}>

export type CanvasResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

export type CanvasResizeCommit = Readonly<{
  initialBounds: CanvasBounds
  bounds: CanvasBounds
  initialNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>
}>

export type CanvasInteraction =
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
      constrain: boolean
      style: CanvasDrawStyle
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
    }>
  | Readonly<{
      type: 'erasing'
      pointerId: number
      points: ReadonlyArray<CanvasPoint>
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

export type CanvasInteractionSnapshot = Readonly<{
  tool: CanvasTool
  viewport: CanvasViewport
  selection: CanvasSelection
  interaction: CanvasInteraction
}>

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = Object.freeze({ x: 0, y: 0, zoom: 1 })

const MIN_CANVAS_ZOOM = 0.1
const MAX_CANVAS_ZOOM = 4

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

function appendBoundedPoint<TPoint>(
  points: ReadonlyArray<TPoint>,
  point: TPoint,
  limit: number,
): ReadonlyArray<TPoint> {
  if (points.length < limit) return [...points, point]
  const resampled: Array<TPoint> = [points[0]!]
  for (let index = 2; index < points.length; index += 2) resampled.push(points[index]!)
  if (resampled[resampled.length - 1] !== points[points.length - 1]) {
    resampled.push(points[points.length - 1]!)
  }
  return [...resampled.slice(0, limit - 1), point]
}

function appendDrawPoint(
  points: ReadonlyArray<CanvasDrawPoint>,
  point: CanvasDrawPoint,
): ReadonlyArray<CanvasDrawPoint> {
  const previous = points[points.length - 1]
  if (previous && Math.hypot(point[0] - previous[0], point[1] - previous[1]) < 1) {
    return [...points.slice(0, -1), point]
  }
  return appendBoundedPoint(points, point, CANVAS_WORKLOAD_LIMITS.pointsPerStroke)
}

function appendGesturePoint(
  points: ReadonlyArray<CanvasPoint>,
  point: CanvasPoint,
): ReadonlyArray<CanvasPoint> {
  const previous = points[points.length - 1]
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1) {
    return [...points.slice(0, -1), point]
  }
  return appendBoundedPoint(points, point, CANVAS_WORKLOAD_LIMITS.gesturePoints)
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
  if (!interaction.constrain || interaction.rawPoints.length < 2) return interaction.rawPoints
  const start = interaction.rawPoints[0]
  const end = interaction.rawPoints[interaction.rawPoints.length - 1]
  const deltaX = end[0] - start[0]
  const deltaY = end[1] - start[1]
  return Math.abs(deltaX) >= Math.abs(deltaY)
    ? [start, [end[0], start[1], end[2]]]
    : [start, [start[0], end[1], end[2]]]
}

export function screenToCanvasPoint(
  point: CanvasPoint,
  viewport: CanvasViewport,
  surfaceOrigin: CanvasPoint = { x: 0, y: 0 },
): CanvasPoint {
  return {
    x: (point.x - surfaceOrigin.x - viewport.x) / viewport.zoom,
    y: (point.y - surfaceOrigin.y - viewport.y) / viewport.zoom,
  }
}

export function canvasToScreenPoint(
  point: CanvasPoint,
  viewport: CanvasViewport,
  surfaceOrigin: CanvasPoint = { x: 0, y: 0 },
): CanvasPoint {
  return {
    x: surfaceOrigin.x + viewport.x + point.x * viewport.zoom,
    y: surfaceOrigin.y + viewport.y + point.y * viewport.zoom,
  }
}

export class CanvasInteractionController {
  readonly #listeners = new Set<() => void>()
  readonly #viewportCommitListeners = new Set<(viewport: CanvasViewport) => void>()
  #disposed = false
  #snapshot: CanvasInteractionSnapshot

  constructor(viewport: CanvasViewport = DEFAULT_CANVAS_VIEWPORT) {
    this.#snapshot = {
      tool: 'select',
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
    if (tool === this.#snapshot.tool) return
    this.#publish({ ...this.#snapshot, tool, interaction: { type: 'idle' } })
  }

  setSelection(selection: CanvasSelection): void {
    this.#assertActive()
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
          : { type: 'selecting', kind, pointerId, mode, points: [point], candidate: null },
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

  beginDrawing(
    pointerId: number,
    point: CanvasPoint,
    pressure: number,
    style: CanvasDrawStyle,
  ): void {
    this.#assertActive()
    if (style.color.length === 0 || !Number.isFinite(style.size) || style.size < 1) {
      throw new TypeError('Canvas drawing requires a color and a stroke size of at least one')
    }
    if (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 100) {
      throw new TypeError('Canvas drawing opacity must be between zero and one hundred')
    }
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'drawing',
        pointerId,
        rawPoints: [drawPoint(point, pressure)],
        constrain: false,
        style: { ...style },
      },
    })
  }

  beginErasing(pointerId: number, point: CanvasPoint): void {
    this.#assertActive()
    this.#publish({
      ...this.#snapshot,
      interaction: {
        type: 'erasing',
        pointerId,
        points: [point],
        nodeIds: new Set(),
      },
    })
  }

  beginConnection(pointerId: number, source: CanvasConnectionAnchor, point: CanvasPoint): void {
    this.#assertActive()
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

  updateResize(
    pointerId: number,
    bounds: CanvasBounds,
    guides: ReadonlyArray<CanvasSnapGuide> = [],
  ): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'resizing' || interaction.pointerId !== pointerId) return
    this.#publish({
      ...this.#snapshot,
      interaction: { ...interaction, bounds: { ...bounds }, guides: [...guides] },
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

  updateConnection(
    pointerId: number,
    point: CanvasPoint,
    target: CanvasConnectionAnchor | null,
  ): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'connecting' || interaction.pointerId !== pointerId) return
    this.#publish({ ...this.#snapshot, interaction: { ...interaction, current: point, target } })
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

  updateErasing(pointerId: number, point: CanvasPoint, nodeIds: ReadonlySet<CanvasNodeId>): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'erasing' || interaction.pointerId !== pointerId) return
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        points: appendGesturePoint(interaction.points, point),
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

  updateDrawing(pointerId: number, point: CanvasPoint, pressure: number, constrain: boolean): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'drawing' || interaction.pointerId !== pointerId) return
    this.#publish({
      ...this.#snapshot,
      interaction: {
        ...interaction,
        rawPoints: appendDrawPoint(interaction.rawPoints, drawPoint(point, pressure)),
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

  updateDrag(
    pointerId: number,
    delta: CanvasPoint,
    guides: ReadonlyArray<CanvasSnapGuide> = [],
  ): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'dragging' || interaction.pointerId !== pointerId) return
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

  editNode(nodeId: CanvasNodeId): void {
    this.#assertActive()
    if (
      this.#snapshot.interaction.type === 'editing' &&
      this.#snapshot.interaction.nodeId === nodeId
    ) {
      return
    }
    this.#publish({ ...this.#snapshot, interaction: { type: 'editing', nodeId } })
  }

  finishEditing(): void {
    this.#assertActive()
    if (this.#snapshot.interaction.type !== 'editing') return
    this.#publish({ ...this.#snapshot, interaction: { type: 'idle' } })
  }

  updateSelection(pointerId: number, point: CanvasPoint, candidate: CanvasSelection | null): void {
    this.#assertActive()
    const interaction = this.#snapshot.interaction
    if (interaction.type !== 'selecting' || interaction.pointerId !== pointerId) return
    const nextCandidate = candidate ? cloneSelection(candidate) : null
    this.#publish({
      ...this.#snapshot,
      interaction:
        interaction.kind === 'marquee'
          ? { ...interaction, current: point, candidate: nextCandidate }
          : {
              ...interaction,
              points: appendGesturePoint(interaction.points, point),
              candidate: nextCandidate,
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
    this.#listeners.clear()
    this.#viewportCommitListeners.clear()
  }

  #publish(snapshot: CanvasInteractionSnapshot): void {
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }

  #notifyViewportCommit(viewport: CanvasViewport): void {
    for (const listener of this.#viewportCommitListeners) listener(viewport)
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('CanvasInteractionController is disposed')
  }
}

function drawPoint(point: CanvasPoint, pressure: number): CanvasDrawPoint {
  return [point.x, point.y, Number.isFinite(pressure) && pressure > 0 ? Math.min(1, pressure) : 0.5]
}
