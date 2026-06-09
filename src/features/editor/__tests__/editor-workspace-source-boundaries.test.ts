import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('editor workspace source boundaries', () => {
  it('keeps live current-item and editor-mode reads inside the live workspace source', () => {
    const liveSource = readRepoFile(
      'src/features/editor/workspace/use-live-editor-workspace-source.ts',
    )
    const page = readRepoFile('src/features/editor/pages/editor-page.tsx')
    const content = readRepoFile('src/features/editor/components/editor-content.tsx')
    const liveEmptyWorkspaceDrop = readRepoFile(
      'src/features/editor/workspace/use-live-empty-workspace-drop.ts',
    )
    const topbar = readRepoFile('src/features/editor/components/topbar/file-topbar.tsx')
    const topbarActions = readRepoFile(
      'src/features/editor/components/topbar/editor-action-buttons.tsx',
    )
    const topbarShare = readRepoFile('src/features/editor/components/topbar/share-button.tsx')
    const topbarViewAs = readRepoFile('src/features/editor/components/topbar/view-as-button.tsx')
    const rightSidebar = readRepoFile(
      'src/features/editor/components/right-sidebar/right-sidebar-container.tsx',
    )

    expect(liveSource).toContain('useCurrentItem')
    expect(liveSource).toContain('useEditorMode')
    expect(liveSource).toContain('useRightSidebar')
    expect(liveSource).toContain('useSidebarItemsShare')
    expect(liveSource).toContain('useCampaignMembers')
    expect(liveSource).toContain('RIGHT_SIDEBAR_CONTENT.history')
    expect(liveSource).toContain('rightSidebar.close()')
    expect(liveSource).toContain('createSidebarItem')
    expect(liveSource).toContain('useLiveEmptyWorkspaceDropCapability')
    expect(liveSource).not.toContain('DropZone')
    expect(liveSource).not.toContain('ComponentType')
    expect(liveSource).not.toContain('useCreateFileSystemItem')
    expect(liveEmptyWorkspaceDrop).toContain('useDndDropTarget')
    expect(liveEmptyWorkspaceDrop).toContain('useExternalDropTarget')
    expect(liveEmptyWorkspaceDrop).not.toContain('dropTargetChromeClass')
    expect(page).toContain('useLiveEditorWorkspaceSource')

    for (const source of [
      page,
      content,
      topbar,
      topbarActions,
      topbarShare,
      topbarViewAs,
      rightSidebar,
    ]) {
      expect(source).not.toContain('useCurrentItem')
      expect(source).not.toContain('useEditorMode')
      expect(source).not.toContain('useRightSidebar')
      expect(source).not.toContain('useCampaignMembers')
      expect(source).not.toContain('useSidebarItemsShare')
    }
    expect(liveSource).not.toContain('SidebarItemsSharePanel')
    expect(topbar).not.toContain('RIGHT_SIDEBAR_CONTENT')
    expect(topbarShare).toContain('SidebarItemsSharePanel')
    expect(content).not.toContain('useDndDropTarget')
    expect(content).not.toContain('useExternalDropTarget')
    expect(content).not.toContain('useDndStore')
    expect(content).toContain('emptyWorkspaceDrop')
    expect(content).toContain('dropTargetChromeClass')
    expect(rightSidebar).not.toContain('sidebar.close()')
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
