import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { createFileSystemReadModel } from 'shared/sidebar-items/filesystem/read-model'
import { FileSystemContext } from '../useFileSystem'
import { useCreateFileSystemItem } from '../useCreateFileSystemItem'
import { createNote } from '~/test/factories/sidebar-item-factory'
import type { FileSystemValue } from '../useFileSystem'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { ReactNode } from 'react'

const filesystemMocks = vi.hoisted(() => ({
  createItem: vi.fn(),
}))

const sidebarItemsCache = vi.hoisted(() => ({
  active: [] as Array<AnySidebarItem>,
  trash: [] as Array<AnySidebarItem>,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemsCache', () => ({
  useSidebarItemsCache: () => ({
    get: (view: string) => (view === 'active' ? sidebarItemsCache.active : sidebarItemsCache.trash),
  }),
}))

vi.mock('../useFileSystemReadModel', () => ({
  useFileSystemReadModel: () => ({
    readModel: createFileSystemReadModel([...sidebarItemsCache.active, ...sidebarItemsCache.trash]),
  }),
}))

describe('useCreateFileSystemItem', () => {
  beforeEach(() => {
    sidebarItemsCache.active = []
    sidebarItemsCache.trash = []
    filesystemMocks.createItem.mockReset()
    filesystemMocks.createItem.mockResolvedValue({ id: 'new-note', slug: 'untitled-note-1' })
  })

  it('resolves omitted names inside the filesystem creation boundary', async () => {
    sidebarItemsCache.active = [createNote({ name: 'Untitled Note' })]
    const { result } = renderHook(() => useCreateFileSystemItem(), { wrapper })

    await result.current.createItem({
      type: SIDEBAR_ITEM_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(filesystemMocks.createItem).toHaveBeenCalledWith(
      {
        itemType: SIDEBAR_ITEM_TYPES.notes,
        name: 'Untitled Note 1',
        parentTarget: { kind: 'direct', parentId: null },
        iconName: undefined,
        color: undefined,
      },
      undefined,
    )
  })
})

function wrapper({ children }: { children: ReactNode }) {
  return createElement(FileSystemContext.Provider, { value: createFileSystemValue() }, children)
}

function createFileSystemValue(): FileSystemValue {
  return {
    createItem: filesystemMocks.createItem,
  } as unknown as FileSystemValue
}
