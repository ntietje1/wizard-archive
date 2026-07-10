import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useNoteEditorStore } from '../../editor-store'
import { useNoteHeadingScrollRequest } from '../scroll-request'
import type { NoteBlock } from '../../document/model'

describe('useNoteHeadingScrollRequest', () => {
  let scrollIntoViewMock: (options?: boolean | ScrollIntoViewOptions) => void
  let cssEscape: typeof CSS.escape | undefined
  let hadCssEscape = false
  let hadScrollIntoView = false
  let originalScrollIntoView: Element['scrollIntoView'] | undefined

  beforeEach(() => {
    document.body.innerHTML = ''
    scrollIntoViewMock = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>()
    hadScrollIntoView = Object.hasOwn(Element.prototype, 'scrollIntoView')
    originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
      ?.value as Element['scrollIntoView'] | undefined
    Element.prototype.scrollIntoView = ((options) => {
      scrollIntoViewMock(options)
    }) satisfies Element['scrollIntoView']
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    hadCssEscape = Object.hasOwn(CSS, 'escape')
    cssEscape = CSS.escape
    CSS.escape = (value) => value
  })

  afterEach(() => {
    useNoteEditorStore.setState({ editor: null, provider: null })
    vi.restoreAllMocks()
    if (hadScrollIntoView && originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView
    } else {
      delete (Element.prototype as { scrollIntoView?: Element['scrollIntoView'] }).scrollIntoView
    }
    if (hadCssEscape && cssEscape) {
      CSS.escape = cssEscape
    } else {
      delete (CSS as { escape?: typeof CSS.escape }).escape
    }
    document.body.innerHTML = ''
  })

  it('scrolls to a requested heading, focuses the editor, and reports the request consumed', async () => {
    const onConsumed = vi.fn()
    const editorRoot = document.createElement('div')
    editorRoot.innerHTML = '<div data-id="details-heading"></div>'
    document.body.append(editorRoot)
    const editor = {
      _tiptapEditor: { view: { dom: editorRoot } },
      focus: vi.fn(),
      setTextCursorPosition: vi.fn(),
    }
    useNoteEditorStore.setState({
      editor: editor as unknown as ReturnType<typeof useNoteEditorStore.getState>['editor'],
      provider: null,
    })

    const { result } = renderHook(() =>
      useNoteHeadingScrollRequest({
        content: createContent(),
        heading: 'Intro#Details',
        onConsumed,
      }),
    )

    expect(result.current).toEqual({ status: 'requested' })

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start' })
    })
    expect(onConsumed).toHaveBeenCalledOnce()
    expect(editor.focus).toHaveBeenCalled()
    expect(editor.setTextCursorPosition).toHaveBeenCalledWith('details-heading', 'end')
  })

  it('scopes requested heading scroll to the active editor root', async () => {
    const outsideScrollIntoView = vi.fn()
    const activeScrollIntoView = vi.fn()
    const outsideBlock = document.createElement('div')
    outsideBlock.dataset.id = 'details-heading'
    outsideBlock.scrollIntoView = outsideScrollIntoView
    const editorRoot = document.createElement('div')
    const activeBlock = document.createElement('div')
    activeBlock.dataset.id = 'details-heading'
    activeBlock.scrollIntoView = activeScrollIntoView
    editorRoot.append(activeBlock)
    document.body.append(outsideBlock, editorRoot)
    const editor = {
      _tiptapEditor: { view: { dom: editorRoot } },
      focus: vi.fn(),
      setTextCursorPosition: vi.fn(),
    }
    useNoteEditorStore.setState({
      editor: editor as unknown as ReturnType<typeof useNoteEditorStore.getState>['editor'],
      provider: null,
    })

    renderHook(() =>
      useNoteHeadingScrollRequest({
        content: createContent(),
        heading: 'Intro#Details',
      }),
    )

    await waitFor(() => {
      expect(activeScrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    })
    expect(outsideScrollIntoView).not.toHaveBeenCalled()
  })

  it('consumes requests whose heading path no longer exists', () => {
    const onConsumed = vi.fn()

    const { result } = renderHook(() =>
      useNoteHeadingScrollRequest({
        content: createContent(),
        heading: 'Renamed heading',
        onConsumed,
      }),
    )

    expect(result.current).toEqual({ status: 'requested' })
    expect(onConsumed).toHaveBeenCalledOnce()
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })
})

function createContent(): Array<NoteBlock> {
  return [heading('intro-heading', 'Intro', 1), heading('details-heading', 'Details', 2)]
}

function heading(id: string, text: string, level: 1 | 2): NoteBlock {
  return {
    id,
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  } as unknown as NoteBlock
}
