import {
  BASE_BG_COLORS,
  BASE_STROKE_COLORS,
  BASE_TEXT_COLORS,
} from '@wizard-archive/ui/utils/color'
import type { KeyboardEvent } from 'react'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent, CanvasEdgeType } from './document-contract'
import type { CanvasInteractionSnapshot } from './interaction-controller'
import { createCanvasPropertyChange, resolveCanvasSharedValue } from './canvas-properties'
import type { CanvasSharedValue } from './canvas-properties'

export function CanvasSelectionProperties({
  canEdit,
  content,
  documentController,
  interaction,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
}) {
  if (!canEdit || interaction.tool !== 'select') return null
  const selectedNodes = content.nodes.filter((node) => interaction.selection.nodeIds.has(node.id))
  const selectedEdges = content.edges.filter((edge) => interaction.selection.edgeIds.has(edge.id))
  const surfaceNodes = selectedNodes.filter((node) => node.type !== 'stroke')
  const strokeNodes = selectedNodes.filter((node) => node.type === 'stroke')
  const fill = resolveCanvasSharedValue(
    surfaceNodes.map((node) => node.data.backgroundColor ?? 'var(--background)'),
  )
  const border = resolveCanvasSharedValue(
    surfaceNodes.map((node) => node.data.borderStroke ?? 'var(--border)'),
  )
  const borderWidth = resolveCanvasSharedValue(
    surfaceNodes.map((node) => node.data.borderWidth ?? 1),
  )
  const textColor = resolveCanvasSharedValue(
    surfaceNodes.map((node) => node.data.textColor ?? 'var(--foreground)'),
  )
  const lineColor = resolveCanvasSharedValue([
    ...strokeNodes.map((node) => node.data.color),
    ...selectedEdges.map((edge) => edge.style?.stroke ?? 'var(--foreground)'),
  ])
  const lineWidth = resolveCanvasSharedValue([
    ...strokeNodes.map((node) => node.data.size),
    ...selectedEdges.map((edge) => edge.style?.strokeWidth ?? 2),
  ])
  const lineOpacity = resolveCanvasSharedValue([
    ...strokeNodes.map((node) => node.data.opacity ?? 100),
    ...selectedEdges.map((edge) => (edge.style?.opacity ?? 0.75) * 100),
  ])
  const edgeType = resolveCanvasSharedValue(selectedEdges.map((edge) => edge.type))
  if (fill.state === 'unavailable' && lineColor.state === 'unavailable') return null
  const applyProperty = (command: Parameters<typeof createCanvasPropertyChange>[2]) => {
    const change = createCanvasPropertyChange(content, interaction.selection, command)
    if (change) documentController.apply(change)
  }
  return (
    <div
      aria-label="Canvas selection properties"
      className="absolute left-3 top-14 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur"
      role="toolbar"
    >
      {fill.state !== 'unavailable' && (
        <>
          <CanvasColorSelect
            label="Fill"
            options={BASE_BG_COLORS}
            value={fill}
            onChange={(value) => applyProperty({ property: 'fill', value })}
          />
          <CanvasColorSelect
            label="Border"
            options={BASE_STROKE_COLORS}
            value={border}
            onChange={(value) => applyProperty({ property: 'border', value })}
          />
          <CanvasNumberInput
            label="Border width"
            max={99}
            min={0}
            value={borderWidth}
            onCommit={(value) => applyProperty({ property: 'borderWidth', value })}
          />
          <CanvasColorSelect
            label="Text"
            options={BASE_TEXT_COLORS}
            value={textColor}
            onChange={(value) => applyProperty({ property: 'textColor', value })}
          />
        </>
      )}
      {lineColor.state !== 'unavailable' && (
        <>
          <CanvasColorSelect
            label="Line"
            options={BASE_STROKE_COLORS}
            value={lineColor}
            onChange={(value) => applyProperty({ property: 'lineColor', value })}
          />
          <CanvasNumberInput
            label="Line width"
            max={99}
            min={1}
            value={lineWidth}
            onCommit={(value) => applyProperty({ property: 'lineWidth', value })}
          />
          <CanvasNumberInput
            label="Line opacity"
            max={100}
            min={0}
            value={lineOpacity}
            onCommit={(value) => applyProperty({ property: 'lineOpacity', value })}
          />
          {edgeType.state !== 'unavailable' && (
            <CanvasEdgeTypeSelect
              value={edgeType}
              onChange={(value) => applyProperty({ property: 'edgeType', value })}
            />
          )}
        </>
      )}
    </div>
  )
}

function CanvasColorSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: ReadonlyArray<Readonly<{ color: string; label: string }>>
  value: CanvasSharedValue<string>
}) {
  if (value.state === 'unavailable') return null
  const current = value.state === 'shared' ? value.value : ''
  const custom = current !== '' && !options.some((option) => option.color === current)
  return (
    <select
      aria-label={`${label} color`}
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={current}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {value.state === 'mixed' && <option value="">{label}: Mixed</option>}
      {custom && <option value={current}>{label}: Custom</option>}
      {options.map((option) => (
        <option key={option.color} value={option.color}>
          {label}: {option.label}
        </option>
      ))}
    </select>
  )
}

function CanvasNumberInput({
  label,
  max,
  min,
  onCommit,
  value,
}: {
  label: string
  max: number
  min: number
  onCommit: (value: number) => void
  value: CanvasSharedValue<number>
}) {
  if (value.state === 'unavailable') return null
  const current = value.state === 'shared' ? value.value : undefined
  return (
    <input
      key={`${label}-${value.state}-${current ?? 'mixed'}`}
      aria-label={label}
      className="h-8 w-20 rounded-md border bg-background px-2 text-xs"
      defaultValue={current}
      max={max}
      min={min}
      placeholder={value.state === 'mixed' ? '--' : undefined}
      type="number"
      onBlur={(event) => {
        if (event.currentTarget.value.trim() === '') return
        onCommit(Number(event.currentTarget.value))
      }}
      onKeyDown={(event) => commitNumberInput(event)}
    />
  )
}

function CanvasEdgeTypeSelect({
  onChange,
  value,
}: {
  onChange: (value: CanvasEdgeType) => void
  value: CanvasSharedValue<CanvasEdgeType>
}) {
  if (value.state === 'unavailable') return null
  return (
    <select
      aria-label="Edge type"
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={value.state === 'shared' ? value.value : ''}
      onChange={(event) => {
        const type = event.currentTarget.value
        if (type === 'bezier' || type === 'straight' || type === 'step') onChange(type)
      }}
    >
      {value.state === 'mixed' && <option value="">Edge: Mixed</option>}
      <option value="bezier">Edge: Bezier</option>
      <option value="straight">Edge: Straight</option>
      <option value="step">Edge: Step</option>
    </select>
  )
}

function commitNumberInput(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur()
  if (event.key === 'Escape') {
    event.currentTarget.value = event.currentTarget.defaultValue
    event.currentTarget.blur()
  }
}
