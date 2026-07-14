import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { validateNoCircularParentAsync } from '../items'

describe('sidebar parent validation', () => {
  it('rejects corrupt ancestor cycles when validating a move target', async () => {
    const targetParentId = 'folder-a' as ResourceId
    const otherFolderId = 'folder-b' as ResourceId
    const parents = new Map<ResourceId, { parentId: ResourceId | null }>([
      [targetParentId, { parentId: otherFolderId }],
      [otherFolderId, { parentId: targetParentId }],
    ])

    const result = await validateNoCircularParentAsync(
      'moving-item' as ResourceId,
      targetParentId,
      (id) => parents.get(id),
    )

    expect(result).toEqual({
      valid: false,
      error: 'This move would create a circular reference',
    })
  })

  it('accepts acyclic parent chains when validating a move target', async () => {
    const targetParentId = 'folder-a' as ResourceId
    const otherFolderId = 'folder-b' as ResourceId
    const parents = new Map<ResourceId, { parentId: ResourceId | null }>([
      [targetParentId, { parentId: otherFolderId }],
      [otherFolderId, { parentId: null }],
    ])

    const result = await validateNoCircularParentAsync(
      'moving-item' as ResourceId,
      targetParentId,
      (id) => parents.get(id),
    )

    expect(result).toEqual({ valid: true })
  })
})
