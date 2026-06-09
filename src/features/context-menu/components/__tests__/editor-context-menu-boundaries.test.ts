import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('editor context menu boundaries', () => {
  it('keeps live data wiring out of the reusable context menu surface', () => {
    const liveAdapter = readRepoFile('src/features/context-menu/components/editor-context-menu.tsx')
    const surface = readRepoFile(
      'src/features/context-menu/components/editor-context-menu-surface.tsx',
    )
    const liveModel = readRepoFile(
      'src/features/context-menu/hooks/use-live-editor-context-menu-model.ts',
    )

    expect(liveAdapter).toContain('useLiveEditorContextMenuModel')
    expect(liveAdapter).toContain('EditorContextMenuSurface')
    expect(liveAdapter).toContain('MenuDialogs')
    expect(liveModel).toContain('useSidebarWorkspaceSource')
    expect(liveModel).toContain('useCampaignActorPermissions')
    expect(liveModel).toContain('useBlocksShare')
    expect(liveModel).toContain('dialogState')

    expect(surface).not.toContain('MenuDialogs')
    expect(surface).not.toContain('MenuDialogState')
    expect(surface).not.toContain('dialogState')

    for (const source of [liveAdapter, surface]) {
      expect(source).not.toContain('useSidebarWorkspaceSource')
      expect(source).not.toContain('useCampaignActorPermissions')
      expect(source).not.toContain('useBlocksShare')
      expect(source).not.toContain('useCampaignMembers')
      expect(source).not.toContain('useSession')
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
