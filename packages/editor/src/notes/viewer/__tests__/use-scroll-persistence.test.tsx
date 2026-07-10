import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useScrollPersistence } from '../use-scroll-persistence'

const NOTE_ID = 'note-1' as SidebarItemId

describe('useScrollPersistence', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores saved scroll when the viewport attaches after the hook mounts', () => {
    const viewport = document.createElement('div')
    const scrollStore = {
      loadNoteScrollTop: vi.fn(() => 240),
      saveNoteScrollTop: vi.fn(),
    }

    const { rerender } = renderHook(
      ({ element }: { element: HTMLDivElement | null }) =>
        useScrollPersistence(NOTE_ID, element, scrollStore),
      { initialProps: { element: null as HTMLDivElement | null } },
    )

    expect(scrollStore.loadNoteScrollTop).not.toHaveBeenCalled()

    rerender({ element: viewport })

    expect(scrollStore.loadNoteScrollTop).toHaveBeenCalledWith(NOTE_ID)
    expect(viewport.scrollTop).toBe(240)
  })

  it('does not mark skipped restoration as complete', () => {
    const viewport = document.createElement('div')
    const scrollStore = {
      loadNoteScrollTop: vi.fn(() => 180),
      saveNoteScrollTop: vi.fn(),
    }

    const { rerender } = renderHook(
      ({ skipRestore }: { skipRestore: boolean }) =>
        useScrollPersistence(NOTE_ID, viewport, scrollStore, skipRestore),
      { initialProps: { skipRestore: true } },
    )

    expect(scrollStore.loadNoteScrollTop).not.toHaveBeenCalled()

    rerender({ skipRestore: false })

    expect(scrollStore.loadNoteScrollTop).toHaveBeenCalledWith(NOTE_ID)
    expect(viewport.scrollTop).toBe(180)
  })
})
