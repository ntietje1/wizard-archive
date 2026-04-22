import { useNodes } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import {
  useIsCanvasSelectionGestureActive,
  useSelectedCanvasNodeIds,
} from '../runtime/selection/use-canvas-selection-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasToolPropertyContext } from '../stores/canvas-tool-state-controls'
import { getCanvasNodeProperties } from '../nodes/canvas-node-registry'
import { getCanvasToolProperties } from '../tools/canvas-tool-modules'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { useCanvasNodeActionsContext } from '../runtime/providers/canvas-runtime-hooks'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import { resolveCanvasProperties } from '../properties/resolve-canvas-properties'
import { readResolvedPropertyValue } from '../properties/canvas-property-types'
import type {
  CanvasInspectableProperties,
  CanvasPaintResolvedProperty,
  CanvasResolvedProperty,
  CanvasStrokeSizeResolvedProperty,
} from '../properties/canvas-property-types'
import { areCanvasPaintValuesEqual } from '../properties/canvas-paint-values'

interface CanvasConditionalToolbarProps {
  canEdit: boolean
}

const CHECKERBOARD_PATTERN = [
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
  'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%, currentColor)',
].join(', ')

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
  const nodes = useNodes()
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const isSelectionGestureActive = useIsCanvasSelectionGestureActive()
  const activeTool = useCanvasToolStore((state) => state.activeTool)
  const toolPropertyContext = useCanvasToolPropertyContext()

  const selectedNodeIdSet = new Set(selectedNodeIds)
  const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id))

  const properties = resolveProperties(
    activeTool,
    isSelectionGestureActive ? [] : selectedNodes,
    updateNodeData,
    toolPropertyContext,
  )
  const runPropertyChange = (applyChange: () => void) => {
    if (selectedNodes.length === 0 || !transact) {
      applyChange()
      return
    }

    transact(applyChange)
  }
  if (!canEdit || properties.length === 0) return null

  return (
    <div
      className="absolute top-4 left-4 z-10 flex select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      <CanvasPropertyControls properties={properties} onPropertyChange={runPropertyChange} />
    </div>
  )
}

function resolveProperties(
  activeTool: CanvasToolId,
  selectedNodes: Array<Node>,
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void,
  toolPropertyContext: CanvasToolPropertyContext,
): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0) {
    const selectedNodeProperties = selectedNodes.map<CanvasInspectableProperties>(
      (node) => getCanvasNodeProperties(node, updateNodeData) ?? { bindings: [] },
    )

    return resolveCanvasProperties(selectedNodeProperties)
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

  return (
    <>
      {paintProperties.map((paintProperty) => {
        const paintValue =
          paintProperty.value.kind === 'value' ? paintProperty.value.value : undefined

        return (
          <div key={paintProperty.definition.id} className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {paintProperty.definition.label}
            </p>
            <div className="flex items-center gap-1">
              {paintProperty.definition.options.map((preset) => (
                <button
                  type="button"
                  key={`${preset.label}-${preset.value.color}-${preset.value.opacity}`}
                  className="h-6 w-6 rounded-sm border border-border text-foreground/15 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
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

  return (
    <div className="grid w-full min-w-[17rem] grid-cols-10 gap-0.5">
      {property.definition.options.map((size) => (
        <button
          type="button"
          key={size}
          className={`flex h-8 w-full items-center justify-center rounded-md hover:bg-accent ${
            strokeSizeValue === size ? 'bg-accent' : ''
          }`}
          onClick={() => onPropertyChange(() => property.setValue(size))}
          aria-label={`Stroke size ${size}`}
          aria-pressed={strokeSizeValue === size}
          title={`Size ${size}`}
        >
          <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
        </button>
      ))}
    </div>
  )
}
