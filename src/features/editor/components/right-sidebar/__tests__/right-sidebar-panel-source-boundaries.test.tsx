import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { RightSidebar } from '../right-sidebar'
import type { RightSidebarPanelServices } from '../right-sidebar-panel-source'

describe('right-sidebar panel source boundaries', () => {
  it('renders the active panel from injected panel services', () => {
    const note = createNote()
    const onContentChange = vi.fn()
    const onClose = vi.fn()
    const historyPanel = vi.fn(() => <div>History panel</div>)
    const backlinksPanel = vi.fn(({ itemId }) => (
      <div data-testid="injected-backlinks-panel">{itemId}</div>
    ))
    const outgoingPanel = vi.fn(() => <div>Outgoing panel</div>)
    const outlinePanel = vi.fn(() => <div>Outline panel</div>)
    const panelServices: RightSidebarPanelServices = {
      [RIGHT_SIDEBAR_CONTENT.history]: historyPanel,
      [RIGHT_SIDEBAR_CONTENT.backlinks]: backlinksPanel,
      [RIGHT_SIDEBAR_CONTENT.outgoing]: outgoingPanel,
      [RIGHT_SIDEBAR_CONTENT.outline]: outlinePanel,
    }

    render(
      <RightSidebar
        activeContentId={RIGHT_SIDEBAR_CONTENT.backlinks}
        itemId={note._id}
        itemType={note.type}
        onClose={onClose}
        onContentChange={onContentChange}
        panelServices={panelServices}
      />,
    )

    expect(screen.getByTestId('injected-backlinks-panel')).toHaveTextContent(note._id)
    expect(backlinksPanel).toHaveBeenCalledWith({ itemId: note._id }, undefined)
    expect(historyPanel).not.toHaveBeenCalled()
    expect(outgoingPanel).not.toHaveBeenCalled()
    expect(outlinePanel).not.toHaveBeenCalled()
  })
})
