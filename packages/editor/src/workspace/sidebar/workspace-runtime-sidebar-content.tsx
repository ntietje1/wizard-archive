import type { ReactNode } from 'react'
import {
  Bookmark,
  BookmarkCheck,
  FileText,
  FolderDot,
  FolderOpenDot,
  Plus,
  Search,
} from 'lucide-react'
import { createRuntimeCreateItemSource } from '../../filesystem/create-item-runtime-source'
import { createRuntimeTrashSource } from '../../filesystem/trash/runtime-source'
import type { ResourceCatalog, ResourceOperationItems } from '../../filesystem/catalog'
import type { FileSystemItemSidebarOperations } from '../../filesystem/item-operation-contracts'
import type { ResourceShareSource, ViewAsParticipantCapability } from '../../sharing/contracts'
import type { FileSystemSearch } from '../../filesystem/search'
import type { WorkspaceNavigation } from '../runtime'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { FileSidebarPanel } from './components/file-sidebar-panel'
import { SidebarRow } from './components/sidebar-row'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import { NewNoteButton } from './components/sidebar-toolbar/new-note'
import { SortMenu } from './components/sidebar-toolbar/sort-menu'
import { TrashButton } from './components/trash-button'
import { createRuntimeSidebarTreeSource } from './create-runtime-sidebar-tree-source'
import { useSidebarWorkspaceState } from './workspace-state'
import type { FileSystemLoadState } from '../../filesystem/load-state'
import type { FileSystemSelection } from '../../filesystem/selection'
import type { FileSystemPermissions } from '../../filesystem/permissions'
import { useWorkspaceRuntimeSearchRequestState } from '../search-request-state'

type WorkspaceRuntimeSidebarContentInput = {
  filesystem: {
    catalog: Pick<
      ResourceCatalog,
      | 'getKnownItemById'
      | 'getTrashedChildren'
      | 'getTrashedItems'
      | 'getTrashedRoots'
      | 'getVisibleChildren'
      | 'getVisibleItems'
      | 'getVisibleRoots'
    >
    load: Pick<
      FileSystemLoadState,
      | 'activeError'
      | 'activeStatus'
      | 'refreshActive'
      | 'refreshTrash'
      | 'trashError'
      | 'trashStatus'
    >
    operationItems: ResourceOperationItems
    operations: FileSystemItemSidebarOperations
    permissions: Pick<
      FileSystemPermissions,
      | 'canAccessItem'
      | 'canCreateItems'
      | 'canEdit'
      | 'canEmptyTrash'
      | 'canManageFolders'
      | 'canMutateItem'
    >
    search: Pick<FileSystemSearch, 'status'>
    selection: Pick<FileSystemSelection, 'selectedItemIds'>
    sharing: {
      items: ResourceShareSource
      viewAsParticipant: ViewAsParticipantCapability
    }
  }
  navigation: Pick<
    WorkspaceNavigation,
    'current' | 'openCreateDashboard' | 'openDefaultItem' | 'openItem' | 'openTrash'
  >
}

export function WorkspaceRuntimeSidebarContent({
  bottomPanel,
  layout,
  railEndControls,
  railStartControls,
  runtime,
  showPanelDivider,
  topStartControls,
}: {
  bottomPanel?: ReactNode
  layout: 'fixed' | 'fill'
  railEndControls?: ReactNode
  railStartControls?: ReactNode
  runtime: WorkspaceRuntimeSidebarContentInput
  showPanelDivider: boolean
  topStartControls?: ReactNode
}) {
  const {
    filesystem: { search },
    navigation: { current },
  } = runtime
  const {
    ui: { bookmarksOnlyMode, closeAllFoldersMode },
    uiCommands: { toggleBookmarksOnlyMode, toggleCloseAllFoldersMode },
    selectionCommands: { getSelectionSnapshot },
  } = useSidebarWorkspaceState()
  const notesIsActive = current.kind === 'resource' || current.kind === 'create'
  const createItemSource = createRuntimeCreateItemSource(runtime)
  const canCreateItems = createItemSource.canCreateItems()
  const searchRequest = useWorkspaceRuntimeSearchRequestState()
  const trashSource = createRuntimeTrashSource(runtime)
  const sidebarTreeSource = createRuntimeSidebarTreeSource({
    ...runtime,
    sidebarSelection: { getSelectionSnapshot },
  })
  const closeAllFoldersLabel = closeAllFoldersMode
    ? 'Exit close-all-folders mode'
    : 'Enter close-all-folders mode'
  const bookmarksLabel = bookmarksOnlyMode ? 'Exit bookmarks' : 'Show bookmarks'

  return (
    <FileSidebarPanel
      bottomPanel={bottomPanel}
      footerActions={
        <>
          {canCreateItems && (
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => void createItemSource.openCreateDashboard()}
            >
              <SidebarRow icon={Plus} label="New" className="select-none" />
            </button>
          )}
          <TrashButton source={trashSource} />
        </>
      }
      layout={layout}
      railEndControls={railEndControls}
      railStartControls={
        <>
          <TooltipButton tooltip="Notes" side="right">
            <Button
              variant={notesIsActive ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Notes"
              aria-current={notesIsActive ? 'page' : undefined}
              onClick={() => {
                void runtime.navigation.openDefaultItem()
              }}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </TooltipButton>
          {railStartControls}
        </>
      }
      showPanelDivider={showPanelDivider}
      sidebarTreeSource={sidebarTreeSource}
      topEndControls={
        search.status === 'available' ? (
          <TooltipButton tooltip="Search (Ctrl+K)" side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => searchRequest.open()}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipButton>
        ) : undefined
      }
      toolbarActions={
        <>
          <NewNoteButton source={createItemSource} />
          <TooltipButton tooltip={closeAllFoldersLabel} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCloseAllFoldersMode}
              data-state={closeAllFoldersMode ? 'active' : 'inactive'}
              aria-label={closeAllFoldersLabel}
              aria-pressed={closeAllFoldersMode}
            >
              {closeAllFoldersMode ? (
                <FolderDot className="h-4 w-4" />
              ) : (
                <FolderOpenDot className="h-4 w-4" />
              )}
            </Button>
          </TooltipButton>
          <SortMenu />
          <TooltipButton tooltip={bookmarksLabel} side="bottom">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleBookmarksOnlyMode}
              data-state={bookmarksOnlyMode ? 'active' : 'inactive'}
              aria-label={bookmarksLabel}
              aria-pressed={bookmarksOnlyMode}
            >
              {bookmarksOnlyMode ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </TooltipButton>
        </>
      }
      topStartControls={topStartControls}
    />
  )
}
