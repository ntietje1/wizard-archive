import { ClipboardPaste, Redo2, Undo2 } from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import { NewResourceSubmenu } from './resource-context-menu'
import type { WorkspaceActions } from './resource-operations'
import { useResourceUndoSnapshot } from './resource-undo'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'
import { WorkspaceMenu, WorkspaceMenuItem, WorkspaceMenuSeparator } from './workspace-menu'

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
  const snapshot = useResourceUndoSnapshot(runtime.resources.undo)
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, null)
  const running = snapshot.status === 'running'
  const undo = snapshot.status === 'ready' ? snapshot.undo : null
  const redo = snapshot.status === 'ready' ? snapshot.redo : null
  const canPaste = clipboard.status === 'ready'
  const run = (direction: 'redo' | 'undo') => {
    onClose()
    void actions.undo(direction)
  }
  return (
    <WorkspaceMenu label="Sidebar actions" x={x} y={y} onClose={onClose}>
      <WorkspaceMenuItem
        disabled={running || undo === null}
        icon={<Undo2 />}
        label={undo ? `Undo ${undo.label}` : 'Undo'}
        onActivate={() => run('undo')}
      />
      <WorkspaceMenuItem
        disabled={running || redo === null}
        icon={<Redo2 />}
        label={redo ? `Redo ${redo.label}` : 'Redo'}
        onActivate={() => run('redo')}
      />
      <WorkspaceMenuSeparator />
      <NewResourceSubmenu
        actions={actions}
        creation={creation}
        destinationParentId={null}
        onClose={onClose}
        side={x > globalThis.innerWidth - 404 ? 'left' : 'right'}
      />
      <WorkspaceCreationStatus creation={creation} onCompleted={onClose} />
      <WorkspaceMenuItem
        disabled={!canPaste}
        icon={<ClipboardPaste />}
        label="Paste"
        onActivate={() => {
          onClose()
          void actions.paste(clipboard, null).then(onClipboardChange)
        }}
      />
    </WorkspaceMenu>
  )
}
