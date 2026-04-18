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
import { useCanvasHistoryStore } from '../stores/canvas-history-store'
import { Button } from '~/features/shadcn/components/button'

interface CanvasToolbarProps {
  canEdit: boolean
}

export function CanvasToolbar({ canEdit }: CanvasToolbarProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const setActiveTool = useCanvasToolStore((s) => s.setActiveTool)
  const canUndo = useCanvasHistoryStore((s) => s.canUndo)
  const canRedo = useCanvasHistoryStore((s) => s.canRedo)
  const undo = useCanvasHistoryStore((s) => s.undo)
  const redo = useCanvasHistoryStore((s) => s.redo)

  return (
    <>
      {canEdit && (
        <div
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
          role="toolbar"
          aria-label="Canvas main toolbar"
        >
          <ToolButton
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            label="Pointer"
            icon={<MousePointer2 className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'hand'}
            onClick={() => setActiveTool('hand')}
            label="Panning"
            icon={<Hand className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'lasso'}
            onClick={() => setActiveTool('lasso')}
            label="Lasso select"
            icon={<Lasso className="h-4 w-4" />}
          />
          <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
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
            active={activeTool === 'text'}
            onClick={() => setActiveTool('text')}
            label="Text"
            icon={<Type className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'sticky'}
            onClick={() => setActiveTool('sticky')}
            label="Post-it"
            icon={<StickyNote className="h-4 w-4" />}
          />
          <ToolButton
            active={activeTool === 'rectangle'}
            onClick={() => setActiveTool('rectangle')}
            label="Rectangle"
            icon={<RectangleHorizontal className="h-4 w-4" />}
          />
        </div>
      )}

      <div
        className="absolute top-4 right-4 z-10 flex flex-col gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
        role="toolbar"
        aria-label="Canvas viewport controls"
      >
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
          aria-label="Fit zoom"
          title="Fit zoom"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {canEdit && (
          <>
            <div className="my-1 h-px w-6 self-center bg-border" aria-hidden="true" />
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
          </>
        )}
      </div>
    </>
  )
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
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
