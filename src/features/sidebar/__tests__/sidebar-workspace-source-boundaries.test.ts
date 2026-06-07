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
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
