import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('sidebar workspace source boundaries', () => {
  it('keeps live item queries and editor-mode filtering inside the live sidebar source', () => {
    const liveSource = readRepoFile(
      'src/features/sidebar/workspace/use-live-sidebar-workspace-source.ts',
    )
    const provider = readRepoFile('src/features/sidebar/contexts/all-sidebar-items-provider.tsx')
    const filteredProvider = readRepoFile(
      'src/features/sidebar/contexts/filtered-sidebar-items-provider.tsx',
    )

    expect(liveSource).toContain('useSidebarItemsQueries')
    expect(liveSource).toContain('useEditorMode')
    expect(liveSource).toContain('effectiveHasAtLeastPermission')
    expect(provider).toContain('useLiveSidebarWorkspaceSource')

    for (const source of [provider, filteredProvider]) {
      expect(source).not.toContain('useSidebarItemsQueries')
      expect(source).not.toContain('useEditorMode')
      expect(source).not.toContain('effectiveHasAtLeastPermission')
      expect(source).not.toContain('buildSidebarItemMaps')
    }
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
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
