import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { validateNoCircularParentAsync } from '../items'

describe('sidebar parent validation', () => {
  it('rejects corrupt ancestor cycles when validating a move target', async () => {
    const targetParentId = 'folder-a' as SidebarItemId
    const otherFolderId = 'folder-b' as SidebarItemId
    const parents = new Map<SidebarItemId, { parentId: SidebarItemId | null }>([
      [targetParentId, { parentId: otherFolderId }],
      [otherFolderId, { parentId: targetParentId }],
    ])

    const result = await validateNoCircularParentAsync(
      'moving-item' as SidebarItemId,
      targetParentId,
      (id) => parents.get(id),
    )

    expect(result).toEqual({
      valid: false,
      error: 'This move would create a circular reference',
    })
  })

  it('accepts acyclic parent chains when validating a move target', async () => {
    const targetParentId = 'folder-a' as SidebarItemId
    const otherFolderId = 'folder-b' as SidebarItemId
    const parents = new Map<SidebarItemId, { parentId: SidebarItemId | null }>([
      [targetParentId, { parentId: otherFolderId }],
      [otherFolderId, { parentId: null }],
    ])

    const result = await validateNoCircularParentAsync(
      'moving-item' as SidebarItemId,
      targetParentId,
      (id) => parents.get(id),
    )

    expect(result).toEqual({ valid: true })
  })
})
