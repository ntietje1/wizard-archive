import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { WORKSPACE_MODE } from '../../../../../shared/workspace/workspace-mode'
import type { AnyItem } from '../../workspace/items'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { testDomainId } from '../../test/domain-id'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { createActorFileSystemPermissions } from '../access'

const memberId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'member_permissions')
type TestWorkspaceActor = NonNullable<
  Parameters<typeof createActorFileSystemPermissions>[0]['actor']
>
const ownerActor: TestWorkspaceActor = { kind: 'owner' }
const viewAsActor: TestWorkspaceActor = { kind: 'owner_view_as', participantId: memberId }

describe('createActorFileSystemPermissions', () => {
  it('gives direct-message editors full item access through the editor permission model', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.NONE })
    const permissions = createActorFileSystemPermissions({
      actor: ownerActor,
      canEdit: true,
      canCreateItems: true,
      canEmptyTrash: true,
      canManageFolders: true,
      getItemById: createLookup([note]),
      setWorkspaceMode: () => undefined,
      workspaceMode: WORKSPACE_MODE.EDITOR,
    })

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(true)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(true)
    expect(permissions.canCreateItems).toBe(true)
    expect(permissions.workspaceMode).toBe(WORKSPACE_MODE.EDITOR)
  })

  it('hard-gates direct-message view-as mutation capabilities', () => {
    const setWorkspaceMode = vi.fn()
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.NONE })
    const permissions = createActorFileSystemPermissions({
      actor: viewAsActor,
      canEdit: false,
      canCreateItems: true,
      canEmptyTrash: true,
      canManageFolders: true,
      getItemById: createLookup([note]),
      setWorkspaceMode,
      workspaceMode: WORKSPACE_MODE.EDITOR,
    })

    permissions.setWorkspaceMode(WORKSPACE_MODE.EDITOR)

    expect(permissions.workspaceMode).toBe(WORKSPACE_MODE.VIEWER)
    expect(setWorkspaceMode).not.toHaveBeenCalled()
    expect(permissions.canCreateItems).toBe(false)
    expect(permissions.canEmptyTrash).toBe(false)
    expect(permissions.canManageFolders).toBe(false)
    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
  })

  it('keeps owner workspace capabilities while gating item mutations for read-only current content', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS })
    const permissions = createActorFileSystemPermissions({
      actor: ownerActor,
      canEdit: false,
      canCreateItems: true,
      canEmptyTrash: true,
      canManageFolders: true,
      getItemById: createLookup([note]),
      setWorkspaceMode: () => undefined,
      workspaceMode: WORKSPACE_MODE.EDITOR,
    })

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(true)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
    expect(permissions.canCreateItems).toBe(true)
    expect(permissions.canEmptyTrash).toBe(true)
    expect(permissions.canManageFolders).toBe(true)
    expect(permissions.workspaceMode).toBe(WORKSPACE_MODE.VIEWER)
  })

  it('resolves view-as sharing while keeping mutations read-only', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('folder_permissions_parent'),
      allPermissionLevel: PERMISSION_LEVEL.EDIT,
      inheritShares: true,
    })
    const note = createNote({
      parentId: folder.id,
      shares: [],
      allPermissionLevel: null,
    })
    const permissions = createActorFileSystemPermissions({
      actor: viewAsActor,
      canEdit: false,
      canCreateItems: false,
      canEmptyTrash: false,
      canManageFolders: false,
      getItemById: createLookup([folder, note]),
      setWorkspaceMode: () => undefined,
      workspaceMode: WORKSPACE_MODE.VIEWER,
    })

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.EDIT)).toBe(true)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
    expect(permissions.getMemberItemPermissionLevel(note, memberId)).toBe(PERMISSION_LEVEL.EDIT)
  })
})

function createLookup(items: Array<AnyItem>) {
  const itemsById = new Map<SidebarItemId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: SidebarItemId) => itemsById.get(itemId) ?? null
}
