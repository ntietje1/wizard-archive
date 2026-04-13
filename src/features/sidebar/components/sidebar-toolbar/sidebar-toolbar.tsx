import { CollapseToggle } from './collapse-toggle'
import { NotesNavButton } from './notes-nav-button'
import { CampaignPlayersButton } from './campaign-players-button'
import { SceneNavButton } from './scene-nav-button'
import { UserMenu } from '~/features/auth/components/user-menu'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import { BookmarksFilterButton } from '~/features/sidebar/components/sidebar-toolbar/bookmarks-filter-button'
import { CloseAllFoldersButton } from '~/features/sidebar/components/sidebar-toolbar/close-all-folders'
import { SortMenu } from '~/features/sidebar/components/sidebar-toolbar/sort-menu'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
} from '~/features/sidebar/components/sidebar-toolbar/constants'
import { SearchButton } from './search-button'
import { NewNoteButton } from './new-note'

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { visible } = usePanelPreference(LEFT_SIDEBAR_PANEL_ID, LEFT_SIDEBAR_DEFAULTS)

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 flex items-center py-0.5 px-0.5 space-x-0.25">
        <CollapseToggle />
        <NewNoteButton />
        <CloseAllFoldersButton />
        <SortMenu />
        <BookmarksFilterButton />
        <div className="flex-1" />
        <SearchButton />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="shrink-0 flex flex-col items-center px-0.5 space-y-1">
          <NotesNavButton />
          <SceneNavButton />
          <CampaignPlayersButton />
          <div className="flex-1" />
          <div className="shrink-0">
            <UserMenu />
          </div>
        </div>
        {visible && <div className="w-[1px] bg-border" />}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 border-t`}>{children}</div>
      </div>
    </div>
  )
}
