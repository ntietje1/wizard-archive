import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { applyFileSystemPatchesToSidebarCache } from '../cache-patches'
import { createNote } from '../../test/sidebar-item-factory'

describe('filesystem bookmark cache patches', () => {
  it('applies item bookmark-state receipt patches to visible sidebar items', () => {
    const note = createNote({ id: 'note_1' as ResourceId, isBookmarked: false })

    const bookmarked = applyFileSystemPatchesToSidebarCache({ sidebar: [note], trash: [] }, [
      {
        type: 'setResourceBookmarkState',
        itemId: note.id,
        isBookmarked: true,
      },
    ])

    expect(bookmarked.sidebar).toEqual([expect.objectContaining({ isBookmarked: true })])

    const unbookmarked = applyFileSystemPatchesToSidebarCache(bookmarked, [
      {
        type: 'setResourceBookmarkState',
        itemId: note.id,
        isBookmarked: false,
      },
    ])

    expect(unbookmarked.sidebar).toEqual([expect.objectContaining({ isBookmarked: false })])
  })
})
