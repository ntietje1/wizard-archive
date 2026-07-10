import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { WORKSPACE_MODE } from '../../../../../../shared/workspace/workspace-mode'
import { createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { RESOURCE_STATUS } from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import { resolveResourceWorkspaceModePolicy } from '../workspace-mode-policy'
import type { EditorWorkspaceActor } from '../permission-resolution'

const memberId = testId<'campaignMembers'>('workspace_mode_member')
const participantActor: EditorWorkspaceActor = { kind: 'participant' }
const ownerViewAsActor: EditorWorkspaceActor = {
  kind: 'owner_view_as',
  participantId: memberId,
}

describe('resource workspace mode policy', () => {
  it('keeps editor mode when the actor can edit the current resource', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })

    expect(
      resolveResourceWorkspaceModePolicy({
        actor: participantActor,
        currentItem: note,
        getItemById: createLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: true, workspaceMode: WORKSPACE_MODE.EDITOR })
  })

  it('forces viewer mode for owner view-as actors', () => {
    const noteBase = createNote()
    const note = createNote({
      id: noteBase.id,
      campaignId: noteBase.campaignId,
      shares: [
        {
          id: testId<'sidebarItemShares'>('workspace_mode_share'),
          createdAt: 1,
          campaignId: noteBase.campaignId,
          sidebarItemId: noteBase.id,
          sidebarItemType: noteBase.type,
          campaignMemberId: memberId,
          sessionId: null,
          permissionLevel: PERMISSION_LEVEL.EDIT,
        },
      ],
    })

    expect(
      resolveResourceWorkspaceModePolicy({
        actor: ownerViewAsActor,
        currentItem: note,
        getItemById: createLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: false, workspaceMode: WORKSPACE_MODE.VIEWER })
  })

  it('forces viewer mode for trashed resources', () => {
    const note = createNote({
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      status: RESOURCE_STATUS.trashed,
    })

    expect(
      resolveResourceWorkspaceModePolicy({
        actor: participantActor,
        currentItem: note,
        getItemById: createLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: false, workspaceMode: WORKSPACE_MODE.VIEWER })
  })

  it('keeps workspace mode policy out of access presentation', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/filesystem/access.ts'),
      'utf8',
    )
    const workspaceModeFunction = source.slice(
      source.indexOf('export function resolveWorkspaceModeForItem'),
      source.indexOf('export function createActorFileSystemPermissions'),
    )

    expect(workspaceModeFunction).toContain('resolveResourceWorkspaceModePolicy')
    expect(workspaceModeFunction).not.toContain('isTrashedSidebarItem')
    expect(workspaceModeFunction).not.toContain('actorCanMutateResource')
  })
})

function createLookup(items: Array<AnyItem>) {
  const itemsById = new Map<SidebarItemId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: SidebarItemId) => itemsById.get(itemId) ?? null
}
