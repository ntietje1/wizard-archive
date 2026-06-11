import { existsSync, readFileSync } from 'node:fs'
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
    const liveActions = readRepoFile(
      'src/features/context-menu/hooks/use-live-editor-context-menu-actions.ts',
    )
    const menuRegistry = readRepoFile('src/features/context-menu/menu-registry.ts')
    const menuTypes = readRepoFile('src/features/context-menu/types.ts')
    const domainRegistryPaths = [
      'src/features/context-menu/registry/sidebar-item-menu.ts',
      'src/features/context-menu/registry/creation-menu.ts',
      'src/features/context-menu/registry/map-pin-menu.ts',
      'src/features/context-menu/registry/editor-panel-menu.ts',
      'src/features/context-menu/registry/sharing-menu.ts',
      'src/features/context-menu/registry/download-menu.ts',
      'src/features/context-menu/registry/filesystem-menu.ts',
      'src/features/context-menu/registry/note-menu.ts',
      'src/features/context-menu/registry/session-menu.ts',
    ]

    expect(liveAdapter).toContain('useLiveEditorContextMenuModel')
    expect(liveAdapter).toContain('EditorContextMenuSurface')
    expect(liveAdapter).toContain('MenuDialogs')
    expect(liveModel).toContain('useLiveEditorContextMenuActions')
    expect(liveModel).toContain('useSidebarWorkspaceSource')
    expect(liveModel).toContain('useCampaignActorPermissions')
    expect(liveModel).toContain('useBlocksShare')
    expect(liveModel).toContain('~/features/sharing/components/sidebar-items-share-panel')
    expect(liveModel).toContain('dialogState')
    expect(liveActions).toContain('useSidebarWorkspaceSource')
    expect(liveActions).toContain('useFileSystem')
    expect(liveActions).toContain('useConvex')
    expect(menuTypes).toContain('EditorContextMenuServices')
    expect(menuTypes).toContain('EditorContextMenuActions')
    expect(menuTypes).not.toContain('EditorContextMenuActionHandlers')
    expect(menuTypes).toContain('EditorCreationContextMenuActions')
    expect(menuTypes).toContain('EditorFilesystemContextMenuActions')

    expect(surface).not.toContain('MenuDialogs')
    expect(surface).not.toContain('MenuDialogState')
    expect(surface).not.toContain('dialogState')
    expect(menuRegistry).not.toContain('useFileSystem')
    expect(menuRegistry).not.toContain('useConvex')
    expect(menuRegistry).not.toContain('FileSystemValue')
    expect(menuRegistry).not.toContain('services.actions[id]')
    expect(menuRegistry).not.toContain('~/features/sharing/components/sidebar-items-share-panel')
    expect(menuRegistry).not.toContain('useRightSidebarStateStore')
    expect(menuRegistry).not.toContain('usePanelPreferenceStore')
    expect(menuRegistry).not.toContain('from ./predicates')
    expect(menuRegistry).not.toContain("from 'lucide-react'")
    expect(menuRegistry).not.toMatch(/import type \{[^}]*ContextMenuCommand/)
    expect(menuRegistry).not.toMatch(/import type \{[^}]*ContextMenuContributor/)
    expect(menuRegistry).not.toContain('satisfies Record<string, ContextMenuCommand')
    expect(menuRegistry).not.toContain('satisfies ReadonlyArray<ContextMenuContributor')
    expect(existsSync(join(repoRoot, 'src/features/context-menu/actions.tsx'))).toBe(false)
    for (const domainRegistryPath of domainRegistryPaths) {
      expect(existsSync(join(repoRoot, domainRegistryPath))).toBe(true)
    }
    expect(liveModel).toContain('useRightSidebarStateStore')
    expect(liveModel).toContain('usePanelPreferenceStore')
    expect(menuTypes).toContain('EditorPanelMenuService')

    for (const source of [liveAdapter, surface, menuRegistry]) {
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
