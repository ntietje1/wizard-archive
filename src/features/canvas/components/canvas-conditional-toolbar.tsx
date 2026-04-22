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
import { Popover, PopoverContent, PopoverTrigger } from '~/features/shadcn/components/popover'
import { Slider } from '~/features/shadcn/components/slider'

interface CanvasConditionalToolbarProps {
  canEdit: boolean
}

const CLEAR_SWATCH_PATTERN =
  'repeating-linear-gradient(135deg, var(--muted-foreground) 0 2px, transparent 2px 6px)'

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
                  className="h-6 w-6 rounded-sm border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  style={{
                    backgroundColor: 'transparent',
                    backgroundImage: CLEAR_SWATCH_PATTERN,
                    outline:
                      paintValue && areCanvasPaintValuesEqual(paintValue, preset.value)
                        ? '2px solid var(--primary)'
                        : 'none',
                    outlineOffset: '1px',
                  }}
                  onClick={() => paintProperty.setValue(preset.value)}
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
                onChange={paintProperty.setValue}
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
          <StrokeSizeControl property={strokeSizeProperty} />
        </div>
      )}
    </>
  )
}

function StrokeSizeControl({ property }: { property: CanvasStrokeSizeResolvedProperty }) {
  const strokeSizeValue = readResolvedPropertyValue(property)
  const previewSize = strokeSizeValue ?? property.definition.min

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {property.definition.options.map((size) => (
          <button
            type="button"
            key={size}
            className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent ${
              strokeSizeValue === size ? 'bg-accent' : ''
            }`}
            onClick={() => property.setValue(size)}
            aria-label={`Stroke size ${size}`}
            aria-pressed={strokeSizeValue === size}
            title={`Size ${size}`}
          >
            <div className="rounded-full bg-foreground" style={{ width: size, height: size }} />
          </button>
        ))}
      </div>
      <div className="mx-1 h-6 w-px bg-border" />
      <Popover>
        <PopoverTrigger
          nativeButton={false}
          render={(props) => (
            <button
              {...props}
              type="button"
              className="flex h-8 w-11 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              aria-label={
                strokeSizeValue === undefined
                  ? 'Adjust stroke size (mixed values)'
                  : `Adjust stroke size ${strokeSizeValue}`
              }
              title="Adjust stroke size"
            >
              <div
                className="w-6 rounded-full bg-foreground"
                style={{ height: Math.min(Math.max(previewSize, 1), 18) }}
              />
            </button>
          )}
        />
        <PopoverContent side="bottom" align="end" className="w-44 p-3 allow-motion">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{property.definition.label}</span>
            <span>{strokeSizeValue ?? 'Mixed'}</span>
          </div>
          <Slider
            min={property.definition.min}
            max={property.definition.max}
            step={property.definition.step}
            value={[previewSize]}
            onValueChange={(value) => {
              const nextValue = (value as ReadonlyArray<number>)[0] ?? property.definition.min
              property.setValue(nextValue)
            }}
            aria-label={property.definition.label}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
