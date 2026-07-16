import type { ReactNode } from 'react'
import type { CanvasDocumentNode } from './document-contract'
import { canvasNodeSize } from './canvas-layout'
import { canvasStrokeLocalPoints } from './canvas-stroke-geometry'
import { CanvasTextEditor } from './canvas-text-editor'
import { CanvasTextPreview } from './canvas-text-preview'
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
    color: node.data.textColor ?? undefined,
    backgroundColor: node.data.backgroundColor ?? undefined,
    opacity: node.data.backgroundOpacity ?? undefined,
    borderColor: node.data.borderStroke ?? undefined,
    borderWidth: node.data.borderWidth ?? 1,
  }
  if (node.type === 'embed') {
    return (
      <div
        className="flex size-full items-center justify-center overflow-hidden rounded-md border bg-card text-center text-sm shadow-sm"
        style={sharedStyle}
      >
        {embed ?? canvasEmbedLabel(node)}
      </div>
    )
  }
  if (editing) {
    return (
      <CanvasTextEditor
        content={node.data.content}
        onChange={onSaveContent}
        onFinish={onFinishEditing}
      />
    )
  }
  return <CanvasTextPreview content={node.data.content} selected={selected} style={sharedStyle} />
}
