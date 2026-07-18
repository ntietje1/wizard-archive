import {
  Eraser,
  Hand,
  Lasso,
  Maximize2,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Type,
  Undo2,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent } from './document-contract'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type { CanvasTool } from './interaction-types'
import { fitCanvasContent } from './canvas-layout'

type CanvasToolButton = Readonly<{
  group: 'selection' | 'creation'
  icon: LucideIcon
  label: string
  shortcut: number
  tool: CanvasTool
}>

const TOOL_BUTTONS: ReadonlyArray<CanvasToolButton> = [
  { tool: 'select', label: 'Pointer', group: 'selection', icon: MousePointer2, shortcut: 1 },
  { tool: 'hand', label: 'Panning', group: 'selection', icon: Hand, shortcut: 2 },
  { tool: 'lasso', label: 'Lasso select', group: 'selection', icon: Lasso, shortcut: 3 },
  { tool: 'draw', label: 'Draw', group: 'creation', icon: Pencil, shortcut: 4 },
  { tool: 'eraser', label: 'Eraser', group: 'creation', icon: Eraser, shortcut: 5 },
  { tool: 'text', label: 'Text', group: 'creation', icon: Type, shortcut: 6 },
  { tool: 'edge', label: 'Edges', group: 'creation', icon: Workflow, shortcut: 7 },
]

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
        <div
          className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 cursor-default items-center gap-1 rounded-lg border bg-background/80 p-1 shadow-sm backdrop-blur-sm"
          role="toolbar"
          aria-label="Canvas main toolbar"
        >
          {TOOL_BUTTONS.map((tool, index) => (
            <ToolGroupButton
              key={tool.tool}
              active={interaction.tool === tool.tool}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              showDivider={index > 0 && TOOL_BUTTONS[index - 1]?.group !== tool.group}
              onClick={() => interactionController.setTool(tool.tool)}
            />
          ))}
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
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() =>
            zoomAroundSurfaceCenter(
              interactionController,
              surface.current,
              interaction.viewport.zoom * 1.2,
            )
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() =>
            zoomAroundSurfaceCenter(
              interactionController,
              surface.current,
              interaction.viewport.zoom / 1.2,
            )
          }
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Fit zoom"
          title="Fit zoom"
          onClick={() => {
            const bounds = surface.current?.getBoundingClientRect()
            if (!bounds) return
            const viewport = fitCanvasContent(content.nodes, bounds.width, bounds.height)
            if (viewport) interactionController.setViewport(viewport, true)
          }}
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
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              disabled={history !== 'undo' && history !== 'both'}
              onClick={() => documentController.undo()}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              disabled={history !== 'redo' && history !== 'both'}
              onClick={() => documentController.redo()}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </>
  )
}

function zoomAroundSurfaceCenter(
  interactionController: CanvasInteractionController,
  surface: HTMLElement | null,
  zoom: number,
) {
  if (!surface) return
  const bounds = surface.getBoundingClientRect()
  interactionController.zoomTo(zoom, { x: bounds.width / 2, y: bounds.height / 2 }, true)
}

function ToolGroupButton({
  active,
  icon: Icon,
  label,
  onClick,
  shortcut,
  showDivider,
}: {
  active: boolean
  icon: LucideIcon
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
        aria-label={label}
        aria-pressed={active}
        title={`${label} (${shortcut})`}
        onClick={onClick}
      >
        <Icon className="h-4 w-4" />
        <span className="pointer-events-none absolute right-[1px] bottom-0.5 text-[8px] leading-none text-muted-foreground">
          {shortcut}
        </span>
      </Button>
    </>
  )
}
