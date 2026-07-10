import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useItemSelectionInteractions } from '../use-item-selection-interactions'
import type { ItemSelectionModifierState } from '../selection-intent'
import { createNote } from '../../../test/sidebar-item-factory'
import {
  createSidebarWorkspaceStateHarness,
  createSidebarWorkspaceStateWrapper,
} from './test-helpers'

function clickEvent(
  modifiers: Partial<ItemSelectionModifierState> = {},
): ItemSelectionModifierState & { preventDefault: () => void; currentTarget: HTMLElement } {
  return {
    shiftKey: modifiers.shiftKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    platform: modifiers.platform,
    preventDefault: () => undefined,
    currentTarget: document.createElement('button'),
  }
}

describe('useItemSelectionInteractions', () => {
  it('selects a plain-clicked item before open navigation finishes', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const item = createNote({ slug: 'target-note' })
    const onOpen = vi.fn(() => {
      expect(sidebar.current.selectionCommands.getSelectionSnapshot().selectedItemIds).toEqual([
        item.id,
      ])
    })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(item, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [item.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent(), onOpen)
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([item.id])
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('extends selection for range selection clicks', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(first.id)
    })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first.id, second.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ shiftKey: true }))
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([first.id, second.id])
  })

  it('toggles selection for ctrl-clicks', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(first.id)
    })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first.id, second.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ ctrlKey: true, platform: 'other' }))
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([first.id, second.id])
  })

  it('does not toggle selection for macOS ctrl-clicks', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(first.id)
    })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first.id, second.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ ctrlKey: true, platform: 'mac' }))
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([second.id])
  })

  it('toggles selection for meta-clicks', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    act(() => {
      sidebar.current.selectionCommands.selectSingleItem(first.id)
    })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first.id, second.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ metaKey: true }))
    })

    expect(sidebar.current.selection.selectedItemIds).toEqual([first.id, second.id])
  })

  it('keeps sidebar row activation owned by the sidebar root surface', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const parent = createNote({ slug: 'parent-note' })
    const child = createNote({ slug: 'child-note', parentId: parent.id })
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(child, {
          surface: 'sidebar',
          parentId: child.parentId,
          visibleItemIds: [parent.id, child.id],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.handleItemClick(clickEvent())
    })

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [parent.id, child.id],
    })
  })

  it.each([
    { label: 'ctrl-clicked', modifiers: { ctrlKey: true, platform: 'other' as const } },
    { label: 'meta-clicked', modifiers: { metaKey: true } },
  ])(
    'removes a $label item from multi-selection while preserving the remaining item',
    ({ modifiers }) => {
      const sidebar = createSidebarWorkspaceStateHarness()
      const first = createNote({ slug: 'first-note' })
      const second = createNote({ slug: 'second-note' })
      act(() => {
        sidebar.current.selectionCommands.selectSingleItem(first.id)
        sidebar.current.selectionCommands.toggleItemSelection(second.id)
      })
      const { result } = renderHook(
        () =>
          useItemSelectionInteractions(first, {
            surface: 'sidebar',
            parentId: null,
            visibleItemIds: [first.id, second.id],
          }),
        {
          wrapper: createSidebarWorkspaceStateWrapper({
            workspaceId: sidebar.workspaceId,
            sort: sidebar.sort,
          }),
        },
      )

      act(() => {
        result.current.handleItemClick(clickEvent(modifiers))
      })

      expect(sidebar.current.selection.selectedItemIds).toEqual([second.id])
    },
  )
})
