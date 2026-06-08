import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { useNoteEditorFileDropCursor } from '../useNoteEditorFileDropCursor'

const dropCursor = vi.hoisted(() => vi.fn(() => ({ spec: { view: vi.fn() } })))

vi.mock('@tiptap/pm/dropcursor', () => ({
  dropCursor,
}))

function createEditor() {
  const embedNodeSpec: {
    disableDropCursor?: unknown
  } = {}
  const view = {
    dom: document.createElement('div'),
    state: {
      schema: {
        nodes: {
          embed: {
            spec: embedNodeSpec,
          },
        },
      },
    },
  }
  const tiptapEditor = {
    view,
    registerPlugin: vi.fn(),
  }

  return {
    editor: { _tiptapEditor: tiptapEditor } as unknown as CustomBlockNoteEditor,
    embedNodeSpec,
    tiptapEditor,
  }
}

function createUnmountedEditor() {
  const tiptapEditor = {
    view: undefined,
    registerPlugin: vi.fn(),
  }

  return {
    editor: { _tiptapEditor: tiptapEditor } as unknown as CustomBlockNoteEditor,
    tiptapEditor,
  }
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('useNoteEditorFileDropCursor', () => {
  afterEach(() => {
    dropCursor.mockClear()
    vi.restoreAllMocks()
  })

  it('registers the native ProseMirror dropcursor plugin for editable note editors', async () => {
    const { editor, tiptapEditor } = createEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, true))
    await flushAnimationFrame()

    expect(dropCursor).toHaveBeenCalledWith({
      color: false,
      width: 2,
      class: 'note-editor-file-drop-cursor',
    })
    expect(tiptapEditor.registerPlugin).toHaveBeenCalledWith(dropCursor.mock.results[0].value)
  })

  it('disables ProseMirror drop cursors when drag coordinates are over an empty embed block', async () => {
    const { editor, embedNodeSpec } = createEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, true))
    await flushAnimationFrame()

    const emptyEmbed = document.createElement('section')
    emptyEmbed.setAttribute('data-note-embed-drop-target', 'true')
    emptyEmbed.setAttribute('data-note-embed-target-kind', 'empty')
    document.body.appendChild(emptyEmbed)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(),
    })
    const elementFromPointSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(emptyEmbed)

    const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperties(dragOver, {
      clientX: { value: 12 },
      clientY: { value: 18 },
    })

    const disableDropCursor = embedNodeSpec.disableDropCursor as (
      view: unknown,
      position: { pos: number; inside: number },
      event: DragEvent,
    ) => boolean

    expect(disableDropCursor({}, { pos: 1, inside: 1 }, dragOver as DragEvent)).toBe(true)
    expect(elementFromPointSpy).toHaveBeenCalledWith(12, 18)
  })

  it('does not register a dropcursor for non-editable note editors', async () => {
    const { editor, tiptapEditor } = createEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, false))
    await flushAnimationFrame()

    expect(dropCursor).not.toHaveBeenCalled()
    expect(tiptapEditor.registerPlugin).not.toHaveBeenCalled()
  })

  it('does not register duplicate dropcursor plugins for the same editor', async () => {
    const { editor, tiptapEditor } = createEditor()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useNoteEditorFileDropCursor(editor, enabled),
      { initialProps: { enabled: true } },
    )
    await flushAnimationFrame()

    rerender({ enabled: false })
    rerender({ enabled: true })
    await flushAnimationFrame()

    expect(dropCursor).toHaveBeenCalledTimes(1)
    expect(tiptapEditor.registerPlugin).toHaveBeenCalledTimes(1)
  })

  it('stops polling when the ProseMirror view never mounts', () => {
    const callbacks: Array<FrameRequestCallback> = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callbacks.push(callback)
        return callbacks.length
      },
    )
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined)
    const { editor, tiptapEditor } = createUnmountedEditor()

    const { unmount } = renderHook(() => useNoteEditorFileDropCursor(editor, true))
    while (callbacks.length > 0) {
      const callback = callbacks.shift()
      callback?.(0)
    }
    unmount()

    expect(dropCursor).not.toHaveBeenCalled()
    expect(tiptapEditor.registerPlugin).not.toHaveBeenCalled()

    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1)
  })

  it('warns when the ProseMirror view never becomes ready for dropcursor registration', () => {
    const callbacks: Array<FrameRequestCallback> = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback) => {
        callbacks.push(callback)
        return callbacks.length
      },
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { editor } = createUnmountedEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, true))
    while (callbacks.length > 0) {
      const callback = callbacks.shift()
      callback?.(0)
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Drop cursor registration failed after 120 attempts'),
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('editorId=unavailable'))
  })
})
