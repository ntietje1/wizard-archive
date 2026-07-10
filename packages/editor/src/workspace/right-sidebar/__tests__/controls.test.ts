import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import { createRightSidebarControls } from '../controls'
import type { RightSidebarContentId } from '../content'
import type { RightSidebarAvailablePanels } from '../source'
import type { ResourceKind } from '../../resource-contract'

describe('createRightSidebarControls', () => {
  it('stores supported content for the current item type and opens the panel', () => {
    const context = createControlContext({ itemType: RESOURCE_TYPES.notes })
    const controls = createRightSidebarControls(context)

    controls.open(RIGHT_SIDEBAR_CONTENT.outline)

    expect(context.setActiveContentForItemType).toHaveBeenCalledWith(
      RESOURCE_TYPES.notes,
      RIGHT_SIDEBAR_CONTENT.outline,
    )
    expect(context.panel.setVisible).toHaveBeenCalledWith(true)
  })

  it('stores the default content when requested content is unsupported for the item type', () => {
    const context = createControlContext({ itemType: RESOURCE_TYPES.files })
    const controls = createRightSidebarControls(context)

    controls.open(RIGHT_SIDEBAR_CONTENT.outline)

    expect(context.setActiveContentForItemType).toHaveBeenCalledWith(
      RESOURCE_TYPES.files,
      RIGHT_SIDEBAR_CONTENT.history,
    )
  })

  it('toggles the current content closed and another content open', () => {
    const context = createControlContext({
      itemType: RESOURCE_TYPES.notes,
      storedContentId: RIGHT_SIDEBAR_CONTENT.history,
      visible: true,
    })
    const controls = createRightSidebarControls(context)

    controls.toggle(RIGHT_SIDEBAR_CONTENT.history)
    controls.toggle(RIGHT_SIDEBAR_CONTENT.outline)

    expect(context.panel.setVisible).toHaveBeenNthCalledWith(1, false)
    expect(context.setActiveContentForItemType).toHaveBeenCalledWith(
      RESOURCE_TYPES.notes,
      RIGHT_SIDEBAR_CONTENT.outline,
    )
    expect(context.panel.setVisible).toHaveBeenNthCalledWith(2, true)
  })

  it('stores a source-available panel when requested content is unavailable', () => {
    const context = createControlContext({
      itemType: RESOURCE_TYPES.notes,
      availablePanels: {
        [RIGHT_SIDEBAR_CONTENT.outline]: true,
      },
      storedContentId: RIGHT_SIDEBAR_CONTENT.history,
    })
    const controls = createRightSidebarControls(context)

    expect(controls.activeContentId).toBe(RIGHT_SIDEBAR_CONTENT.outline)

    controls.open(RIGHT_SIDEBAR_CONTENT.history)

    expect(context.setActiveContentForItemType).toHaveBeenCalledWith(
      RESOURCE_TYPES.notes,
      RIGHT_SIDEBAR_CONTENT.outline,
    )
    expect(context.panel.setVisible).toHaveBeenCalledWith(true)
  })

  it('reports closed state when no panel is available for the current item', () => {
    const context = createControlContext({
      itemType: RESOURCE_TYPES.files,
      availablePanels: {},
      storedContentId: RIGHT_SIDEBAR_CONTENT.history,
      visible: true,
    })
    const controls = createRightSidebarControls(context)

    expect(controls.visible).toBe(false)
  })
})

function createControlContext({
  availablePanels = {
    [RIGHT_SIDEBAR_CONTENT.history]: true,
    [RIGHT_SIDEBAR_CONTENT.backlinks]: true,
    [RIGHT_SIDEBAR_CONTENT.outgoing]: true,
    [RIGHT_SIDEBAR_CONTENT.outline]: true,
  },
  itemType,
  storedContentId,
  visible = false,
}: {
  availablePanels?: RightSidebarAvailablePanels
  itemType: ResourceKind
  storedContentId?: RightSidebarContentId
  visible?: boolean
}) {
  return {
    availablePanels,
    itemType,
    panel: {
      isLoaded: true,
      setSize: vi.fn(),
      setVisible: vi.fn(),
      size: 300,
      visible,
    },
    setActiveContentForItemType: vi.fn(),
    storedContentId,
  }
}
