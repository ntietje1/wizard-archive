import { Suspense, lazy } from 'react'
import { TrashPageViewer } from './viewer/trash/trash-page-viewer'
import { CreateNewDashboard } from './create-new-dashboard'
import { LoadingSpinner } from '~/shared/components/loading-spinner'
import type { SidebarItemAvailabilityState } from 'shared/sidebar-items/availability'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import type { EditorWorkspaceSource } from '../workspace/editor-workspace-source'
import { EditorWorkspaceSourceProvider } from '../workspace/editor-workspace-source-context'
import { RequestAccessButton } from '~/features/sidebar/components/request-access-button'

const EMPTY_EDITOR_CONTENT_CLASS = 'flex-1 min-h-0 flex items-center justify-center'

const SidebarItemEditor = lazy(() =>
  import('./viewer/sidebar-item-editor').then((m) => ({
    default: m.SidebarItemEditor,
  })),
)

function EditorLoading() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )
}

export function EditorContent({ source }: { source: EditorWorkspaceSource }) {
  return (
    <EditorWorkspaceSourceProvider value={source}>
      <EditorContentBody source={source} />
    </EditorWorkspaceSourceProvider>
  )
}

function EditorContentBody({ source }: { source: EditorWorkspaceSource }) {
  const { item, contentItem, editorSearch, isLoading, hasRequestedItem } =
    source.content.currentItem
  const canView = source.content.canViewCurrentItem

  if (isLoading) {
    return <EditorLoading />
  }

  // Show trash page when ?trash=true and no specific item selected
  if (editorSearch.trash === true && !item) {
    return <TrashPageViewer />
  }

  if (!canView) {
    if (hasRequestedItem) {
      return (
        <UnavailableEditorContent
          state={source.content.availabilityState}
          requestedSlug={source.content.requestedSlug}
          isCreatingMissingItem={source.items.isCreatingMissingRequestedNote}
          onCreateMissingItem={source.items.createMissingRequestedNote}
        />
      )
    }
    return <EmptyEditorContent source={source} />
  }

  if (!contentItem) {
    return <EditorLoading />
  }

  return (
    <Suspense fallback={<EditorLoading />}>
      <SidebarItemEditor item={contentItem} history={source.history} files={source.files} />
    </Suspense>
  )
}

function EmptyEditorContent({ source }: { source: EditorWorkspaceSource }) {
  const { workspace } = source
  const content = !workspace.isCampaignLoaded ? null : workspace.isDm ? (
    <CreateNewDashboard parentId={null} />
  ) : (
    <p className="text-muted-foreground">Select an item from the sidebar to view it.</p>
  )

  const emptyWorkspaceDrop = source.items.emptyWorkspaceDrop
  if (emptyWorkspaceDrop.status === 'enabled') {
    const { target } = emptyWorkspaceDrop
    return (
      <div
        ref={target.ref}
        className={cn(
          EMPTY_EDITOR_CONTENT_CLASS,
          target.isSidebarItemDropTarget &&
            !target.isFileDropTarget &&
            dropTargetChromeClass('default'),
          target.isFileDropTarget && dropTargetChromeClass('file'),
        )}
        data-testid="empty-workspace-drop-zone"
      >
        {content}
      </div>
    )
  }

  return <div className={EMPTY_EDITOR_CONTENT_CLASS}>{content}</div>
}

function UnavailableEditorContent({
  state,
  requestedSlug,
  isCreatingMissingItem,
  onCreateMissingItem,
}: {
  state: SidebarItemAvailabilityState
  requestedSlug: string | null
  isCreatingMissingItem: boolean
  onCreateMissingItem: () => void
}) {
  // UnavailableEditorContent is only rendered when canView is false; an
  // available state prop here would violate that caller invariant.
  if (state.status === 'available') {
    return null
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p>{state.message}</p>
        {state.status === 'not_found' && requestedSlug && (
          <p className="mt-2">
            <Button variant="link" onClick={onCreateMissingItem} disabled={isCreatingMissingItem}>
              Create it
            </Button>
          </p>
        )}
        {state.status === 'not_shared' && (
          <div className="mt-3">
            <RequestAccessButton />
          </div>
        )}
      </div>
    </div>
  )
}
