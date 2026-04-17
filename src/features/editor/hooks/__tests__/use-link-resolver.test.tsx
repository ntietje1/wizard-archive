import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { useLinkResolver } from '../useLinkResolver'

const { useCampaignMock, useEditorModeMock, useActiveSidebarItemsMock } = vi.hoisted(() => ({
  useCampaignMock: vi.fn(),
  useEditorModeMock: vi.fn(),
  useActiveSidebarItemsMock: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => useCampaignMock(),
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => useEditorModeMock(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => useActiveSidebarItemsMock(),
}))

describe('useLinkResolver', () => {
  beforeEach(() => {
    useCampaignMock.mockReturnValue({
      dmUsername: 'dm',
      campaignSlug: 'world',
    })
    useEditorModeMock.mockReturnValue({
      editorMode: 'editor',
      viewAsPlayerId: undefined,
    })
    useActiveSidebarItemsMock.mockReturnValue({
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
    useActiveSidebarItemsMock.mockReturnValue({
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
    })

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
})
