import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { BackLinksPanel } from '../back-links-panel'
import { OutgoingLinksPanel } from '../outgoing-links-panel'

const { useCampaignQueryMock, navigateToItemMock } = vi.hoisted(() => ({
  useCampaignQueryMock: vi.fn(),
  navigateToItemMock: vi.fn(),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    links: {
      queries: {
        getBacklinkPanelRows: 'getBacklinkPanelRows',
        getOutgoingLinkPanelRows: 'getOutgoingLinkPanelRows',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({
    navigateToItem: navigateToItemMock,
  }),
}))

function sidebarItemId(id: string): Id<'sidebarItems'> {
  return id as Id<'sidebarItems'>
}

const resolvedRow = {
  _id: 'link-1',
  _creationTime: 1,
  blockId: 'block-1',
  query: 'Target Note',
  displayName: null,
  syntax: 'wiki',
  item: {
    _id: 'target-id',
    name: 'Target Note',
    slug: 'target-note',
    type: 'note',
  },
}

describe('link sidebar panels', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    navigateToItemMock.mockReset()
  })

  it('renders outgoing links and navigates resolved rows', () => {
    useCampaignQueryMock.mockReturnValue({
      data: [resolvedRow],
      isPending: false,
      isError: false,
    })

    render(<OutgoingLinksPanel itemId={sidebarItemId('source-id')} />)

    fireEvent.click(screen.getByRole('button', { name: /Target Note/ }))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getOutgoingLinkPanelRows', {
      noteId: 'source-id',
    })
    expect(navigateToItemMock).toHaveBeenCalledWith('target-note')
  })

  it('renders unresolved outgoing links without navigation', () => {
    useCampaignQueryMock.mockReturnValue({
      data: [
        {
          ...resolvedRow,
          _id: 'link-2',
          query: 'Missing Note',
          item: null,
        },
      ],
      isPending: false,
      isError: false,
    })

    render(<OutgoingLinksPanel itemId={sidebarItemId('source-id')} />)

    expect(screen.getByText('Missing Note')).toBeInTheDocument()
    expect(screen.getByText('Unresolved link')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders backlink rows from source notes', () => {
    useCampaignQueryMock.mockReturnValue({
      data: [resolvedRow],
      isPending: false,
      isError: false,
    })

    render(<BackLinksPanel itemId={sidebarItemId('target-id')} />)

    expect(screen.getByRole('button', { name: /Target Note/ })).toBeInTheDocument()
    expect(useCampaignQueryMock).toHaveBeenCalledWith('getBacklinkPanelRows', {
      itemId: 'target-id',
    })
  })
})
