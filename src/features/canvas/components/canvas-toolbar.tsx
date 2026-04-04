import { useReactFlow } from '@xyflow/react'
import {
  Eraser,
  Hand,
  Lasso,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  RectangleHorizontal,
  Redo2,
  StickyNote,
  Type,
  Undo2,
} from 'lucide-react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { STICKY_DEFAULT_COLOR } from './nodes/sticky-node-constants'
import type { Node } from '@xyflow/react'
import type * as Y from 'yjs'
import { Button } from '~/features/shadcn/components/button'

const STROKE_SIZES = [2, 4, 8, 16]

interface CanvasToolbarProps {
  nodesMap: Y.Map<Node>
  canEdit: boolean
}

export function CanvasToolbar({ nodesMap, canEdit }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow()

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const strokeSize = useCanvasToolStore((s) => s.strokeSize)
  const setActiveTool = useCanvasToolStore((s) => s.setActiveTool)
  const setStrokeSize = useCanvasToolStore((s) => s.setStrokeSize)
  const canUndo = useCanvasToolStore((s) => s.canUndo)
  const canRedo = useCanvasToolStore((s) => s.canRedo)
  const undo = useCanvasToolStore((s) => s.undo)
  const redo = useCanvasToolStore((s) => s.redo)

  const addNode = (type: 'text' | 'sticky') => {
    const id = crypto.randomUUID()
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
    })
    const { strokeOpacity } = useCanvasToolStore.getState()

    const node: Node = {
      id,
      type,
      position,
      data: {
        label: type === 'text' ? 'New text' : '',
        ...(type === 'sticky'
          ? {
              color: STICKY_DEFAULT_COLOR,
              opacity: strokeOpacity,
            }
          : {}),
      },
    }

    nodesMap.set(id, node)
  }

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-lg p-1 shadow-sm">
      {canEdit && (
        <>
          <ToolButton
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            label="Select"
            icon={<MousePointer2 className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'hand'}
            onClick={() => setActiveTool('hand')}
            label="Hand"
            icon={<Hand className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'draw'}
            onClick={() => setActiveTool('draw')}
            label="Draw"
            icon={<Pencil className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'erase'}
            onClick={() => setActiveTool('erase')}
            label="Eraser"
            icon={<Eraser className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'lasso'}
            onClick={() => setActiveTool('lasso')}
            label="Lasso select"
            icon={<Lasso className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'rectangle'}
            onClick={() => setActiveTool('rectangle')}
            label="Rectangle"
            icon={<RectangleHorizontal className="h-4 w-4" />}
          />

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => addNode('text')}
            aria-label="Add text node"
            title="Add text node"
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => addNode('sticky')}
            aria-label="Add sticky note"
            title="Add sticky note"
          >
            <StickyNote className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          {activeTool === 'draw' && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <div className="flex items-center gap-0.5">
                {STROKE_SIZES.map((size) => (
                  <button
                    key={size}
                    className="h-8 w-8 flex items-center justify-center rounded-sm transition-colors"
                    style={{
                      backgroundColor:
                        strokeSize === size ? 'var(--accent)' : 'transparent',
                    }}
                    onClick={() => setStrokeSize(size)}
                    aria-label={`Stroke size ${size}`}
                    title={`Size ${size}`}
                  >
                    <div
                      className="rounded-full bg-foreground"
                      style={{ width: size, height: size }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="w-px h-6 bg-border mx-1" />
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomIn()}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => zoomOut()}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => fitView()}
        aria-label="Fit view"
        title="Fit view"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${active ? 'bg-accent' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  )
}
