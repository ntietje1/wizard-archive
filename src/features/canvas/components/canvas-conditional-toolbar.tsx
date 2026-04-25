import { useMemo, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  getCanvasEdgeInspectableProperties,
  normalizeCanvasEdge,
  resolveCanvasEdgeType,
} from '../edges/canvas-edge-registry'
import type { CanvasEdgePatch, CanvasEdgeType } from '../edges/canvas-edge-types'
import { useCanvasRuntime } from '../runtime/providers/canvas-runtime'
import {
  getCanvasNodeInspectableProperties,
  normalizeCanvasNode,
} from '../nodes/canvas-node-modules'
import { CANVAS_REORDER_ACTIONS } from '../runtime/document/canvas-reorder-actions'
import { measureCanvasPerformance } from '../runtime/performance/canvas-performance-metrics'
import { canvasToolSpecs } from '../tools/canvas-tool-modules'
import { useCanvasToolPropertyContext, useCanvasToolStore } from '../stores/canvas-tool-store'
import { linePaintCanvasProperty } from '../properties/canvas-property-definitions'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import {
  areCanvasPropertyEdgesEqual,
  areCanvasPropertyNodesEqual,
  selectCanvasSelectedEdges,
  selectCanvasSelectedNodes,
} from '../system/canvas-engine-selectors'
import { createCanvasPropertySessionController } from '../system/canvas-property-session-controller'
import type { CanvasPropertyPatchSet } from '../system/canvas-property-session-controller'
import { areCanvasSelectionsEqual } from '../system/canvas-selection'
import { resolveCanvasProperties } from '../properties/resolve-canvas-properties'
import {
  EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  readResolvedPropertyValue,
} from '../properties/canvas-property-types'
import type {
  CanvasInspectableProperties,
  CanvasPaintResolvedProperty,
  CanvasResolvedProperty,
  CanvasStrokeSizeResolvedProperty,
} from '../properties/canvas-property-types'
import { areCanvasPaintValuesEqual } from '../properties/canvas-paint-values'
import type { CanvasCommands } from '../runtime/document/use-canvas-commands'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { useShallow } from 'zustand/shallow'

interface CanvasConditionalToolbarProps {
  canEdit: boolean
}

const CHECKERBOARD_PATTERN = [
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
].join(', ')
const CANVAS_EDGE_TYPE_OPTIONS: Array<{ type: CanvasEdgeType; label: string }> = [
  { type: 'bezier', label: 'Bezier' },
  { type: 'straight', label: 'Straight' },
  { type: 'step', label: 'Step' },
]
const STROKE_SIZE_SLIDER_MAX = 50
const PAINT_SWATCH_STRIP_WIDTH = `calc(${linePaintCanvasProperty.options.length} * 1.5rem + ${
  linePaintCanvasProperty.options.length - 1
} * 0.25rem)`

function isPaintProperty(
  property: CanvasResolvedProperty,
): property is CanvasPaintResolvedProperty {
  return property.definition.kind === 'paint'
}

function isStrokeSizeProperty(
  property: CanvasResolvedProperty,
): property is CanvasStrokeSizeResolvedProperty {
  return property.definition.kind === 'strokeSize'
}

type CanvasToolbarState = {
  commands: CanvasCommands
  edgeType: CanvasEdgeType
  hasOnlySelectedEdges: boolean
  hasSelection: boolean
  properties: Array<CanvasResolvedProperty>
  selectedEdges: ReadonlyArray<Edge>
  selectionSnapshot: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
  setEdgeType: (type: CanvasEdgeType) => void
  showsEdgeToolDefaults: boolean
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void
  runPropertyChange: (applyChange: () => void) => void
  runPropertyPreviewChange: (applyChange: () => void) => void
  commitPropertyPreviewChange: (applyChange?: () => void) => void
  cancelPropertyPreviewChange: () => void
}

function useCanvasToolbarState(): CanvasToolbarState {
  const { canvasEngine, nodeActions, commands, documentWriter } = useCanvasRuntime()
  const selectedNodes = useCanvasEngineSelector(
    selectCanvasSelectedNodes,
    areCanvasPropertyNodesEqual,
  )
  const selectedEdges = useCanvasEngineSelector(
    selectCanvasSelectedEdges,
    areCanvasPropertyEdgesEqual,
  )
  const selectionSnapshot = useCanvasEngineSelector(
    (state) => ({
      nodeIds: state.selection.nodeIds,
      edgeIds: state.selection.edgeIds,
    }),
    areCanvasSelectionsEqual,
  )
  const { activeTool, edgeType, setEdgeType } = useCanvasToolStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      edgeType: state.edgeType,
      setEdgeType: state.setEdgeType,
    })),
  )
  const toolPropertyContext = useCanvasToolPropertyContext()

  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0
  const hasOnlySelectedEdges = selectedNodes.length === 0 && selectedEdges.length > 0
  const showsEdgeToolDefaults = !hasSelection && activeTool === 'edge'
  const pendingNodeDataPatchesRef = useRef<Map<string, Record<string, unknown>> | null>(null)
  const pendingEdgePatchesRef = useRef<Map<string, CanvasEdgePatch> | null>(null)
  const propertySessionController = useMemo(() => createCanvasPropertySessionController(), [])

  const patchNodeDataForProperty = (nodeId: string, data: Record<string, unknown>) => {
    const pendingNodeDataPatches = pendingNodeDataPatchesRef.current
    if (!pendingNodeDataPatches) {
      const updates = new Map([[nodeId, data]])
      canvasEngine.scheduleNodeDataPatches(updates)
      documentWriter.patchNodeData(updates)
      return
    }

    pendingNodeDataPatches.set(nodeId, {
      ...pendingNodeDataPatches.get(nodeId),
      ...data,
    })
  }

  const patchEdgeForProperty = (edgeId: string, patch: CanvasEdgePatch) => {
    const pendingEdgePatches = pendingEdgePatchesRef.current
    if (!pendingEdgePatches) {
      const updates = new Map([[edgeId, patch]])
      canvasEngine.scheduleEdgePatches(updates)
      documentWriter.patchEdges(updates)
      return
    }

    const existingPatch = pendingEdgePatches.get(edgeId)
    pendingEdgePatches.set(
      edgeId,
      existingPatch
        ? {
            ...existingPatch,
            ...patch,
            style: patch.style ? { ...existingPatch.style, ...patch.style } : existingPatch.style,
          }
        : patch,
    )
  }

  const properties = measureCanvasPerformance(
    'canvas.toolbar.resolve-properties',
    {
      selectedEdgeCount: selectedEdges.length,
      selectedNodeCount: selectedNodes.length,
    },
    () =>
      resolveProperties(
        activeTool,
        selectedNodes,
        selectedEdges,
        patchNodeDataForProperty,
        patchEdgeForProperty,
        toolPropertyContext,
      ),
  )
  const collectPropertyPatches = (applyChange: () => void): CanvasPropertyPatchSet => {
    pendingNodeDataPatchesRef.current = new Map()
    pendingEdgePatchesRef.current = new Map()
    try {
      applyChange()
      return {
        nodeDataPatches: pendingNodeDataPatchesRef.current ?? new Map(),
        edgePatches: pendingEdgePatchesRef.current ?? new Map(),
      }
    } finally {
      pendingNodeDataPatchesRef.current = null
      pendingEdgePatchesRef.current = null
    }
  }

  const previewPropertyPatches = (patches: CanvasPropertyPatchSet) => {
    canvasEngine.scheduleNodeDataPatches(patches.nodeDataPatches)
    canvasEngine.scheduleEdgePatches(patches.edgePatches)
  }

  const commitPropertyPatches = (patches: CanvasPropertyPatchSet) => {
    const applyCommittedPatches = () => {
      previewPropertyPatches(patches)
      documentWriter.patchNodeData(patches.nodeDataPatches)
      documentWriter.patchEdges(patches.edgePatches)
    }

    if (nodeActions.transact) {
      nodeActions.transact(applyCommittedPatches)
      return
    }

    applyCommittedPatches()
  }

  const runPropertyChange = (applyChange: () => void) => {
    measureCanvasPerformance(
      'canvas.toolbar.apply-property',
      {
        selectedEdgeCount: selectedEdges.length,
        selectedNodeCount: selectedNodes.length,
      },
      () => {
        if (selectedNodes.length === 0 && selectedEdges.length === 0) {
          applyChange()
          return
        }

        commitPropertyPatches(collectPropertyPatches(applyChange))
      },
    )
  }

  const runPropertyPreviewChange = (applyChange: () => void) => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      applyChange()
      return
    }

    propertySessionController.startPropertySession({
      collectPatches: collectPropertyPatches,
      previewPatches: previewPropertyPatches,
      commitPatches: (patches) => {
        measureCanvasPerformance(
          'canvas.toolbar.commit-property-preview',
          {
            selectedEdgeCount: selectedEdges.length,
            selectedNodeCount: selectedNodes.length,
          },
          () => commitPropertyPatches(patches),
        )
      },
    })
    measureCanvasPerformance(
      'canvas.toolbar.preview-property',
      {
        selectedEdgeCount: selectedEdges.length,
        selectedNodeCount: selectedNodes.length,
      },
      () => propertySessionController.updatePropertyPreview(applyChange),
    )
  }

  const commitPropertyPreviewChange = (applyChange?: () => void) => {
    propertySessionController.commitPropertySession(applyChange)
  }

  const cancelPropertyPreviewChange = () => {
    propertySessionController.cancelPropertySession()
  }

  return {
    commands,
    edgeType,
    hasOnlySelectedEdges,
    hasSelection,
    properties,
    selectedEdges,
    selectionSnapshot,
    setEdgeType,
    showsEdgeToolDefaults,
    patchEdge: patchEdgeForProperty,
    runPropertyChange,
    runPropertyPreviewChange,
    commitPropertyPreviewChange,
    cancelPropertyPreviewChange,
  }
}

export function CanvasConditionalToolbar({ canEdit }: CanvasConditionalToolbarProps) {
  const isSelectionGestureActive = useCanvasEngineSelector(
    (state) => state.selection.gestureKind !== null,
  )
  const toolbar = useCanvasToolbarState()
  if (
    !canEdit ||
    isSelectionGestureActive ||
    (toolbar.properties.length === 0 && !toolbar.hasSelection)
  ) {
    return null
  }

  return (
    <div
      className="absolute top-4 left-4 z-10 flex cursor-default select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      {toolbar.properties.length > 0 ? (
        <CanvasPropertyControls
          properties={toolbar.properties}
          onPropertyChange={toolbar.runPropertyChange}
          onPropertyPreviewChange={toolbar.runPropertyPreviewChange}
          onPropertyPreviewCommit={toolbar.commitPropertyPreviewChange}
          onPropertyPreviewCancel={toolbar.cancelPropertyPreviewChange}
        />
      ) : null}
      {toolbar.properties.length > 0 &&
      (toolbar.hasOnlySelectedEdges || toolbar.showsEdgeToolDefaults) ? (
        <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
      ) : null}
      {toolbar.hasOnlySelectedEdges ? (
        <CanvasEdgeTypeControls
          selectedType={getSharedSelectedEdgeType(toolbar.selectedEdges)}
          onSelectType={(type) =>
            toolbar.runPropertyChange(() => {
              toolbar.selectedEdges.forEach((edge) => {
                if (resolveCanvasEdgeType(edge.type) === type) return

                toolbar.patchEdge(edge.id, { type })
              })
            })
          }
        />
      ) : null}
      {toolbar.showsEdgeToolDefaults ? (
        <CanvasEdgeTypeControls
          selectedType={toolbar.edgeType}
          onSelectType={toolbar.setEdgeType}
        />
      ) : null}
      {(toolbar.properties.length > 0 ||
        toolbar.hasOnlySelectedEdges ||
        toolbar.showsEdgeToolDefaults) &&
      toolbar.hasSelection ? (
        <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
      ) : null}
      {toolbar.hasSelection ? (
        <CanvasReorderControls commands={toolbar.commands} selection={toolbar.selectionSnapshot} />
      ) : null}
    </div>
  )
}

function getSharedSelectedEdgeType(edges: ReadonlyArray<Edge>) {
  const firstEdgeType = edges[0] ? resolveCanvasEdgeType(edges[0].type) : null
  return firstEdgeType && edges.every((edge) => resolveCanvasEdgeType(edge.type) === firstEdgeType)
    ? firstEdgeType
    : null
}

function CanvasEdgeTypeControls({
  selectedType,
  onSelectType,
}: {
  selectedType: CanvasEdgeType | null
  onSelectType: (type: CanvasEdgeType) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">Edge type</p>
      <div className="flex items-center gap-1">
        {CANVAS_EDGE_TYPE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.type}
            className={`flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium hover:bg-accent ${
              selectedType === option.type ? 'bg-accent' : ''
            }`}
            onClick={() => onSelectType(option.type)}
            aria-label={`Change edge type to ${option.label}`}
            aria-pressed={selectedType === option.type}
            title={option.label}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function resolveProperties(
  activeTool: CanvasToolId,
  selectedNodes: ReadonlyArray<Node>,
  selectedEdges: ReadonlyArray<Edge>,
  patchNodeData: (nodeId: string, data: Record<string, unknown>) => void,
  patchEdge: (edgeId: string, patch: CanvasEdgePatch) => void,
  toolPropertyContext: CanvasToolPropertyContext,
): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0 || selectedEdges.length > 0) {
    const selectedProperties = [
      ...selectedNodes.map<CanvasInspectableProperties>((node) =>
        getCanvasNodeInspectableProperties(normalizeCanvasNode(node), patchNodeData),
      ),
      ...selectedEdges.map<CanvasInspectableProperties>((edge) =>
        getCanvasEdgeInspectableProperties(normalizeCanvasEdge(edge), patchEdge),
      ),
    ]

    return resolveCanvasProperties(selectedProperties)
  }

  return resolveCanvasProperties([
    canvasToolSpecs[activeTool]?.properties?.(toolPropertyContext) ??
      EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  ])
}

function CanvasPropertyControls({
  properties,
  onPropertyChange,
  onPropertyPreviewChange,
  onPropertyPreviewCommit,
  onPropertyPreviewCancel,
}: {
  properties: Array<CanvasResolvedProperty>
  onPropertyChange: (applyChange: () => void) => void
  onPropertyPreviewChange: (applyChange: () => void) => void
  onPropertyPreviewCommit: (applyChange?: () => void) => void
  onPropertyPreviewCancel: () => void
}) {
  const paintProperties = properties.filter(isPaintProperty)
  const strokeSizeProperty = properties.find(isStrokeSizeProperty)
  const strokeSizeValue = readResolvedPropertyValue(strokeSizeProperty)

  return (
    <>
      {paintProperties.map((paintProperty) => {
        const paintValue =
          paintProperty.value.kind === 'value' ? paintProperty.value.value : undefined
        const disabled = paintProperty.definition.id === 'linePaint' && strokeSizeValue === 0

        return (
          <div key={paintProperty.definition.id} className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {paintProperty.definition.label}
            </p>
            <div className={`flex items-center gap-1 ${disabled ? 'opacity-50' : ''}`}>
              {paintProperty.definition.options.map((preset) => (
                <button
                  type="button"
                  key={`${preset.label}-${preset.value.color}-${preset.value.opacity}`}
                  className={`h-6 w-6 rounded-sm border border-border text-foreground/15 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    disabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer transition-transform hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: 'var(--background)',
                    backgroundImage: CHECKERBOARD_PATTERN,
                    backgroundPosition: '0 0, 4px 4px',
                    backgroundSize: '8px 8px',
                    outline:
                      paintValue && areCanvasPaintValuesEqual(paintValue, preset.value)
                        ? '2px solid var(--primary)'
                        : 'none',
                    outlineOffset: '1px',
                  }}
                  onClick={() => onPropertyChange(() => paintProperty.setValue(preset.value))}
                  aria-label={`Select ${preset.label} color`}
                  aria-pressed={
                    paintValue ? areCanvasPaintValuesEqual(paintValue, preset.value) : false
                  }
                  disabled={disabled}
                  title={preset.label}
                >
                  <span
                    className="block h-full w-full rounded-sm"
                    style={{
                      backgroundColor: preset.value.color,
                      opacity: preset.value.opacity / 100,
                    }}
                  />
                </button>
              ))}
              <div className="mx-1 h-6 w-px bg-border" />
              <ColorPickerPopover
                value={paintValue ?? paintProperty.definition.defaultValue}
                onChange={(value) => onPropertyChange(() => paintProperty.setValue(value))}
                disabled={disabled}
                mixed={paintProperty.value.kind === 'mixed'}
              />
            </div>
          </div>
        )
      })}
      {strokeSizeProperty && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            {strokeSizeProperty.definition.label}
          </p>
          <StrokeSizeControl
            property={strokeSizeProperty}
            onPropertyChange={onPropertyChange}
            onPropertyPreviewChange={onPropertyPreviewChange}
            onPropertyPreviewCommit={onPropertyPreviewCommit}
            onPropertyPreviewCancel={onPropertyPreviewCancel}
          />
        </div>
      )}
    </>
  )
}

function StrokeSizeControl({
  property,
  onPropertyChange,
  onPropertyPreviewChange,
  onPropertyPreviewCommit,
  onPropertyPreviewCancel,
}: {
  property: CanvasStrokeSizeResolvedProperty
  onPropertyChange: (applyChange: () => void) => void
  onPropertyPreviewChange: (applyChange: () => void) => void
  onPropertyPreviewCommit: (applyChange?: () => void) => void
  onPropertyPreviewCancel: () => void
}) {
  const strokeSizeValue = readResolvedPropertyValue(property)
  const sliderMax = Math.min(property.definition.max, STROKE_SIZE_SLIDER_MAX)
  const sliderValue = Math.min(strokeSizeValue ?? property.definition.min, sliderMax)
  const [draftValue, setDraftValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputValue = draftValue ?? strokeSizeValue?.toString() ?? ''

  const resetDraftValue = () => {
    setDraftValue(null)
  }

  const commitDraftValue = () => {
    if (draftValue === null) {
      return
    }

    if (draftValue.length === 0) {
      resetDraftValue()
      return
    }

    const nextValue = Number.parseInt(draftValue, 10)
    if (
      !Number.isFinite(nextValue) ||
      nextValue < property.definition.min ||
      nextValue > property.definition.max
    ) {
      resetDraftValue()
      return
    }

    onPropertyChange(() => property.setValue(nextValue))
  }

  return (
    <div className="flex min-w-[19.8125rem] items-center gap-1">
      <div className="min-w-0 shrink-0" style={{ width: PAINT_SWATCH_STRIP_WIDTH }}>
        <input
          key={`${property.definition.id}-${property.value.kind}-${sliderValue}`}
          aria-label="Stroke size"
          className="h-6 w-full cursor-pointer accent-primary"
          data-slot="slider"
          defaultValue={sliderValue}
          max={sliderMax}
          min={property.definition.min}
          onInput={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (!Number.isFinite(nextValue)) {
              return
            }

            if (inputRef.current) {
              inputRef.current.value = String(nextValue)
            }
            onPropertyPreviewChange(() => property.setValue(nextValue))
          }}
          onPointerCancel={() => {
            onPropertyPreviewCancel()
            if (inputRef.current) {
              inputRef.current.value = inputValue
            }
          }}
          onPointerUp={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (!Number.isFinite(nextValue)) {
              onPropertyPreviewCancel()
              return
            }

            setDraftValue(null)
            onPropertyPreviewCommit(() => property.setValue(nextValue))
          }}
          onKeyUp={(event) => {
            if (
              !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)
            ) {
              return
            }

            const nextValue = Number(event.currentTarget.value)
            if (Number.isFinite(nextValue)) {
              onPropertyPreviewCommit(() => property.setValue(nextValue))
            }
          }}
          step={property.definition.step ?? 1}
          type="range"
        />
      </div>
      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
        <input
          ref={inputRef}
          aria-label="Stroke size input"
          className="block h-full w-full appearance-none cursor-text bg-transparent p-0 text-center text-xs leading-6 tabular-nums outline-none placeholder:text-muted-foreground"
          inputMode="numeric"
          maxLength={2}
          onBlur={commitDraftValue}
          onChange={(event) => {
            const sanitizedValue = event.currentTarget.value.replace(/\D/g, '').slice(0, 2)
            setDraftValue(sanitizedValue)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraftValue()
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              resetDraftValue()
              event.currentTarget.blur()
            }
          }}
          placeholder={property.value.kind === 'mixed' ? '--' : undefined}
          type="text"
          value={inputValue}
        />
      </div>
    </div>
  )
}

function CanvasReorderControls({
  commands,
  selection,
}: {
  commands: CanvasCommands
  selection: { nodeIds: ReadonlySet<string>; edgeIds: ReadonlySet<string> }
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">Reorder</p>
      <div className="flex items-center gap-1">
        {CANVAS_REORDER_ACTIONS.map((action) => {
          const Icon = action.icon
          const disabled = !commands.reorder.canRun({
            selection,
            direction: action.direction,
          })

          return (
            <button
              type="button"
              key={action.id}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                commands.reorder.run({
                  selection,
                  direction: action.direction,
                })
              }
              disabled={disabled}
              aria-label={action.label}
              title={action.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
