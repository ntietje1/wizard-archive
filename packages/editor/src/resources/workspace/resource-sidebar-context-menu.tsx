import { useEffect, useRef } from 'react'
import { ClipboardPaste, Redo2, Undo2 } from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import { NewResourceSubmenu } from './resource-context-menu'
import type { WorkspaceActions } from './resource-operations'
import { useResourceUndoSnapshot } from './resource-undo'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'

export function ResourceSidebarContextMenu({
  actions,
  clipboard,
  onClipboardChange,
  onClose,
  runtime,
  x,
  y,
}: {
  actions: WorkspaceActions
  clipboard: WorkspaceClipboard
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  onClose: () => void
  runtime: EditorRuntime
  x: number
  y: number
}) {
  const menu = useRef<HTMLDivElement>(null)
  const snapshot = useResourceUndoSnapshot(runtime.resources.undo)
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, null)
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])
  const running = snapshot.status === 'running'
  const undo = snapshot.status === 'ready' ? snapshot.undo : null
  const redo = snapshot.status === 'ready' ? snapshot.redo : null
  const canPaste = clipboard.status === 'ready'
  const run = (direction: 'redo' | 'undo') => {
    onClose()
    void actions.undo(direction)
  }
  return (
    <div
      ref={menu}
      role="menu"
      aria-label="Sidebar actions"
      className="fixed z-[70] w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={boundedMenuPosition(x, y)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Tab') onClose()
      }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={running || undo === null}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:opacity-50"
        onClick={() => run('undo')}
      >
        <Undo2 className="size-4" />
        {undo ? `Undo ${undo.label}` : 'Undo'}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={running || redo === null}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:opacity-50"
        onClick={() => run('redo')}
      >
        <Redo2 className="size-4" />
        {redo ? `Redo ${redo.label}` : 'Redo'}
      </button>
      <hr className="my-1 border-0 border-t border-border" />
      <NewResourceSubmenu
        actions={actions}
        creation={creation}
        destinationParentId={null}
        onClose={onClose}
        side={x > globalThis.innerWidth - 404 ? 'left' : 'right'}
      />
      <WorkspaceCreationStatus creation={creation} onCompleted={onClose} />
      <button
        type="button"
        role="menuitem"
        aria-label="Paste"
        disabled={!canPaste}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50"
        onClick={() => {
          onClose()
          void actions.paste(clipboard, null).then(onClipboardChange)
        }}
      >
        <ClipboardPaste className="size-4" />
        <span className="min-w-0 flex-1">Paste</span>
      </button>
    </div>
  )
}

function boundedMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { left: x, top: y }
  return {
    left: Math.max(8, Math.min(x, window.innerWidth - 216)),
    top: Math.max(8, Math.min(y, window.innerHeight - 176)),
  }
}
