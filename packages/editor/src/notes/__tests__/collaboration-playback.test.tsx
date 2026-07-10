import { renderHook } from '@testing-library/react'
import { act } from 'react'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { YjsCollaborationProvider } from '../../collaboration/yjs-provider'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { useNoteCollaborationPlayback } from '../use-collaboration-playback'

type PlaybackEditor = CustomBlockNoteEditor
type PlaybackBlock = PlaybackEditor['document'][number]

describe('useNoteCollaborationPlayback', () => {
  it('applies collaboration playback to the rendered block index', () => {
    vi.useFakeTimers()
    let destroy: (() => void) | undefined
    let unmount: (() => void) | undefined
    try {
      const updateBlock = vi.fn()
      const editor = createPlaybackEditor(
        [
          createParagraph('block-1', 'Scene: Moonwell Docks'),
          createParagraph('block-2', 'Jun adds: The tide bell'),
        ],
        updateBlock,
      )
      const noteId = 'note-market' as SidebarItemId
      const playbackSession = createPlaybackProvider()
      destroy = playbackSession.destroy
      const view = renderHook(() =>
        useNoteCollaborationPlayback({
          editor,
          noteId,
          playback: {
            collaborators: [],
            initialTypingStep: 8,
            intervalMs: 100,
            noteId,
            typingBlockIndex: 1,
            typingText: 'Jun adds: The tide bell rings twice.',
          },
          provider: playbackSession.provider,
        }),
      )
      unmount = view.unmount

      expect(updateBlock).toHaveBeenCalledWith('block-2', {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Jun adds: T', styles: {} }],
      })

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(updateBlock).toHaveBeenLastCalledWith('block-2', {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Jun adds: The ', styles: {} }],
      })
    } finally {
      unmount?.()
      destroy?.()
      vi.useRealTimers()
    }
  })
})

function createPlaybackEditor(
  document: Array<PlaybackBlock>,
  updateBlock: ReturnType<typeof vi.fn>,
): PlaybackEditor {
  return {
    document,
    prosemirrorView: {
      state: {},
    },
    updateBlock: updateBlock.mockImplementation(
      (blockId: string, update: Partial<PlaybackBlock>) => {
        const index = document.findIndex((block) => block.id === blockId)
        if (index >= 0) {
          document[index] = { ...document[index], ...update } as PlaybackBlock
        }
      },
    ),
  } as unknown as PlaybackEditor
}

function createParagraph(id: string, text: string): PlaybackBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  } as unknown as PlaybackBlock
}

function createPlaybackProvider(): {
  destroy: () => void
  provider: YjsCollaborationProvider
} {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  return {
    destroy: () => {
      awareness.destroy()
      doc.destroy()
    },
    provider: {
      awareness,
      destroy: () => {
        awareness.destroy()
      },
      doc,
      emit: () => undefined,
      flushPendingUpdates: () => Promise.resolve(true),
      flushUpdates: () => Promise.resolve(),
      isApplyingRemoteUpdate: () => false,
      off: () => undefined,
      on: () => undefined,
      updateUser: () => undefined,
    },
  }
}
