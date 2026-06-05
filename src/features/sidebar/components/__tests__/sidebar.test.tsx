import { createElement } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { FileSidebar } from '~/features/sidebar/components/sidebar'

const activeItemsState = vi.hoisted(() => ({
  status: 'success' as 'pending' | 'error' | 'success',
  error: null as unknown,
  refetch: vi.fn(),
}))
const campaignSidebarState = vi.hoisted(() => ({
  bookmarksOnlyMode: false,
}))

vi.mock('@tanstack/react-router', () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/features/sidebar/stores/sidebar-ui-store', () => ({
  useCampaignSidebarState: () => campaignSidebarState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => activeItemsState,
}))

vi.mock('~/features/sidebar/components/sidebar-root/droppable-root', () => ({
  DroppableRoot: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('~/features/sidebar/components/sidebar-list', () => ({
  SidebarList: () => createElement('div', { 'data-testid': 'sidebar-list' }),
}))

vi.mock('~/features/sidebar/components/bookmarked-items-list', () => ({
  BookmarkedItemsList: () => createElement('div', { 'data-testid': 'bookmarked-items' }),
}))

describe('FileSidebar', () => {
  beforeEach(() => {
    activeItemsState.status = 'success'
    activeItemsState.error = null
    activeItemsState.refetch.mockReset()
    campaignSidebarState.bookmarksOnlyMode = false
  })

  it('renders an explicit retryable error when active sidebar items fail to load', () => {
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    render(<FileSidebar />)

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
    expect(screen.getByText('sidebar failed')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar-list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(activeItemsState.refetch).toHaveBeenCalled()
  })

  it('renders the active-items error before bookmarks-only mode', () => {
    campaignSidebarState.bookmarksOnlyMode = true
    activeItemsState.status = 'error'
    activeItemsState.error = new Error('sidebar failed')

    render(<FileSidebar />)

    expect(screen.getByText('Failed to load sidebar items.')).toBeInTheDocument()
    expect(screen.queryByTestId('bookmarked-items')).not.toBeInTheDocument()
  })
})
