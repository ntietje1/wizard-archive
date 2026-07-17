import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine } from 'lucide-react'
import type { ComponentType, KeyboardEvent, SyntheticEvent } from 'react'
import {
  BASE_BG_COLORS,
  BASE_STROKE_COLORS,
  BASE_TEXT_COLORS,
} from '@wizard-archive/ui/utils/color'
import { CheckerboardSwatch } from '@wizard-archive/ui/components/checkerboard-swatch'
import { ColorPickerPopover } from '@wizard-archive/ui/components/color-picker-popover'
import type { CanvasDocumentController } from './document-controller'
import { resolveCanvasEdgeStyle } from './canvas-edge-style'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasEdgeType,
} from './document-contract'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type { CanvasToolSettings } from './interaction-types'
import { createCanvasPropertyChange, resolveCanvasSharedValue } from './canvas-properties'
import type { CanvasSharedValue } from './canvas-properties'
import { CANVAS_REORDER_ACTIONS, createCanvasReorderChange } from './canvas-z-order'

const EDGE_TYPE_OPTIONS = [
  { type: 'bezier', label: 'Bezier' },
  { type: 'straight', label: 'Straight' },
  { type: 'step', label: 'Step' },
] as const

export function CanvasConditionalToolbar({
  canEdit,
  content,
  documentController,
  interaction,
  interactionController,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
}) {
  const hasSelection =
    interaction.selection.nodeIds.size > 0 || interaction.selection.edgeIds.size > 0
  if (
    !canEdit ||
    interaction.interaction.type === 'editing' ||
    interaction.interaction.type === 'selecting'
  ) {
    return null
  }
  if (hasSelection) {
    return (
      <CanvasSelectionToolbarContent
        content={content}
        documentController={documentController}
        interaction={interaction}
      />
    )
  }
  if (interaction.tool !== 'draw' && interaction.tool !== 'edge') return null

  const setSettings = (settings: Partial<CanvasToolSettings>) =>
    interactionController.setToolSettings({
      ...interactionController.get().toolSettings,
      ...settings,
    })

  return (
    <div
      className="absolute top-4 left-4 z-10 flex cursor-default select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      <div className="flex flex-col gap-1" role="group" aria-label="Stroke">
        <p className="text-[11px] font-medium text-muted-foreground">Stroke</p>
        <div className="flex items-center gap-1">
          {BASE_STROKE_COLORS.map((preset) => (
            <PaintSwatch
              key={preset.color}
              active={interaction.toolSettings.strokeColor === preset.color}
              color={preset.color}
              label={preset.label}
              opacity={interaction.toolSettings.strokeOpacity}
              onSelect={() => setSettings({ strokeColor: preset.color })}
            />
          ))}
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <div onPointerDown={preventToolbarFocus}>
            <ColorPickerPopover
              value={{
                color: interaction.toolSettings.strokeColor,
                opacity: interaction.toolSettings.strokeOpacity,
              }}
              onChange={({ color, opacity }) =>
                setSettings({ strokeColor: color, strokeOpacity: opacity })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1" role="group" aria-label="Stroke size">
        <p className="text-[11px] font-medium text-muted-foreground">Stroke size</p>
        <StrokeSizeControl
          minimum={1}
          value={{ state: 'shared', value: interaction.toolSettings.strokeSize }}
          onChange={(value) => setSettings({ strokeSize: value })}
        />
      </div>

      {interaction.tool === 'edge' ? (
        <>
          <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-medium text-muted-foreground">Edge type</p>
            <div className="flex items-center gap-1">
              {EDGE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium hover:bg-accent ${
                    interaction.toolSettings.edgeType === option.type ? 'bg-accent' : ''
                  }`}
                  aria-label={`Change edge type to ${option.label}`}
                  aria-pressed={interaction.toolSettings.edgeType === option.type}
                  title={option.label}
                  onClick={() => setSettings({ edgeType: option.type })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

type CanvasPaintValue = Readonly<{ color: string; opacity: number }>
type CanvasPropertyCommand = Parameters<typeof createCanvasPropertyChange>[2]
type CanvasSelectionToolbarProperties = Readonly<{
  border: CanvasSharedValue<CanvasPaintValue>
  borderWidth: CanvasSharedValue<number>
  edgeType: CanvasSharedValue<CanvasEdgeType>
  fill: CanvasSharedValue<CanvasPaintValue>
  line: CanvasSharedValue<CanvasPaintValue>
  lineWidth: CanvasSharedValue<number>
  text: CanvasSharedValue<CanvasPaintValue>
}>

function CanvasSelectionToolbarContent({
  content,
  documentController,
  interaction,
}: {
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
}) {
  const selectedNodes = content.nodes.filter((node) => interaction.selection.nodeIds.has(node.id))
  const selectedEdges = content.edges.filter((edge) => interaction.selection.edgeIds.has(edge.id))
  const properties = resolveSelectionToolbarProperties(selectedNodes, selectedEdges)
  const applyProperty = (command: CanvasPropertyCommand) => {
    const change = createCanvasPropertyChange(content, interaction.selection, command)
    if (change) documentController.apply(change)
  }

  return (
    <div
      className="absolute top-4 left-4 z-10 flex cursor-default select-none flex-col gap-1 rounded-lg border bg-background/80 p-2 shadow-sm backdrop-blur-sm"
      role="toolbar"
      aria-label="Canvas conditional toolbar"
    >
      <div className="flex flex-col gap-1">
        {properties.text.state !== 'unavailable' ? (
          <PaintControl
            label="Text"
            options={BASE_TEXT_COLORS}
            showOpacity={false}
            value={properties.text}
            onChange={(value) => applyProperty({ property: 'textColor', value: value.color })}
          />
        ) : null}
        {properties.fill.state !== 'unavailable' ? (
          <PaintControl
            clear
            label="Fill"
            options={BASE_BG_COLORS}
            value={properties.fill}
            onChange={(value) => applyProperty({ property: 'fill', value })}
          />
        ) : null}
        {properties.border.state !== 'unavailable' ? (
          <PaintControl
            label="Stroke"
            options={BASE_STROKE_COLORS}
            value={properties.border}
            onChange={(value) => applyProperty({ property: 'border', value })}
          />
        ) : null}
        {properties.line.state !== 'unavailable' ? (
          <PaintControl
            label="Stroke"
            options={BASE_STROKE_COLORS}
            value={properties.line}
            onChange={(value) => applyProperty({ property: 'linePaint', value })}
          />
        ) : null}
        {properties.borderWidth.state !== 'unavailable' ? (
          <StrokeSizeControl
            value={properties.borderWidth}
            minimum={0}
            onChange={(value) => applyProperty({ property: 'borderWidth', value })}
          />
        ) : null}
        {properties.lineWidth.state !== 'unavailable' ? (
          <StrokeSizeControl
            value={properties.lineWidth}
            minimum={1}
            onChange={(value) => applyProperty({ property: 'lineWidth', value })}
          />
        ) : null}
      </div>
      {properties.edgeType.state !== 'unavailable' ? (
        <>
          <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
          <EdgeTypeControl
            value={properties.edgeType}
            onChange={(value) => applyProperty({ property: 'edgeType', value })}
          />
        </>
      ) : null}
      <div className="my-1 h-px w-full bg-border" aria-hidden="true" />
      <ReorderControls
        content={content}
        documentController={documentController}
        interaction={interaction}
      />
    </div>
  )
}

function resolveSelectionToolbarProperties(
  selectedNodes: ReadonlyArray<CanvasDocumentNode>,
  selectedEdges: ReadonlyArray<CanvasDocumentEdge>,
): CanvasSelectionToolbarProperties {
  const surfaceNodes = selectedNodes.filter(
    (node): node is Exclude<CanvasDocumentNode, { type: 'stroke' }> => node.type !== 'stroke',
  )
  const strokeNodes = selectedNodes.filter(
    (node): node is Extract<CanvasDocumentNode, { type: 'stroke' }> => node.type === 'stroke',
  )
  const onlySurfaceNodes =
    surfaceNodes.length > 0 && strokeNodes.length === 0 && selectedEdges.length === 0
  const onlyLineElements =
    surfaceNodes.length === 0 && strokeNodes.length + selectedEdges.length > 0
  const onlyTextNodes = onlySurfaceNodes && surfaceNodes.every((node) => node.type === 'text')
  const onlyEdges = selectedEdges.length > 0 && selectedNodes.length === 0
  const unavailable = { state: 'unavailable' as const }

  return {
    text: onlyTextNodes
      ? resolvePaint(
          surfaceNodes.map((node) => ({
            color: node.data.textColor ?? 'var(--foreground)',
            opacity: 100,
          })),
        )
      : unavailable,
    fill: onlyTextNodes
      ? resolvePaint(
          surfaceNodes.map((node) => ({
            color: node.data.backgroundColor ?? 'var(--background)',
            opacity: node.data.backgroundOpacity ?? 100,
          })),
        )
      : unavailable,
    border: onlySurfaceNodes
      ? resolvePaint(
          surfaceNodes.map((node) => ({
            color: node.data.borderStroke ?? 'var(--border)',
            opacity: node.data.borderOpacity ?? 100,
          })),
        )
      : unavailable,
    borderWidth: onlySurfaceNodes
      ? resolveCanvasSharedValue(surfaceNodes.map((node) => node.data.borderWidth ?? 1))
      : unavailable,
    line: onlyLineElements
      ? resolvePaint([
          ...strokeNodes.map((node) => ({
            color: node.data.color,
            opacity: node.data.opacity ?? 100,
          })),
          ...selectedEdges.map((edge) => {
            const style = resolveCanvasEdgeStyle(edge.style)
            return { color: style.stroke, opacity: style.opacity * 100 }
          }),
        ])
      : unavailable,
    lineWidth: onlyLineElements
      ? resolveCanvasSharedValue([
          ...strokeNodes.map((node) => node.data.size),
          ...selectedEdges.map((edge) => resolveCanvasEdgeStyle(edge.style).strokeWidth),
        ])
      : unavailable,
    edgeType: onlyEdges
      ? resolveCanvasSharedValue(selectedEdges.map((edge) => edge.type))
      : unavailable,
  }
}

function PaintControl({
  clear = false,
  label,
  onChange,
  options,
  showOpacity = true,
  value,
}: {
  clear?: boolean
  label: string
  onChange: (value: CanvasPaintValue) => void
  options: ReadonlyArray<Readonly<{ color: string; label: string }>>
  showOpacity?: boolean
  value: CanvasSharedValue<CanvasPaintValue>
}) {
  if (value.state === 'unavailable') return null
  const current =
    value.state === 'shared' ? value.value : { color: options[0]!.color, opacity: 100 }
  const presets = clear
    ? [options[0]!, { color: options[0]!.color, label: 'Clear', opacity: 0 }, ...options.slice(1)]
    : options
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={label}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        {presets.map((preset) => {
          const opacity = 'opacity' in preset ? preset.opacity : 100
          return (
            <PaintSwatch
              key={`${preset.label}-${preset.color}-${opacity}`}
              active={
                value.state === 'shared' &&
                value.value.color === preset.color &&
                value.value.opacity === opacity
              }
              color={preset.color}
              label={preset.label}
              opacity={opacity}
              onSelect={() => onChange({ color: preset.color, opacity })}
            />
          )
        })}
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <div onPointerDown={preventToolbarFocus}>
          <ColorPickerPopover
            mixed={value.state === 'mixed'}
            showOpacity={showOpacity}
            value={current}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  )
}

function PaintSwatch({
  active,
  color,
  label,
  opacity,
  onSelect,
}: {
  active: boolean
  color: string
  label: string
  opacity: number
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="h-6 w-6 cursor-pointer rounded-sm border border-border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      style={{
        outline: active ? '2px solid var(--primary)' : 'none',
        outlineOffset: '1px',
      }}
      aria-label={`Select ${label} color`}
      aria-pressed={active}
      title={label}
      onPointerDown={preventToolbarFocus}
      onClick={onSelect}
    >
      <CheckerboardSwatch className="h-full w-full rounded-sm">
        <span
          className="block h-full w-full rounded-sm"
          style={{ backgroundColor: color, opacity: opacity / 100 }}
        />
      </CheckerboardSwatch>
    </button>
  )
}

function StrokeSizeControl({
  minimum,
  onChange,
  value,
}: {
  minimum: number
  onChange: (value: number) => void
  value: CanvasSharedValue<number>
}) {
  if (value.state === 'unavailable') return null
  const current = value.state === 'shared' ? value.value : minimum
  return (
    <div className="flex flex-col gap-1" role="group" aria-label="Stroke size">
      <p className="text-[11px] font-medium text-muted-foreground">Stroke size</p>
      <div className="flex min-w-[19.8125rem] items-center gap-1">
        <input
          aria-label="Stroke size"
          className="h-6 min-w-0 grow cursor-pointer accent-primary"
          max={50}
          min={minimum}
          step={1}
          type="range"
          value={Math.min(current, 50)}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <div className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
          <input
            key={`${value.state}-${current}`}
            aria-label="Stroke size input"
            className="block h-full w-full appearance-none bg-transparent p-0 text-center text-xs leading-6 tabular-nums outline-none"
            defaultValue={value.state === 'shared' ? current : ''}
            placeholder={value.state === 'mixed' ? '--' : undefined}
            inputMode="decimal"
            maxLength={5}
            type="text"
            onBlur={commitStrokeSize(minimum, onChange)}
            onKeyDown={(event) => handleStrokeSizeKey(event, minimum, onChange)}
          />
        </div>
      </div>
    </div>
  )
}

function EdgeTypeControl({
  onChange,
  value,
}: {
  onChange: (value: CanvasEdgeType) => void
  value: CanvasSharedValue<CanvasEdgeType>
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">Edge type</p>
      <div className="flex items-center gap-1">
        {EDGE_TYPE_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            className={`flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium hover:bg-accent ${
              value.state === 'shared' && value.value === option.type ? 'bg-accent' : ''
            }`}
            aria-label={`Change edge type to ${option.label}`}
            aria-pressed={value.state === 'shared' && value.value === option.type}
            title={option.label}
            onClick={() => onChange(option.type)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const REORDER_ICONS = {
  sendToBack: ArrowDownToLine,
  sendBackward: ArrowDown,
  bringForward: ArrowUp,
  bringToFront: ArrowUpToLine,
} satisfies Record<
  (typeof CANVAS_REORDER_ACTIONS)[number]['id'],
  ComponentType<{ className?: string }>
>

function ReorderControls({
  content,
  documentController,
  interaction,
}: {
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">Reorder</p>
      <div className="flex items-center gap-1">
        {CANVAS_REORDER_ACTIONS.map((action) => {
          const Icon = REORDER_ICONS[action.id]
          const change = createCanvasReorderChange(content, interaction.selection, action.id)
          return (
            <button
              key={action.id}
              type="button"
              className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={action.label}
              disabled={!change}
              title={action.label}
              onClick={() => {
                if (change) documentController.apply(change)
              }}
            >
              <Icon className="size-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function resolvePaint(
  values: ReadonlyArray<CanvasPaintValue>,
): CanvasSharedValue<CanvasPaintValue> {
  const first = values[0]
  if (!first) return unavailablePaint()
  return values.every((value) => value.color === first.color && value.opacity === first.opacity)
    ? { state: 'shared', value: first }
    : { state: 'mixed' }
}

function unavailablePaint(): CanvasSharedValue<CanvasPaintValue> {
  return { state: 'unavailable' }
}

function commitStrokeSize(minimum: number, onChange: (value: number) => void) {
  return (event: { currentTarget: HTMLInputElement }) => {
    const next = Number(event.currentTarget.value)
    if (Number.isFinite(next) && next >= minimum && next <= 99) {
      onChange(next)
      return
    }
    event.currentTarget.value = event.currentTarget.defaultValue
  }
}

function handleStrokeSizeKey(
  event: KeyboardEvent<HTMLInputElement>,
  minimum: number,
  onChange: (value: number) => void,
) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitStrokeSize(minimum, onChange)(event)
    event.currentTarget.blur()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    event.currentTarget.value = event.currentTarget.defaultValue
    event.currentTarget.blur()
  }
}

function preventToolbarFocus(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}
