import type { ReactNode } from 'react'
import type { CanvasDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeLocalPoints } from './canvas-stroke-geometry'
import { CanvasTextEditor } from './canvas-text-editor'
import type { CanvasTextDocument } from './text/model'
import { canvasEmbedLabel } from './canvas-embed-label'

export function CanvasNodeVisual({
  editing,
  embed,
  node,
  onFinishEditing,
  onSaveContent,
  selected,
  zoom,
}: {
  editing: boolean
  embed?: ReactNode
  node: CanvasDocumentNode
  onFinishEditing: () => void
  onSaveContent: (content: CanvasTextDocument) => void
  selected: boolean
  zoom: number
}) {
  if (node.type === 'stroke') {
    const size = canvasNodeSize(node)
    const points = canvasStrokeLocalPoints(node)
      .map(({ x, y }) => `${x},${y}`)
      .join(' ')
    return (
      <svg className="size-full overflow-visible" viewBox={`0 0 ${size.width} ${size.height}`}>
        <polyline
          data-testid="canvas-stroke-hit-target"
          fill="none"
          points={points}
          pointerEvents="stroke"
          stroke="transparent"
          strokeWidth={Math.max(node.data.size, 24 / zoom)}
        />
        <polyline
          fill="none"
          points={points}
          pointerEvents="none"
          stroke={node.data.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={(node.data.opacity ?? 100) / 100}
          strokeWidth={node.data.size}
        />
      </svg>
    )
  }
  const sharedStyle = {
    color: node.data.textColor ?? 'var(--foreground)',
    backgroundColor: resolveCanvasNodePaint(
      node.data.backgroundColor ?? 'var(--background)',
      node.data.backgroundOpacity ?? 100,
    ),
    borderColor: resolveCanvasNodePaint(
      node.data.borderStroke ?? 'var(--border)',
      node.data.borderOpacity ?? 100,
    ),
    borderWidth: node.data.borderWidth ?? 1,
  }
  if (node.type === 'embed') {
    return (
      <div
        className="relative size-full overflow-hidden rounded-md border bg-card text-sm shadow-sm"
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
      content={node.data.content}
      editing={editing}
      onChange={onSaveContent}
      onFinish={onFinishEditing}
      selected={selected}
      style={sharedStyle}
    />
  )
}

function resolveCanvasNodePaint(color: string | null | undefined, opacity: number) {
  if (!color || opacity <= 0) return 'transparent'
  if (opacity >= 100) return color
  return `color-mix(in srgb, ${color} ${opacity}%, transparent)`
}
