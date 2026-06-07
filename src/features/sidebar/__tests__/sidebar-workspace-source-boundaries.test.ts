import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('sidebar workspace source boundaries', () => {
  it('keeps live item queries and actor filtering inside the live sidebar source', () => {
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const provider = readRepoFile('src/features/sidebar/contexts/all-sidebar-items-provider.tsx')
    const filteredProvider = readRepoFile(
      'src/features/sidebar/contexts/filtered-sidebar-items-provider.tsx',
    )
    const campaignActorHook = readRepoFile('src/features/campaigns/hooks/useCampaignActor.ts')

    expect(liveSource).toContain('useSidebarItemsQueries')
    expect(liveSource).toContain('useCampaignActor')
    expect(liveSource).not.toContain('useEditorMode')
    expect(liveSource).toContain('effectiveHasAtLeastPermission')
    expect(provider).toContain('useLiveSidebarWorkspaceSource')

    for (const source of [provider, filteredProvider]) {
      expect(source).not.toContain('useSidebarItemsQueries')
      expect(source).not.toContain('useEditorMode')
      expect(source).not.toContain('effectiveHasAtLeastPermission')
      expect(source).not.toContain('buildSidebarItemMaps')
    }
    expect(campaignActorHook).not.toContain('useSidebarItems')
    expect(campaignActorHook).not.toContain('useCurrentItem')
    expect(campaignActorHook).not.toContain('useFileSystemReadModel')
  })

  it('keeps campaign sidebar UI state inside the sidebar workspace source', () => {
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const sidebar = readRepoFile('src/features/sidebar/components/sidebar.tsx')
    const bookmarkedItemsList = readRepoFile(
      'src/features/sidebar/components/bookmarked-items-list.tsx',
    )
    const sidebarList = readRepoFile('src/features/sidebar/components/sidebar-list.tsx')
    const bookmarksFilterButton = readRepoFile(
      'src/features/sidebar/components/sidebar-toolbar/bookmarks-filter-button.tsx',
    )
    const closeAllFoldersButton = readRepoFile(
      'src/features/sidebar/components/sidebar-toolbar/close-all-folders.tsx',
    )
    const folderStateHook = readRepoFile('src/features/sidebar/hooks/useFolderState.ts')

    expect(liveSource).toContain('useCampaignSidebarState')
    expect(liveSource).toContain('useCampaignSidebarActions')

    for (const source of [
      sidebar,
      bookmarkedItemsList,
      sidebarList,
      bookmarksFilterButton,
      closeAllFoldersButton,
      folderStateHook,
    ]) {
      expect(source).not.toContain('useCampaignSidebarState')
      expect(source).not.toContain('useCampaignSidebarActions')
    }
  })

  it('keeps sidebar selection presentation reads inside the workspace source', () => {
    const sourceContract = readRepoFile(
      'src/features/sidebar/workspace/sidebar-workspace-source.ts',
    )
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const selectedItemHook = readRepoFile('src/features/sidebar/hooks/useSelectedItem.ts')
    const selectionInteractions = readRepoFile(
      'src/features/sidebar/hooks/useItemSelectionInteractions.ts',
    )
    const surfaceRegistration = readRepoFile(
      'src/features/sidebar/hooks/useItemSurfaceRegistration.ts',
    )
    const dragData = readRepoFile('src/features/dnd/hooks/useSidebarDragData.ts')
    const shareButton = readRepoFile(
      'src/features/sidebar/components/sidebar-item/sidebar-item-share-button.tsx',
    )
    const hotkeys = readRepoFile('src/features/sidebar/hooks/useItemSurfaceHotkeys.ts')
    const contextMenu = readRepoFile('src/features/context-menu/components/editor-context-menu.tsx')
    const contextMenuActions = readRepoFile('src/features/context-menu/actions.tsx')
    const filesystemProvider = readRepoFile('src/features/filesystem/filesystem-provider.tsx')
    const sidebarItem = readRepoFile(
      'src/features/sidebar/components/sidebar-item/sidebar-item.tsx',
    )
    const bookmarkedItemsList = readRepoFile(
      'src/features/sidebar/components/bookmarked-items-list.tsx',
    )

    expect(sourceContract).toContain('selection: SidebarWorkspaceSelection')
    expect(sourceContract).toContain('selectionCommands: SidebarWorkspaceSelectionCommands')
    expect(sourceContract).toContain('editing: SidebarWorkspaceEditing')
    expect(liveSource).toContain('useSidebarWorkspaceSelection')
    expect(liveSource).toContain('useSidebarWorkspaceSelectionCommands')

    for (const source of [
      selectionInteractions,
      surfaceRegistration,
      dragData,
      shareButton,
      hotkeys,
      contextMenu,
      contextMenuActions,
      filesystemProvider,
      sidebarItem,
      bookmarkedItemsList,
    ]) {
      expect(source).not.toContain('useSidebarUIStore')
      expect(source).not.toContain('useFileSystemReadModel')
    }
    expect(selectedItemHook).toContain('useSidebarWorkspaceSource')
  })

  it('keeps sidebar sort options inside the sidebar workspace source', () => {
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const campaignLayout = readRepoFile('src/features/campaigns/pages/campaign-layout.tsx')
    const sidebarList = readRepoFile('src/features/sidebar/components/sidebar-list.tsx')
    const bookmarkedItemsList = readRepoFile(
      'src/features/sidebar/components/bookmarked-items-list.tsx',
    )
    const sidebarItem = readRepoFile(
      'src/features/sidebar/components/sidebar-item/sidebar-item.tsx',
    )
    const sortMenu = readRepoFile('src/features/sidebar/components/sidebar-toolbar/sort-menu.tsx')

    expect(liveSource).toContain('useLiveSidebarSortOptions')
    expect(campaignLayout).not.toContain('SidebarSortOptionsProvider')
    for (const source of [sidebarList, bookmarkedItemsList, sidebarItem, sortMenu]) {
      expect(source).not.toContain('useSortOptions')
    }
  })

  it('keeps open-parent-folder behavior inside the sidebar workspace source', () => {
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const sourceContract = readRepoFile(
      'src/features/sidebar/workspace/sidebar-workspace-source.ts',
    )
    const creationCommand = readRepoFile(
      'src/features/sidebar/hooks/useRunSidebarItemCreationCommand.ts',
    )
    const hotkeys = readRepoFile('src/features/sidebar/hooks/useItemSurfaceHotkeys.ts')

    expect(liveSource).toContain('openParentFolders')
    expect(sourceContract).toContain('SidebarItemId')
    expect(sourceContract).not.toContain("from 'convex/_generated/dataModel'")
    expect(creationCommand).toContain('useSidebarWorkspaceSource')
    expect(hotkeys).toContain('useSidebarWorkspaceSource')
    expect(creationCommand).not.toContain('useOpenParentFolders')
    expect(hotkeys).not.toContain('useOpenParentFolders')
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
