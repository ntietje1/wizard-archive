import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { createMemoryNoteScrollStore } from '../view-state-store-factory'

describe('view state store factory', () => {
  it('seeds note scroll positions from initial state', () => {
    const noteId = 'note_1' as ResourceId
    const store = createMemoryNoteScrollStore(new Map([[noteId, 240]]))

    expect(store.loadNoteScrollTop(noteId)).toBe(240)
    expect(store.loadNoteScrollTop('note_2' as ResourceId)).toBe(0)
  })
})
