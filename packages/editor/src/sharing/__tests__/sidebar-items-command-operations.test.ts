import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { createSidebarItemsShareCommandOperations } from '../sidebar-items/command-operations'

describe('sidebar item share command operations', () => {
  it('executes sidebar sharing changes as filesystem share commands', async () => {
    const item = createNote({ name: 'Shared Scene' })
    const memberId = testId<'campaignMembers'>('member_1')
    const executeCommand = vi.fn().mockResolvedValue(null)
    const operations = createSidebarItemsShareCommandOperations({ executeCommand })

    await operations.setDefaultPermission({
      itemIds: [item.id],
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
    await operations.setParticipantPermission({
      itemIds: [item.id],
      participantId: memberId,
      permissionLevel: PERMISSION_LEVEL.EDIT,
    })
    await operations.clearParticipantPermission({
      itemIds: [item.id],
      participantId: memberId,
    })
    await operations.setFolderInheritShares({
      folderId: item.id,
      inheritShares: true,
    })

    expect(executeCommand.mock.calls.map(([command]) => command)).toEqual([
      {
        type: 'setResourceAudiencePermission',
        itemIds: [item.id],
        permissionLevel: PERMISSION_LEVEL.VIEW,
      },
      {
        type: 'setResourcesMemberPermission',
        itemIds: [item.id],
        campaignMemberId: memberId,
        permissionLevel: PERMISSION_LEVEL.EDIT,
      },
      {
        type: 'clearResourcesMemberPermission',
        itemIds: [item.id],
        campaignMemberId: memberId,
      },
      {
        type: 'setFolderInheritShares',
        folderId: item.id,
        inheritShares: true,
      },
    ])
  })
})
