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
    const topbar = readRepoFile('src/features/editor/components/topbar/file-topbar.tsx')
    const rightSidebar = readRepoFile(
      'src/features/editor/components/right-sidebar/right-sidebar-container.tsx',
    )

    expect(liveSource).toContain('useCurrentItem')
    expect(liveSource).toContain('useEditorMode')
    expect(liveSource).toContain('createSidebarItem')
    expect(liveSource).not.toContain('useCreateFileSystemItem')
    expect(page).toContain('useLiveEditorWorkspaceSource')

    for (const source of [page, content, topbar, rightSidebar]) {
      expect(source).not.toContain('useCurrentItem')
      expect(source).not.toContain('useEditorMode')
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
