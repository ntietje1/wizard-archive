import { useNodes } from '@xyflow/react'
import {
  useIsCanvasSelectionGestureActive,
  useSelectedCanvasNodeIds,
} from '../runtime/selection/use-canvas-selection-state'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { useCanvasToolPropertyContext } from '../stores/canvas-tool-state-controls'
import { getCanvasNodeProperties } from '../nodes/canvas-node-registry'
import { getCanvasToolProperties } from '../tools/canvas-tool-modules'
import type { Node } from '@xyflow/react'
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
  const { updateNodeData } = useCanvasNodeActionsContext()
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
  if (!canEdit || properties.length === 0) return null

  return (
    <div
      className="absolute top-4 left-4 z-10 flex flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
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

function CanvasPropertyControls({ properties }: { properties: Array<CanvasResolvedProperty> }) {
  const paintProperties = properties.filter(isPaintProperty)
  const strokeSizeProperty = properties.find(isStrokeSizeProperty)

  const strokeSizeValue = readResolvedPropertyValue(strokeSizeProperty)

  return (
    <>
      {paintProperties.map((paintProperty) => {
        const colorValue =
          paintProperty.color.kind === 'value' ? paintProperty.color.value : undefined
        const opacityValue =
          paintProperty.opacity?.kind === 'value' ? paintProperty.opacity.value : undefined

        return (
          <div key={paintProperty.definition.id} className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {paintProperty.definition.label}
            </p>
            <div className="flex items-center gap-1">
              {paintProperty.definition.allowNone && (
                <button
                  type="button"
                  className="flex h-6 items-center rounded-sm border border-border px-2 text-[11px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  onClick={() => paintProperty.setColor(null)}
                  aria-label={
                    paintProperty.definition.noneLabel ??
                    `No ${paintProperty.definition.label.toLowerCase()}`
                  }
                  aria-pressed={
                    paintProperty.color.kind === 'value' && paintProperty.color.value === null
                  }
                >
                  None
                </button>
              )}
              {paintProperty.definition.colors.map((color) => (
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
              <div className="mx-1 h-6 w-px bg-border" />
              <ColorPickerPopover
                value={colorValue}
                onChange={(color) => paintProperty.setColor(color)}
                opacity={opacityValue}
                onOpacityChange={paintProperty.setOpacity}
                colorMixed={paintProperty.color.kind === 'mixed'}
                opacityMixed={paintProperty.opacity?.kind === 'mixed'}
                allowClear={paintProperty.definition.allowNone}
                clearLabel={paintProperty.definition.noneLabel}
              />
            </div>
          </div>
        )
      })}
      {strokeSizeProperty && (
        <div className="flex items-center gap-0.5">
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
                aria-pressed={strokeSizeValue === size}
                title={`Size ${size}`}
              >
                <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
