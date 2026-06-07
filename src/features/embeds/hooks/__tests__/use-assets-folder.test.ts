import { describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { resolveAssetsFolderId } from '../use-assets-folder'

describe('resolveAssetsFolderId', () => {
  it('does not resolve before sidebar items have loaded', async () => {
    const createItem = vi.fn()

    await expect(
      resolveAssetsFolderId({
        rootItems: [],
        createItem,
        loaded: false,
      } as never),
    ).rejects.toThrow('Cannot resolve Assets folder before sidebar items load')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('does not resolve when sidebar items failed to load', async () => {
    const createItem = vi.fn()

    await expect(
      resolveAssetsFolderId({
        rootItems: [],
        createItem,
        loaded: false,
      } as never),
    ).rejects.toThrow('Cannot resolve Assets folder before sidebar items load')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('reuses a root folder named Assets when it exists', async () => {
    const createItem = vi.fn()

    const result = await resolveAssetsFolderId({
      rootItems: [
        {
          _id: 'assets-id',
          type: SIDEBAR_ITEM_TYPES.folders,
          name: 'Assets',
          parentId: null,
        },
      ],
      createItem,
      loaded: true,
    } as never)

    expect(result).toBe('assets-id')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('creates Assets at root with the asset icon when missing', async () => {
    const createItem = vi.fn().mockResolvedValue({ id: 'new-assets' })

    const result = await resolveAssetsFolderId({
      rootItems: [],
      createItem,
      loaded: true,
    } as never)

    expect(result).toBe('new-assets')
    expect(createItem).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.folders,
      name: 'Assets',
      iconName: 'Box',
      parentTarget: { kind: 'direct', parentId: null },
    })
  })
})
