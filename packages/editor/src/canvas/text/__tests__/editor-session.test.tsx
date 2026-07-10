import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasTextEditorSession } from '../editor-session'
import type { CanvasTextContent } from '../editor'

type TestCanvasTextEditor = {
  document: CanvasTextContent
  replaceBlocks: ReturnType<typeof vi.fn>
}

const blocknoteState = vi.hoisted(() => ({
  createEditor: vi.fn(),
  destroyEditor: vi.fn(),
  observeCanvasTextChanges: vi.fn(() => () => undefined),
}))

vi.mock('../blocknote-adapter', () => ({
  createCanvasTextBlockNoteEditor: blocknoteState.createEditor,
  observeCanvasTextChanges: blocknoteState.observeCanvasTextChanges,
}))

vi.mock('../../../rich-text/blocknote/activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: () => undefined,
}))

vi.mock('../../../rich-text/blocknote/destroy-blocknote-editor', () => ({
  destroyBlockNoteEditor: blocknoteState.destroyEditor,
}))

describe('useCanvasTextEditorSession', () => {
  beforeEach(() => {
    blocknoteState.createEditor.mockReset()
    blocknoteState.destroyEditor.mockReset()
    blocknoteState.observeCanvasTextChanges.mockReset()
    blocknoteState.observeCanvasTextChanges.mockReturnValue(() => undefined)
  })

  it('lets a newer external update replace a pending exit save', () => {
    const initialContent = createTextContent('server before edit')
    const exitContent = createTextContent('local edit on exit')
    const externalContent = createTextContent('server update after exit')
    const editor = createEditor(initialContent)
    const onPersistContent = vi.fn()
    blocknoteState.createEditor.mockReturnValue(editor)

    const hook = renderHook(
      ({ content, editable }: { content: CanvasTextContent; editable: boolean }) =>
        useCanvasTextEditorSession({
          ariaLabel: 'Edit text node',
          content,
          editable,
          pendingActivationRef: { current: null },
          onActivated: vi.fn(),
          onPersistContent,
        }),
      { initialProps: { content: initialContent, editable: true } },
    )

    expect(hook.result.current.editor).toBe(editor)

    editor.document = exitContent

    act(() => {
      hook.rerender({ content: initialContent, editable: false })
    })

    expect(onPersistContent).toHaveBeenCalledWith(exitContent)
    expect(editor.replaceBlocks).not.toHaveBeenCalled()

    act(() => {
      hook.rerender({ content: externalContent, editable: false })
    })

    expect(editor.replaceBlocks).toHaveBeenCalledWith(exitContent, externalContent)
  })
})

function createTextContent(text: string): CanvasTextContent {
  return [{ type: 'paragraph', content: [{ type: 'text', text }] }] as unknown as CanvasTextContent
}

function createEditor(content: CanvasTextContent): TestCanvasTextEditor {
  return {
    document: content,
    replaceBlocks: vi.fn(),
  } as unknown as TestCanvasTextEditor
}
