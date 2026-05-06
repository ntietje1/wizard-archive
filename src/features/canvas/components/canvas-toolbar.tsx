import { Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import { canvasToolbarTools } from '../tools/canvas-tool-modules'
import { Button } from '~/features/shadcn/components/button'
import {
  useCanvasDocumentRuntime,
  useCanvasViewportRuntime,
} from '../runtime/providers/canvas-runtime'

interface CanvasToolbarProps {
  canEdit: boolean
}

export function CanvasToolbar({ canEdit }: CanvasToolbarProps) {
  const { history } = useCanvasDocumentRuntime()
  const { viewportController } = useCanvasViewportRuntime()

  const activeTool = useCanvasToolStore((s) => s.activeTool)
  const setActiveTool = useCanvasToolStore((s) => s.setActiveTool)

  return (
    <>
      {canEdit && (
        <div
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 cursor-default items-center gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
          role="toolbar"
          aria-label="Canvas main toolbar"
        >
          {canvasToolbarTools.map((tool, index) => {
            const previousTool = canvasToolbarTools[index - 1]

            return (
              <ToolGroupButton
                key={tool.id}
                active={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
                label={tool.label}
                icon={tool.icon}
                shortcut={tool.shortcut}
                showDivider={previousTool?.group !== undefined && previousTool.group !== tool.group}
              />
            )
          })}
        </div>
      )}

      <div
        className="absolute top-4 right-4 z-10 flex cursor-default flex-col gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
        role="toolbar"
        aria-label="Canvas viewport controls"
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={viewportController.zoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={viewportController.zoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={viewportController.fitView}
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
              onClick={history.undo}
              disabled={!history.canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={history.redo}
              disabled={!history.canRedo}
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

function ToolGroupButton({
  active,
  icon,
  label,
  onClick,
  shortcut,
  showDivider,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
  shortcut: number
  showDivider: boolean
}) {
  return (
    <>
      {showDivider ? <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" /> : null}
      <Button
        variant="ghost"
        size="icon"
        className={`relative h-8 w-8 ${active ? 'bg-accent' : ''}`}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        title={`${label} (${shortcut})`}
      >
        {icon}
        <span className="pointer-events-none absolute right-[1px] bottom-0.5 text-[8px] leading-none text-muted-foreground">
          {shortcut}
        </span>
      </Button>
    </>
  )
}
