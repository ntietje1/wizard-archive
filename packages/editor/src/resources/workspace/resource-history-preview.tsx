import * as Y from 'yjs'
import { History, Loader2, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Banner, BannerButton } from '@wizard-archive/ui/components/banner'
import { formatRelativeTime } from '@wizard-archive/ui/utils/format-relative-time'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@wizard-archive/ui/shadcn/components/alert-dialog'
import { CanvasReadonlyPreview } from '../../canvas/canvas-readonly-preview'
import { MapEmbedPreview } from '../../maps/map-embed-preview'
import { NoteEditor } from '../../notes/note-editor'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import type {
  EditorRuntime,
  ItemHistoryController,
  ItemHistoryPreview,
  ItemHistoryRestoreState,
} from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { reportWorkspaceTextFeedback } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { renderEmbeddedNoteResource } from './embedded-note-resource-preview'

export function ResourceHistoryPreview({
  actions,
  children,
  resource,
  runtime,
  source,
}: {
  actions: WorkspaceActions
  children: ReactNode
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  source: ItemHistoryController
}) {
  const subscribe = useCallback(
    (listener: () => void) => source.subscribe(resource.id, listener),
    [resource.id, source],
  )
  const getSnapshot = useCallback(() => source.get(resource.id), [resource.id, source])
  const state = useSyncExternalStore(subscribe, getSnapshot)
  return (
    <>
      {state.preview.status === 'closed' ? (
        children
      ) : (
        <OpenHistoryPreview
          actions={actions}
          resource={resource}
          runtime={runtime}
          source={source}
          state={state.preview}
        />
      )}
      <HistoryRestoreDialog resourceId={resource.id} source={source} state={state.restore} />
    </>
  )
}

function OpenHistoryPreview({
  actions,
  resource,
  runtime,
  source,
  state,
}: {
  actions: WorkspaceActions
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  source: ItemHistoryController
  state: Exclude<ReturnType<ItemHistoryController['get']>['preview'], { status: 'closed' }>
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Banner
        icon={<History className="size-3.5" />}
        actions={
          <>
            <BannerButton onClick={() => source.requestRestore(resource.id, state.entryId)}>
              <RotateCcw className="mr-0.5 size-3" />
              Restore
            </BannerButton>
            <BannerButton onClick={() => source.selectPreview(resource.id, null)}>
              <X className="mr-0.5 size-3" />
              Exit
            </BannerButton>
          </>
        }
      >
        Previewing version from{' '}
        <span className="font-semibold">{formatRelativeTime(state.entryTime)}</span>
      </Banner>
      <HistoryPreviewContent
        actions={actions}
        resource={resource}
        runtime={runtime}
        state={state}
      />
    </div>
  )
}

function HistoryPreviewContent({
  actions,
  resource,
  runtime,
  state,
}: {
  actions: WorkspaceActions
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  state: Exclude<ReturnType<ItemHistoryController['get']>['preview'], { status: 'closed' }>
}) {
  if (state.status === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center" role="status">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading historical version</span>
      </div>
    )
  }
  if (state.status !== 'ready') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        {state.status === 'error'
          ? 'Could not load this historical version.'
          : 'This historical version is no longer available.'}
      </div>
    )
  }
  return (
    <HistoryDocumentPreview
      key={state.preview.snapshotId}
      actions={actions}
      preview={state.preview}
      resource={resource}
      runtime={runtime}
    />
  )
}

function HistoryDocumentPreview({
  actions,
  preview,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  preview: ItemHistoryPreview
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  if (preview.kind === 'map') {
    return (
      <div className="min-h-0 flex-1">
        <MapEmbedPreview preview={preview} title={`${resource.title} historical version`} />
      </div>
    )
  }
  return (
    <YjsHistoryDocumentPreview
      actions={actions}
      preview={preview}
      resource={resource}
      runtime={runtime}
    />
  )
}

function YjsHistoryDocumentPreview({
  actions,
  preview,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  preview: Extract<ItemHistoryPreview, { kind: 'note' | 'canvas' }>
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [document] = useState(() => {
    const value = new Y.Doc()
    try {
      Y.applyUpdate(value, preview.update)
      return value
    } catch {
      value.destroy()
      return null
    }
  })
  useEffect(() => () => document?.destroy(), [document])
  if (!document) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
        This historical version is corrupted.
      </div>
    )
  }

  if (preview.kind === 'canvas') {
    return (
      <div className="min-h-0 flex-1">
        <CanvasReadonlyPreview document={document} />
      </div>
    )
  }
  return (
    <NoteEditor
      document={document}
      label={`${resource.title} historical note preview`}
      mode="view"
      resources={{
        report: (message, retry) => reportWorkspaceTextFeedback(actions.report, message, retry),
        renderNote: renderEmbeddedNoteResource,
        runtime,
        sourceResourceId: resource.id,
      }}
      scroll={EPHEMERAL_NOTE_SCROLL}
    />
  )
}

function HistoryRestoreDialog({
  resourceId,
  source,
  state,
}: {
  resourceId: AuthorizedResourceSummary['id']
  source: ItemHistoryController
  state: ItemHistoryRestoreState
}) {
  const restoring = state.status === 'restoring'
  const ready = state.status === 'ready' || state.status === 'error'
  return (
    <AlertDialog
      open={state.status !== 'closed'}
      onOpenChange={(open) => {
        if (!open && !restoring) source.cancelRestore(resourceId)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>{restoreDescription(state)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ready || restoring}
            onClick={(event) => {
              event.preventDefault()
              void source.confirmRestore(resourceId)
            }}
          >
            {restoring ? 'Restoring…' : state.status === 'error' ? 'Try again' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function restoreDescription(state: ItemHistoryRestoreState): string {
  if (state.status === 'closed') return ''
  if (state.status === 'restoring') return 'Restoring this version…'
  if (state.status === 'ready') {
    return `This will restore the item to its state from ${formatRelativeTime(state.entryTime)}. The current content will remain available in history.`
  }
  if (state.result.status === 'rejected' && state.result.reason === 'content_changed') {
    return 'The item changed while restoring. Review the version and try again.'
  }
  if (state.result.status === 'rejected' && state.result.reason === 'snapshot_incompatible') {
    return 'This historical version is not compatible with the current item.'
  }
  return 'This version could not be restored. It may no longer be available.'
}
