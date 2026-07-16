import {
  Eraser,
  GitBranch,
  Hand,
  LassoSelect,
  Maximize,
  MousePointer2,
  Pencil,
  Redo2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent } from './document-contract'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
  CanvasTool,
} from './interaction-controller'
import { fitCanvasContent } from './canvas-layout'

const TOOL_BUTTONS: ReadonlyArray<Readonly<{ tool: CanvasTool; label: string; icon: LucideIcon }>> =
  [
    { tool: 'select', label: 'Pointer', icon: MousePointer2 },
    { tool: 'lasso', label: 'Lasso select', icon: LassoSelect },
    { tool: 'draw', label: 'Draw', icon: Pencil },
    { tool: 'eraser', label: 'Eraser', icon: Eraser },
    { tool: 'edge', label: 'Edges', icon: GitBranch },
    { tool: 'text', label: 'Text', icon: Type },
    { tool: 'hand', label: 'Hand', icon: Hand },
  ]
const TOOLBAR_BUTTON_CLASS =
  'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40'

type CanvasHistoryState = 'both' | 'empty' | 'redo' | 'undo'

export function CanvasToolbar({
  canEdit,
  content,
  documentController,
  history,
  interaction,
  interactionController,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  history: CanvasHistoryState
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  surface: RefObject<HTMLElement | null>
}) {
  return (
    <>
      {canEdit && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur">
          {TOOL_BUTTONS.map(({ tool, label, icon: Icon }) => (
            <button
              key={tool}
              type="button"
              aria-label={label}
              aria-pressed={interaction.tool === tool}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              onClick={() => interactionController.setTool(tool)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur">
        {canEdit && (
          <>
            <button
              type="button"
              aria-label="Undo"
              disabled={history !== 'undo' && history !== 'both'}
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => documentController.undo()}
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled={history !== 'redo' && history !== 'both'}
              className={TOOLBAR_BUTTON_CLASS}
              onClick={() => documentController.redo()}
            >
              <Redo2 className="size-4" />
            </button>
            <span className="mx-0.5 h-5 w-px bg-border" />
          </>
        )}
        <button
          type="button"
          aria-label="Zoom out"
          className={TOOLBAR_BUTTON_CLASS}
          onClick={() =>
            interactionController.zoomTo(interaction.viewport.zoom / 1.2, undefined, true)
          }
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="min-w-12 text-center text-xs tabular-nums">
          {Math.round(interaction.viewport.zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          className={TOOLBAR_BUTTON_CLASS}
          onClick={() =>
            interactionController.zoomTo(interaction.viewport.zoom * 1.2, undefined, true)
          }
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Fit view"
          className={TOOLBAR_BUTTON_CLASS}
          onClick={() => {
            const bounds = surface.current?.getBoundingClientRect()
            if (!bounds) return
            const viewport = fitCanvasContent(content.nodes, bounds.width, bounds.height)
            if (viewport) interactionController.setViewport(viewport, true)
          }}
        >
          <Maximize className="size-4" />
        </button>
      </div>
    </>
  )
}
