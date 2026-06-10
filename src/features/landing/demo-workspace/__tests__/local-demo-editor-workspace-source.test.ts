import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import {
  INITIAL_DEMO_WORKSPACE,
  createDemoWorkspaceProjection,
  demoWorkspaceReducer,
} from '../demo-workspace-model'
import { createLocalDemoEditorWorkspaceSource } from '../local-demo-editor-workspace-source'
import type { Id } from 'convex/_generated/dataModel'

describe('createLocalDemoEditorWorkspaceSource', () => {
  it('projects demo workspace state into the shared editor workspace source contract', () => {
    const dispatch = vi.fn()
    const source = createLocalDemoEditorWorkspaceSource({
      dispatch,
      workspace: INITIAL_DEMO_WORKSPACE,
    })

    expect(source.currentItem.contentItem).toMatchObject({
      _id: 'note-market',
      name: 'The Lantern Market',
      type: SIDEBAR_ITEM_TYPES.notes,
    })
    expect(source.currentItem.contentItem).toBe(
      source.filesystem.activeItemsById.get('note-market' as Id<'sidebarItems'>),
    )
    expect(source.campaign.isDm).toBe(true)
    expect(source.editorMode.canEdit).toBe(true)
    expect(source.chrome.topbar.share.visible).toBe(false)
    expect(source.historyPreview.previewingEntryId).toBeNull()
    const { container } = render(
      createElement(source.historyPreview.PreviewComponent, {
        itemId: 'note-market' as Id<'sidebarItems'>,
        entryId: 'history-1' as Id<'editHistory'>,
      }),
    )
    expect(container).toBeEmptyDOMElement()

    source.setPendingItemName('Renamed market')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'renameSelectedItem',
      title: 'Renamed market',
    })

    void source.commands.renameItem(
      source.filesystem.activeItemsById.get('canvas-heist' as Id<'sidebarItems'>)!,
      'Board',
    )
    expect(dispatch).toHaveBeenCalledWith({
      type: 'renameItem',
      itemId: 'canvas-heist',
      title: 'Board',
    })
  })

  it('uses the same canonical projection for source current item and embed resolution', () => {
    const workspace = demoWorkspaceReducer(INITIAL_DEMO_WORKSPACE, {
      type: 'selectItem',
      itemId: 'canvas-heist',
    })
    const source = createLocalDemoEditorWorkspaceSource({
      dispatch: vi.fn(),
      workspace,
    })
    const projectedCanvas = createDemoWorkspaceProjection(workspace).itemsById.get(
      'canvas-heist' as Id<'sidebarItems'>,
    )

    expect(source.currentItem.contentItem).toEqual(projectedCanvas)
    expect(source.currentItem.editorSearch.item).toBe(projectedCanvas?.slug)
    expect(source.filesystem.activeItemsById.get('canvas-heist' as Id<'sidebarItems'>)).toEqual(
      projectedCanvas,
    )
  })
})
