import { CollapseToggle } from './collapse-toggle'
import { NotesNavButton } from './notes-nav-button'
import { CampaignPlayersButton } from './campaign-players-button'
import { SceneNavButton } from './scene-nav-button'
import { UserMenu } from '~/features/auth/components/user-menu'
import { BookmarksFilterButton } from '~/features/sidebar/components/sidebar-toolbar/bookmarks-filter-button'
import { CloseAllFoldersButton } from '~/features/sidebar/components/sidebar-toolbar/close-all-folders'
import { NewFolderButton } from '~/features/sidebar/components/sidebar-toolbar/new-folder'
import { NewNoteButton } from '~/features/sidebar/components/sidebar-toolbar/new-note'
import { SortMenu } from '~/features/sidebar/components/sidebar-toolbar/sort-menu'
import { useSidebarLayout } from '~/features/sidebar/hooks/useSidebarLayout'

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { isSidebarExpanded } = useSidebarLayout()

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 flex items-center py-0.5 pl-0.5 space-x-0.25">
        <CollapseToggle />
        <NewNoteButton />
        <NewFolderButton />
        <CloseAllFoldersButton />
        <SortMenu />
        <BookmarksFilterButton />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="shrink-0 flex flex-col items-center px-0.5 space-y-1">
          <NotesNavButton />
          <SceneNavButton />
          <CampaignPlayersButton />
          <div className="flex-1" />
          <UserMenu />
        </div>
        {isSidebarExpanded && <div className="w-[1px] bg-border" />}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 border-t`}>
          {children}
        </div>
      </div>
    </div>
  )
}
