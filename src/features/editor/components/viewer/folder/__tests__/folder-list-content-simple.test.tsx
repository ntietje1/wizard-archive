import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import { FolderListContentSimple } from '../folder-list-content-simple'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'

const activeSidebarItemsMock = vi.hoisted(() => vi.fn())
const filteredSidebarItemsMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeSidebarItemsMock(),
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => filteredSidebarItemsMock(),
}))

function sidebarValue(data: Array<AnySidebarItem>) {
  const parentItemsMap = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()
  for (const item of data) {
    const siblings = parentItemsMap.get(item.parentId) ?? []
    siblings.push(item)
    parentItemsMap.set(item.parentId, siblings)
  }

  return { parentItemsMap }
}

describe('FolderListContentSimple', () => {
  beforeEach(() => {
    activeSidebarItemsMock.mockReset()
    filteredSidebarItemsMock.mockReset()
  })

  it('renders only children from the filtered sidebar view', () => {
    const folderId = testId<'sidebarItems'>('folder-1')
    const visibleNote = createNote({
      name: 'Visible Note',
      parentId: folderId,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hiddenNote = createNote({
      name: 'Hidden Note',
      parentId: folderId,
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    activeSidebarItemsMock.mockReturnValue(sidebarValue([visibleNote, hiddenNote]))
    filteredSidebarItemsMock.mockReturnValue(sidebarValue([visibleNote]))

    render(<FolderListContentSimple folderId={folderId} />)

    expect(screen.getByText('Visible Note')).toBeInTheDocument()
    expect(screen.queryByText('Hidden Note')).not.toBeInTheDocument()
  })
})
