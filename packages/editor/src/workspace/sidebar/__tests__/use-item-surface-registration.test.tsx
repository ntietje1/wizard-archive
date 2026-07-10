import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { useItemSurfaceRegistration } from '../use-item-surface-registration'
import { testId } from '../../../test/id'
import {
  createSidebarWorkspaceStateHarness,
  createSidebarWorkspaceStateWrapper,
} from './test-helpers'

describe('useItemSurfaceRegistration', () => {
  it('activates the registered surface on request', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')

    const { result } = renderHook(
      () =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds: [noteId],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.activateSurface()
    })

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })
  })

  it('updates the active surface when visible ids change', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const first = testId<'sidebarItems'>('note_1')
    const second = testId<'sidebarItems'>('note_2')

    const { result, rerender } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      {
        initialProps: { visibleItemIds: [first] },
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )
    act(() => {
      result.current.activateSurface()
    })

    rerender({ visibleItemIds: [first, second] })

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [first, second],
    })
  })

  it('keeps the existing active surface owner until explicit activation', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const folderId = testId<'sidebarItems'>('folder_1')

    act(() => {
      sidebar.current.selectionCommands.setActiveItemSurface({
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [noteId],
      })
    })

    renderHook(
      () =>
        useItemSurfaceRegistration({
          surface: 'folder-view',
          parentId: folderId,
          visibleItemIds: [noteId],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })
  })

  it('clears the active surface when the owning registration unmounts', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const noteId = testId<'sidebarItems'>('note_1')
    const { result, unmount } = renderHook(
      () =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds: [noteId],
        }),
      {
        wrapper: createSidebarWorkspaceStateWrapper({
          workspaceId: sidebar.workspaceId,
          sort: sidebar.sort,
        }),
      },
    )

    act(() => {
      result.current.activateSurface()
    })

    unmount()

    expect(sidebar.current.selection.activeItemSurface).toBeNull()
  })
})
