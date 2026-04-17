import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
})
