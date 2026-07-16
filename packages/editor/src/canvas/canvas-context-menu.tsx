import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { CANVAS_ARRANGE_ACTIONS, createCanvasArrangeChange } from './canvas-arrange'
import type { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent } from './document-contract'
import type { CanvasSelection } from './interaction-controller'
import { CANVAS_REORDER_ACTIONS, createCanvasReorderChange } from './canvas-z-order'
import { CanvasMenuItem } from './canvas-menu-item'
import { CanvasSubmenu } from './canvas-submenu'

export type CanvasContextMenuRequest = Readonly<{
  kind: 'pane' | 'selection'
  x: number
  y: number
}>

type CanvasContextMenuActions = Readonly<{
  copy(): boolean
  cut(): boolean
  delete(): void
  duplicate(): boolean
  paste(): boolean
  selectAll(): void
}>

export function CanvasContextMenu({
  actions,
  canEdit,
  canPaste,
  content,
  documentController,
  onClose,
  request,
  selection,
}: {
  actions: CanvasContextMenuActions
  canEdit: boolean
  canPaste: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  onClose: () => void
  request: CanvasContextMenuRequest
  selection: CanvasSelection
}) {
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', closeOutside)
    return () => window.removeEventListener('pointerdown', closeOutside)
  }, [onClose])

  const run = (action: () => unknown) => {
    action()
    onClose()
  }
  const selectedNodes = selection.nodeIds.size
  const selectedElements = selectedNodes + selection.edgeIds.size
  return (
    <div
      ref={menu}
      aria-label="Canvas actions"
      className="fixed z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      role="menu"
      style={{ left: request.x, top: request.y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => handleCanvasMenuKeyboard(event, onClose)}
    >
      {request.kind === 'pane' ? (
        <>
          <CanvasMenuItem label="Select All" onSelect={() => run(actions.selectAll)} />
          {canEdit && canPaste && (
            <CanvasMenuItem label="Paste" onSelect={() => run(actions.paste)} />
          )}
        </>
      ) : (
        <>
          {selectedNodes > 0 && <CanvasMenuItem label="Copy" onSelect={() => run(actions.copy)} />}
          {canEdit && selectedNodes > 0 && (
            <>
              <CanvasMenuItem label="Cut" onSelect={() => run(actions.cut)} />
              <CanvasMenuItem label="Duplicate" onSelect={() => run(actions.duplicate)} />
            </>
          )}
          {canEdit && selectedElements > 0 && (
            <CanvasMenuItem label="Delete" destructive onSelect={() => run(actions.delete)} />
          )}
          {canEdit && selectedNodes >= 2 && (
            <CanvasSubmenu label="Arrange">
              {CANVAS_ARRANGE_ACTIONS.map((action) => (
                <CanvasMenuItem
                  key={action.id}
                  disabled={selectedNodes < action.minimumNodes}
                  label={action.label}
                  onSelect={() =>
                    run(() => {
                      const change = createCanvasArrangeChange(content, selection, action.id)
                      if (change) documentController.apply(change)
                    })
                  }
                />
              ))}
            </CanvasSubmenu>
          )}
          {canEdit && selectedElements > 0 && (
            <CanvasSubmenu label="Reorder">
              {CANVAS_REORDER_ACTIONS.map((action) => (
                <CanvasMenuItem
                  key={action.id}
                  label={action.label}
                  onSelect={() =>
                    run(() => {
                      const change = createCanvasReorderChange(content, selection, action.id)
                      if (change) documentController.apply(change)
                    })
                  }
                />
              ))}
            </CanvasSubmenu>
          )}
        </>
      )}
    </div>
  )
}

function handleCanvasMenuKeyboard(event: KeyboardEvent<HTMLElement>, onClose: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    onClose()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  ].filter((item) => !item.disabled && item.getClientRects().length > 0)
  if (items.length === 0) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  items[(current + step + items.length) % items.length]?.focus()
}
