import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { createMemoryNoteScrollStore } from '../view-state-store-factory'

describe('view state store factory', () => {
  it('seeds note scroll positions from initial state', () => {
    const noteId = 'note_1' as SidebarItemId
    const store = createMemoryNoteScrollStore(new Map([[noteId, 240]]))

    expect(store.loadNoteScrollTop(noteId)).toBe(240)
    expect(store.loadNoteScrollTop('note_2' as SidebarItemId)).toBe(0)
  })
})
