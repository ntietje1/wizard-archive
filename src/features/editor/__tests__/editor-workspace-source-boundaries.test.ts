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
    const liveDropZone = readRepoFile(
      'src/features/editor/workspace/live-empty-workspace-drop-zone.tsx',
    )
    const topbar = readRepoFile('src/features/editor/components/topbar/file-topbar.tsx')
    const rightSidebar = readRepoFile(
      'src/features/editor/components/right-sidebar/right-sidebar-container.tsx',
    )

    expect(liveSource).toContain('useCurrentItem')
    expect(liveSource).toContain('useEditorMode')
    expect(liveSource).toContain('useRightSidebar')
    expect(liveSource).toContain('rightSidebar.close()')
    expect(liveSource).toContain('createSidebarItem')
    expect(liveSource).toContain('LiveEmptyWorkspaceDropZone')
    expect(liveSource).not.toContain('useCreateFileSystemItem')
    expect(liveDropZone).toContain('useDndDropTarget')
    expect(liveDropZone).toContain('useExternalDropTarget')
    expect(page).toContain('useLiveEditorWorkspaceSource')

    for (const source of [page, content, topbar, rightSidebar]) {
      expect(source).not.toContain('useCurrentItem')
      expect(source).not.toContain('useEditorMode')
      expect(source).not.toContain('useRightSidebar')
    }
    expect(content).not.toContain('useDndDropTarget')
    expect(content).not.toContain('useExternalDropTarget')
    expect(content).not.toContain('useDndStore')
    expect(content).toContain('emptyWorkspaceDrop')
    expect(rightSidebar).not.toContain('sidebar.close()')
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
