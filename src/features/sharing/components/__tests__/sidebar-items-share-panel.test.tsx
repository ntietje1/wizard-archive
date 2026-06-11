import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SidebarItemsSharePanel } from '../sidebar-items-share-panel'
import { createNote } from '~/test/factories/sidebar-item-factory'

const useSidebarItemsShareMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/sharing/hooks/useSidebarItemsShare', () => ({
  useSidebarItemsShare: useSidebarItemsShareMock,
}))

vi.mock('../share-permission-menu', () => ({
  SharePermissionMenu: ({ title }: { title: ReactNode }) => (
    <div data-testid="share-panel">{title}</div>
  ),
}))

function stubShareState() {
  useSidebarItemsShareMock.mockReturnValue({
    isPending: false,
    isMutating: false,
    shareItems: [],
    allPlayersPermissionLevel: null,
    inheritedAllPermissionLevel: null,
    inheritedFromFolderName: null,
    isFolder: false,
    inheritShares: false,
    setMemberPermission: vi.fn(),
    clearMemberPermission: vi.fn(),
    setAllPlayersPermission: vi.fn(),
    setInheritShares: vi.fn(),
  })
}

describe('SidebarItemsSharePanel', () => {
  it('keeps the opened share target group when parent selection props change', () => {
    stubShareState()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    const { rerender } = render(<SidebarItemsSharePanel items={[first, second]} />)

    expect(screen.getByTestId('share-panel')).toHaveTextContent('Share 2 items')
    expect(useSidebarItemsShareMock).toHaveBeenLastCalledWith([first, second])

    rerender(<SidebarItemsSharePanel items={[first]} />)

    expect(screen.getByTestId('share-panel')).toHaveTextContent('Share 2 items')
    expect(useSidebarItemsShareMock).toHaveBeenLastCalledWith([first, second])
  })
})
