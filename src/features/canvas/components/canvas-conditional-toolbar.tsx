import { useNodes } from '@xyflow/react'
import { useCanvasSelectionPhase, useSelectedCanvasNodeIds } from '../hooks/useCanvasSelectionState'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { getCanvasNodeProperties } from '../nodes/canvas-node-registry'
import { getCanvasToolProperties } from '../tools/canvas-tool-modules'
import type { Node } from '@xyflow/react'
import { ColorPickerPopover } from '~/shared/components/color-picker-popover'
import { useCanvasRuntimeContext } from '../hooks/canvas-runtime-context'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'
import { resolveCanvasProperties } from '../properties/resolve-canvas-properties'
import { readResolvedPropertyValue } from '../properties/canvas-property-types'
import type {
  CanvasInspectableProperties,
  CanvasPaintResolvedProperty,
  CanvasResolvedProperty,
  CanvasStrokeSizeResolvedProperty,
} from '../properties/canvas-property-types'

interface CanvasConditionalToolbarProps {
  canEdit: boolean
}

const COLOR_NAMES: Record<string, string> = {
  'var(--foreground)': 'Default',
  'var(--t-red)': 'Red',
  'var(--t-orange)': 'Orange',
  'var(--t-yellow)': 'Yellow',
  'var(--t-green)': 'Green',
  'var(--t-blue)': 'Blue',
  'var(--t-purple)': 'Purple',
  'var(--t-pink)': 'Pink',
}

function createToolPropertyContext(): CanvasToolPropertyContext {
  return {
    toolState: {
      getSettings: () => {
        const state = useCanvasToolStore.getState()
        return {
          strokeColor: state.strokeColor,
          strokeOpacity: state.strokeOpacity,
          strokeSize: state.strokeSize,
        }
      },
      setStrokeColor: useCanvasToolStore.getState().setStrokeColor,
      setStrokeSize: useCanvasToolStore.getState().setStrokeSize,
      setStrokeOpacity: useCanvasToolStore.getState().setStrokeOpacity,
    },
  }
}

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
  const {
    nodeActions: { updateNodeData },
  } = useCanvasRuntimeContext()
  const nodes = useNodes()
  const selectedNodeIds = useSelectedCanvasNodeIds()
  const selectionPhase = useCanvasSelectionPhase()
  const activeTool = useCanvasToolStore((state) => state.activeTool)

  const selectedNodeIdSet = new Set(selectedNodeIds)
  const selectedNodes = nodes.filter((node) => selectedNodeIdSet.has(node.id))

  const properties = resolveProperties(
    activeTool,
    selectionPhase === 'idle' ? selectedNodes : [],
    updateNodeData,
  )
  if (!canEdit || properties.length === 0) return null

  return (
    <div
      className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      <CanvasPropertyControls properties={properties} />
    </div>
  )
}

function resolveProperties(
  activeTool: CanvasToolId,
  selectedNodes: Array<Node>,
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void,
): Array<CanvasResolvedProperty> {
  if (selectedNodes.length > 0) {
    const selectedNodeProperties = selectedNodes.flatMap<CanvasInspectableProperties>((node) => [
      getCanvasNodeProperties(node, updateNodeData) ?? { bindings: [] },
    ])

    return resolveCanvasProperties(selectedNodeProperties)
  }

  const toolProperties = getCanvasToolProperties(activeTool, createToolPropertyContext())
  if (!toolProperties) return []

  return resolveCanvasProperties([toolProperties])
}

function CanvasPropertyControls({ properties }: { properties: Array<CanvasResolvedProperty> }) {
  const paintProperty = properties.find(isPaintProperty)
  const strokeSizeProperty = properties.find(isStrokeSizeProperty)

  const strokeSizeValue = readResolvedPropertyValue(strokeSizeProperty)
  const colorValue = paintProperty?.color.kind === 'value' ? paintProperty.color.value : undefined
  const opacityValue =
    paintProperty?.opacity.kind === 'value' ? paintProperty.opacity.value : undefined

  return (
    <>
      {paintProperty &&
        paintProperty.definition.colors.map((color) => (
          <button
            type="button"
            key={color}
            className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            style={{
              backgroundColor: color,
              outline: colorValue === color ? '2px solid var(--primary)' : 'none',
              outlineOffset: '1px',
            }}
            onClick={() => paintProperty.setColor(color)}
            aria-label={`Select ${COLOR_NAMES[color] ?? 'custom'} color`}
            aria-pressed={colorValue === color}
          />
        ))}
      {paintProperty && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <ColorPickerPopover
            value={colorValue}
            onChange={(color) => paintProperty.setColor(color)}
            opacity={opacityValue}
            onOpacityChange={(opacity) => paintProperty.setOpacity(opacity)}
            colorMixed={paintProperty.color.kind === 'mixed'}
            opacityMixed={paintProperty.opacity.kind === 'mixed'}
          />
        </>
      )}
      {strokeSizeProperty && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            {strokeSizeProperty.definition.options.map((size) => (
              <button
                type="button"
                key={size}
                className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${
                  strokeSizeValue === size ? 'bg-accent' : ''
                }`}
                onClick={() => strokeSizeProperty.setValue(size)}
                aria-label={`Stroke size ${size}`}
                title={`Size ${size}`}
              >
                <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
