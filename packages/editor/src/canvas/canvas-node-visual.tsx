import type { CSSProperties, ReactNode } from 'react'
import type { CanvasDocumentNode } from './document-contract'
import { canvasStrokePath } from './canvas-stroke-geometry'
import { CanvasTextEditor } from './canvas-text-editor'
import type { CanvasTextDocument } from './text/model'
import { canvasEmbedLabel } from './canvas-embed-label'

type CanvasNodeVisualProps = {
  embed?: ReactNode
  exclusivelySelected: boolean
  node: CanvasDocumentNode
  onFinishEditing: () => void
  onSaveContent: (content: CanvasTextDocument) => void
  selected: boolean
  zoom: number
} & ({ editing: false } | { editing: true; onDefaultTextColorChange: (color: string) => void })

export function CanvasNodeVisual(props: CanvasNodeVisualProps) {
  const { embed, exclusivelySelected, node, onFinishEditing, onSaveContent, selected, zoom } = props
  if (node.type === 'stroke') {
    const points = node.data.points.map(([x, y]) => `${x},${y}`).join(' ')
    const path = canvasStrokePath(node.data.points, node.data.size)
    const bounds = node.data.bounds
    return (
      <svg
        className="size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      >
        <polyline
          data-testid="canvas-stroke-hit-target"
          fill="none"
          points={points}
          pointerEvents="stroke"
          stroke="transparent"
          strokeWidth={Math.max(node.data.size, 24 / zoom)}
        />
        <path
          d={path}
          fill={node.data.color}
          pointerEvents="none"
          opacity={(node.data.opacity ?? 100) / 100}
        />
      </svg>
    )
  }
  const textColor = node.data.textColor ?? 'var(--foreground)'
  const sharedStyle = {
    '--bn-colors-editor-text': textColor,
    color: textColor,
    backgroundColor: resolveCanvasNodePaint(
      node.data.backgroundColor ?? 'var(--background)',
      node.data.backgroundOpacity ?? 100,
    ),
    borderColor: resolveCanvasNodePaint(
      node.data.borderStroke ?? 'var(--border)',
      node.data.borderOpacity ?? 100,
    ),
    borderWidth: node.data.borderWidth ?? 1,
  } as CSSProperties
  if (node.type === 'embed') {
    return (
      <div
        className={`relative size-full overflow-hidden rounded-md border bg-card text-sm shadow-sm ${exclusivelySelected ? 'nowheel' : ''}`}
        style={sharedStyle}
      >
        {embed ?? (
          <span className="flex size-full items-center justify-center p-3 text-center">
            {canvasEmbedLabel(node)}
          </span>
        )}
      </div>
    )
  }
  return (
    <CanvasTextEditor
      {...(props.editing
        ? {
            editing: true,
            onDefaultTextColorChange: props.onDefaultTextColorChange,
          }
        : { editing: false })}
      content={node.data.content}
      exclusivelySelected={exclusivelySelected}
      onChange={onSaveContent}
      onFinish={onFinishEditing}
      selected={selected}
      style={sharedStyle}
      textColor={textColor}
    />
  )
}

function resolveCanvasNodePaint(color: string | null | undefined, opacity: number) {
  if (!color || opacity <= 0) return 'transparent'
  if (opacity >= 100) return color
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}
