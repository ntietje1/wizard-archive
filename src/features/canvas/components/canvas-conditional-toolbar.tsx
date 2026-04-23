import { useState } from 'react'
import { useEdges, useNodes } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { getCanvasEdgeProperties, resolveCanvasEdgeType } from '../edges/canvas-edge-registry'
import {
  useIsCanvasSelectionGestureActive,
  useCanvasSelectionState,
} from '../runtime/selection/use-canvas-selection-state'
import { useCanvasToolPropertyContext, useCanvasToolStore } from '../stores/canvas-tool-store'
import { getCanvasNodeProperties } from '../nodes/canvas-node-modules'
import { CANVAS_REORDER_ACTIONS } from '../runtime/document/canvas-reorder-actions'
import { getCanvasToolProperties } from '../tools/canvas-tool-modules'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import {
  useCanvasCommandsContext,
  useCanvasDocumentWriterContext,
  useCanvasNodeActionsContext,
} from '../runtime/providers/canvas-runtime-hooks'
import type { CanvasEdgeType } from '../edges/canvas-edge-module-types'
import type { CanvasCommands } from '../runtime/document/use-canvas-commands'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import { linePaintCanvasProperty } from '../properties/canvas-property-definitions'
import { resolveCanvasProperties } from '../properties/resolve-canvas-properties'
import { readResolvedPropertyValue } from '../properties/canvas-property-types'
import type {
  CanvasInspectableProperties,
  CanvasPaintResolvedProperty,
  CanvasResolvedProperty,
  CanvasStrokeSizeResolvedProperty,
} from '../properties/canvas-property-types'
import { areCanvasPaintValuesEqual } from '../properties/canvas-paint-values'
import { Slider } from '~/features/shadcn/components/slider'
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

export function CanvasConditionalToolbar({ canEdit }: CanvasConditionalToolbarProps) {
  const { updateNodeData, transact } = useCanvasNodeActionsContext()
  const commands = useCanvasCommandsContext()
  const documentWriter = useCanvasDocumentWriterContext()
  const nodes = useNodes()
  const edges = useEdges()
  const selectionSnapshot = useCanvasSelectionState(
    useShallow((state) => ({
      nodeIds: state.selectedNodeIds,
      edgeIds: state.selectedEdgeIds,
    })),
  )
  const isSelectionGestureActive = useIsCanvasSelectionGestureActive()
  const { activeTool, edgeType, setEdgeType } = useCanvasToolStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      edgeType: state.edgeType,
      setEdgeType: state.setEdgeType,
    })),
  )
  const toolPropertyContext = useCanvasToolPropertyContext()

  const selectedNodeIdSet = new Set(selectionSnapshot.nodeIds)
  const selectedEdgeIdSet = new Set(selectionSnapshot.edgeIds)
  const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id))
  const selectedEdges = edges.filter((edge) => selectedEdgeIdSet.has(edge.id))
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0
  const hasOnlySelectedEdges = selectedNodes.length === 0 && selectedEdges.length > 0
  const showsEdgeToolDefaults = !hasSelection && activeTool === 'edge'

  const properties = resolveProperties(
    activeTool,
    selectedNodes,
    selectedEdges,
    updateNodeData,
    documentWriter.updateEdge,
    toolPropertyContext,
  )
  const runPropertyChange = (applyChange: () => void) => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      applyChange()
      return
    }

    if (!transact) {
      applyChange()
      return
    }

    transact(applyChange)
  }
  if (!canEdit || isSelectionGestureActive || (properties.length === 0 && !hasSelection)) {
    return null
  }

  return (
    <div
      className="absolute top-4 left-4 z-10 flex cursor-default select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      {properties.length > 0 ? (
        <CanvasPropertyControls properties={properties} onPropertyChange={runPropertyChange} />
      ) : null}
      {properties.length > 0 && (hasOnlySelectedEdges || showsEdgeToolDefaults) ? (
        <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
      ) : null}
      {hasOnlySelectedEdges ? (
        <CanvasEdgeTypeControls
          selectedType={getSharedSelectedEdgeType(selectedEdges)}
          onSelectType={(type) =>
            runPropertyChange(() => {
              selectedEdges.forEach((edge) => {
                if (resolveCanvasEdgeType(edge.type) === type) return

                documentWriter.updateEdge(edge.id, (currentEdge) => ({
                  ...currentEdge,
                  type,
                }))
              })
            })
          }
        />
      ) : null}
      {showsEdgeToolDefaults ? (
        <CanvasEdgeTypeControls selectedType={edgeType} onSelectType={setEdgeType} />
      ) : null}
      {(properties.length > 0 || hasOnlySelectedEdges || showsEdgeToolDefaults) && hasSelection ? (
        <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
      ) : null}
      {hasSelection ? (
        <CanvasReorderControls commands={commands} selection={selectionSnapshot} />
      ) : null}
    </div>
  )
}

function getSharedSelectedEdgeType(edges: Array<Edge>) {
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
  selectedNodes: Array<Node>,
  selectedEdges: Array<Edge>,
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void,
  updateEdge: (edgeId: string, updater: (edge: Edge) => Edge) => void,
  toolPropertyContext: CanvasToolPropertyContext,
): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0 || selectedEdges.length > 0) {
    const selectedProperties = [
      ...selectedNodes.map<CanvasInspectableProperties>(
        (node) => getCanvasNodeProperties(node, updateNodeData) ?? { bindings: [] },
      ),
      ...selectedEdges.map<CanvasInspectableProperties>(
        (edge) => getCanvasEdgeProperties(edge, updateEdge) ?? { bindings: [] },
      ),
    ]

    return resolveCanvasProperties(selectedProperties)
  }

  const toolProperties = getCanvasToolProperties(activeTool, toolPropertyContext)
  if (!toolProperties) return []

  return resolveCanvasProperties([toolProperties])
}

function CanvasPropertyControls({
  properties,
  onPropertyChange,
}: {
  properties: Array<CanvasResolvedProperty>
  onPropertyChange: (applyChange: () => void) => void
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
          <StrokeSizeControl property={strokeSizeProperty} onPropertyChange={onPropertyChange} />
        </div>
      )}
    </>
  )
}

function StrokeSizeControl({
  property,
  onPropertyChange,
}: {
  property: CanvasStrokeSizeResolvedProperty
  onPropertyChange: (applyChange: () => void) => void
}) {
  const strokeSizeValue = readResolvedPropertyValue(property)
  const sliderMax = Math.min(property.definition.max, STROKE_SIZE_SLIDER_MAX)
  const sliderValue = Math.min(strokeSizeValue ?? property.definition.min, sliderMax)
  const [draftValue, setDraftValue] = useState<string | null>(null)
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
        <Slider
          aria-label="Stroke size"
          className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary/40 [&_[data-slot=slider-track]]:bg-primary/25"
          max={sliderMax}
          min={property.definition.min}
          onValueChange={(values) => {
            const nextValue = Array.isArray(values) ? values[0] : values
            if (typeof nextValue !== 'number' || !Number.isFinite(nextValue)) {
              return
            }

            setDraftValue(null)
            onPropertyChange(() => property.setValue(nextValue))
          }}
          step={property.definition.step ?? 1}
          value={[sliderValue]}
        />
      </div>
      <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
        <input
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
  selection: { nodeIds: Array<string>; edgeIds: Array<string> }
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
