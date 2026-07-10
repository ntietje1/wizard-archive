import { Link, Upload } from 'lucide-react'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { EmbedDropTargetVisualState } from '../hooks/use-drop-target'

type EmbedEmptyStateProps = {
  mode?: 'editable' | 'readonly'
  onUpload?: () => void
  onLinkExternal?: () => void
  dropVisualState?: EmbedDropTargetVisualState
}

export function EmbedEmptyState({
  mode = 'editable',
  onUpload,
  onLinkExternal,
  dropVisualState,
}: EmbedEmptyStateProps) {
  const editable = mode === 'editable'
  const showUpload = editable && onUpload
  const showExternalLink = editable && onLinkExternal
  const dropChromeKind =
    editable && dropVisualState?.isDropTarget
      ? dropVisualState.isFileDropTarget
        ? 'file'
        : 'item'
      : 'none'
  const dropChrome =
    dropChromeKind !== 'none' &&
    dropTargetChromeClass(dropChromeKind === 'file' ? 'file' : 'default')

  return (
    <div
      data-drop-target-chrome={dropChromeKind}
      data-testid="embed-empty-state"
      className={cn(
        'flex h-full min-h-36 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/30 p-4 text-center',
        dropChrome,
      )}
    >
      <div className="text-sm font-medium text-foreground">
        {editable ? 'Drag and drop an item or file here' : 'No embed selected'}
      </div>
      {showUpload ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
          onClick={onUpload}
        >
          <Upload className="size-4" aria-hidden />
          Upload
        </button>
      ) : null}
      {showExternalLink ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          onClick={onLinkExternal}
        >
          <Link className="size-3.5" aria-hidden />
          or link to an external file
        </button>
      ) : null}
    </div>
  )
}
