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

  it('neutralizes dangerous external urls', () => {
    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'md',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Bad',
      rawTarget: 'javascript:alert(1)',
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      resolved: true,
      itemId: null,
      href: null,
      isExternal: true,
    })
  })

  it('neutralizes data urls', () => {
    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'md',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Bad',
      rawTarget: 'data:text/html,<script>alert(1)</script>',
      isExternal: true,
    })

    expect(resolved).toMatchObject({
      resolved: true,
      itemId: null,
      href: null,
      isExternal: true,
    })
  })

  it('neutralizes vbscript urls', () => {
    const { result } = renderHook(() => useLinkResolver())

    const resolved = result.current.resolveLink({
      syntax: 'md',
      itemPath: [],
      itemName: '',
      headingPath: [],
      displayName: 'Bad',
      rawTarget: 'vbscript:msgbox("x")',
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
