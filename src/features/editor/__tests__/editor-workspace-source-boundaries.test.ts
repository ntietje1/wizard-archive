import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('editor workspace source boundaries', () => {
  it('keeps live current-item and editor-mode reads inside the live workspace source', () => {
    const liveSource = readRepoFile(
      'src/features/editor/workspace/use-live-editor-workspace-source.ts',
    )
    const sourceContract = readRepoFile('src/features/editor/workspace/editor-workspace-source.ts')
    const page = readRepoFile('src/features/editor/pages/editor-page.tsx')
    const content = readRepoFile('src/features/editor/components/editor-content.tsx')
    const liveEmptyWorkspaceDrop = readRepoFile(
      'src/features/editor/workspace/use-live-empty-workspace-drop.ts',
    )
    const createNewDashboard = readRepoFile(
      'src/features/editor/components/create-new-dashboard.tsx',
    )
    const newItemCard = readRepoFile(
      'src/features/editor/components/viewer/folder/new-item-card.tsx',
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
    expect(liveSource).toContain('useSidebarItemsShare')
    expect(liveSource).toContain('useCampaignMembers')
    expect(liveSource).toContain('createSidebarItem')
    expect(liveSource).toContain('useLiveEmptyWorkspaceDropCapability')
    expect(sourceContract).toContain('items: EditorWorkspaceItems')
    expect(sourceContract).toContain('itemActions: EditorWorkspaceItemActionsCapability')
    expect(sourceContract).toContain('navigation: EditorWorkspaceNavigation')
    expect(sourceContract).toContain('createItem:')
    expect(sourceContract).toContain('openItemBySlug:')
    expect(sourceContract).toContain('history: EditorWorkspaceHistory')
    expect(sourceContract).toContain('files: EditorWorkspaceFiles')
    expect(sourceContract).not.toContain('chrome: EditorWorkspaceChrome')
    expect(sourceContract).not.toContain('rightSidebar')
    expect(sourceContract).not.toContain('RightSidebarContentId')
    expect(sourceContract).not.toContain('ui:')
    expect(sourceContract).not.toContain('commands: EditorWorkspaceCommands')
    expect(sourceContract).not.toContain('historyPreview')
    expect(sourceContract).not.toContain('viewers: EditorWorkspaceViewers')
    expect(sourceContract).not.toContain('interactions:')
    expect(sourceContract).not.toContain('actionMenu')
    expect(liveSource).not.toContain('DropZone')
    expect(liveSource).not.toContain('ComponentType')
    expect(liveSource).not.toContain('useCreateFileSystemItem')
    expect(liveSource).not.toContain('chrome:')
    expect(liveSource).not.toContain('historyPreview')
    expect(liveSource).not.toContain('viewers:')
    expect(liveSource).not.toContain('useRightSidebar')
    expect(liveSource).not.toContain('RIGHT_SIDEBAR_CONTENT')
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
    expect(page).not.toContain('workspaceSource.chrome')
    expect(topbar).not.toContain('source.chrome')
    expect(content).not.toContain('source.operations')
    expect(content).not.toContain('source.historyPreview')
    expect(createNewDashboard).toContain('useEditorWorkspaceSource')
    expect(createNewDashboard).not.toContain('useSidebarWorkspaceSource')
    expect(createNewDashboard).not.toContain('useSidebarUIStore')
    expect(newItemCard).toContain('useEditorWorkspaceSource')
    expect(newItemCard).not.toContain('useSidebarWorkspaceSource')
    expect(page).toContain('useRightSidebar')
    expect(page).toContain('RIGHT_SIDEBAR_CONTENT.history')
    expect(rightSidebar).not.toContain('sidebar.close()')
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
