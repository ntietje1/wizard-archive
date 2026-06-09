import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useLinkResolver } from '../useLinkResolver'

const { useCampaignMock, useActiveSidebarItemsMock, useFilteredSidebarItemsMock } = vi.hoisted(
  () => ({
    useCampaignMock: vi.fn(),
    useActiveSidebarItemsMock: vi.fn(),
    useFilteredSidebarItemsMock: vi.fn(),
  }),
)

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => useCampaignMock(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => useActiveSidebarItemsMock(),
}))

vi.mock('~/features/sidebar/hooks/useFilteredSidebarItems', () => ({
  useFilteredSidebarItems: () => useFilteredSidebarItemsMock(),
}))

describe('useLinkResolver', () => {
  beforeEach(() => {
    useCampaignMock.mockReturnValue({
      dmUsername: 'dm',
      campaignSlug: 'world',
    })
    useActiveSidebarItemsMock.mockReturnValue({
      data: [],
      itemsMap: new Map(),
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [],
      itemsMap: new Map(),
    })
  })

  it('keeps safe external urls clickable', () => {
    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'md',
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Docs',
      rawTarget: 'https://example.com/docs',
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      resolved: true,
      itemId: null,
      href: 'https://example.com/docs',
      isExternal: true,
    })
  })

  it('uses explicit caller-owned viewer mode', () => {
    const { result } = renderHook(() => useLinkResolver(undefined, { isViewerMode: true }))

    expect(result.current.isViewerMode).toBe(true)
  })

  it.each([
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript', 'vbscript:msgbox("x")'],
  ])('neutralizes %s urls', (_, rawTarget) => {
    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'md',
      pathKind: 'global',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Bad',
      rawTarget,
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      resolved: true,
      itemId: null,
      href: null,
      isExternal: true,
    })
  })

  it('resolves relative links from the source note parent', () => {
    const sidebarItemsValue = {
      data: [
        { _id: 'folder-1' as Id<'sidebarItems'>, name: 'Lore', parentId: null },
        {
          _id: 'note-1' as Id<'sidebarItems'>,
          name: 'Current Note',
          parentId: 'folder-1' as Id<'sidebarItems'>,
        },
        {
          _id: 'note-2' as Id<'sidebarItems'>,
          name: 'Sibling Note',
          parentId: 'folder-1' as Id<'sidebarItems'>,
          slug: 'sibling-note',
        },
      ],
      itemsMap: new Map([
        [
          'folder-1' as Id<'sidebarItems'>,
          {
            _id: 'folder-1' as Id<'sidebarItems'>,
            name: 'Lore',
            parentId: null,
            slug: 'lore',
          },
        ],
        [
          'note-1' as Id<'sidebarItems'>,
          {
            _id: 'note-1' as Id<'sidebarItems'>,
            name: 'Current Note',
            parentId: 'folder-1' as Id<'sidebarItems'>,
            slug: 'current-note',
          },
        ],
        [
          'note-2' as Id<'sidebarItems'>,
          {
            _id: 'note-2' as Id<'sidebarItems'>,
            name: 'Sibling Note',
            parentId: 'folder-1' as Id<'sidebarItems'>,
            slug: 'sibling-note',
          },
        ],
      ]),
    }
    useActiveSidebarItemsMock.mockReturnValue(sidebarItemsValue)
    useFilteredSidebarItemsMock.mockReturnValue(sidebarItemsValue)

    const { result } = renderHook(() => useLinkResolver('note-1' as Id<'sidebarItems'>))

    const resolved = result.current.resolveLink({
      syntax: 'wiki',
      pathKind: 'relative',
      itemPath: ['.', 'Sibling Note'],
      itemName: 'Sibling Note',
      headingPath: [],
      displayName: null,
      rawTarget: './Sibling Note',
      isExternal: false,
    })

    expect(resolved).toMatchObject({
      resolved: true,
      itemId: 'note-2',
      href: '/campaigns/dm/world/editor?item=sibling-note',
      isExternal: false,
    })
  })

  it('does not resolve links to sidebar items missing from the filtered view', () => {
    const hiddenNote = {
      _id: 'note-hidden' as Id<'sidebarItems'>,
      name: 'Hidden Note',
      parentId: null,
      slug: 'hidden-note',
    }
    useActiveSidebarItemsMock.mockReturnValue({
      data: [hiddenNote],
      itemsMap: new Map([[hiddenNote._id, hiddenNote]]),
    })
    useFilteredSidebarItemsMock.mockReturnValue({
      data: [],
      itemsMap: new Map(),
    })

    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'wiki',
      pathKind: 'global',
      itemPath: ['Hidden Note'],
      itemName: 'Hidden Note',
      headingPath: [],
      displayName: null,
      rawTarget: 'Hidden Note',
      isExternal: false,
    })

    expect(resolved).toMatchObject({
      resolved: false,
      itemId: null,
      href: null,
      color: null,
    })
    expect(result.current.allItems).toEqual([])
  })
})
