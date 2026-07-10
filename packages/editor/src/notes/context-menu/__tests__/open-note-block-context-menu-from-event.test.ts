import { describe, expect, it, vi } from 'vite-plus/test'
import { openNoteBlockContextMenuFromEvent } from '../open-note-block-context-menu-from-event'
import type { NoteItemWithContent } from '../../../notes/item-contract'

describe('openNoteBlockContextMenuFromEvent', () => {
  it('requires an explicit open menu capability', () => {
    const event = createMouseEvent()

    expect(() =>
      openNoteBlockContextMenuFromEvent({
        event,
        note: { id: 'note-1' } as NoteItemWithContent,
        openMenu: undefined as never,
      }),
    ).toThrow('Note block context menu requires an openMenu capability')
  })
})

function createMouseEvent(): React.MouseEvent<HTMLElement> {
  return {
    clientX: 10,
    clientY: 20,
    nativeEvent: {
      stopImmediatePropagation: vi.fn(),
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent<HTMLElement>
}
