import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { RichTextFormattingToolbar } from '../formatting-toolbar'
import {
  createFormattingToolbarTestEditor as createEditor,
  createParagraphBlock,
} from './formatting-toolbar-test-utils'
import { DEFAULT_RICH_TEXT_COLOR_VALUE } from '../../blocknote/rich-text-selection-colors'

describe('RichTextFormattingToolbar', () => {
  it('renders the full note toolbar controls with app UI', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    expect(screen.getByRole('toolbar', { name: 'Test formatting toolbar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block type' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Text color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Highlight color' })).toBeInTheDocument()
  })

  it('keeps the canvas toolbar aligned with the shared core formatting controls', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="compact"
        visible
      />,
    )

    expect(screen.getByRole('toolbar', { name: 'Test formatting toolbar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Text color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Highlight color' })).toBeInTheDocument()
  })

  it('adds and removes inline styles for future text at a collapsed cursor', () => {
    const selectionSnapshot = { anchor: 2, head: 2, type: 'text' }
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot,
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    const { rerender } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))

    expect(editor.addStyles).toHaveBeenCalledWith({ bold: true })
    expect(editor.toggleStyles).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')

    editor.setActiveStyles({ bold: true })
    rerender(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))

    expect(editor.removeStyles).toHaveBeenCalledWith({ bold: true })
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('continues toggling inline styles across a text selection', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Italic' }))

    expect(editor.toggleStyles).toHaveBeenCalledWith({ italic: true })
    expect(editor.addStyles).not.toHaveBeenCalled()
  })

  it('uses ten-option text and highlight palettes without invisible text colors', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    expect(screen.getAllByRole('button', { name: /^Select .* text color$/ })).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Select Default text color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select Grey text color' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))

    expect(
      screen.getAllByRole('button', { name: /^Select (No highlight|.* highlight color)$/ }),
    ).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Select No highlight' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select Grey highlight color' })).toBeInTheDocument()
  })

  it('applies and clears full toolbar background color commands', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red highlight color' }))
    expect(screen.getByRole('button', { name: 'Select No highlight' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Select No highlight' }))

    expect(editor.addStyles).toHaveBeenCalledWith({ backgroundColor: 'var(--bg-red)' })
    expect(editor.removeStyles).toHaveBeenCalledWith({ backgroundColor: 'default' })
  })

  it('uses the BlockNote default style value when clearing active background color', () => {
    const editor = createEditor({
      activeStyles: { backgroundColor: 'var(--bg-red)' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select No highlight' }))

    expect(editor.removeStyles).toHaveBeenCalledWith({ backgroundColor: 'default' })
  })

  it('disables collapsed cursor text color when the schema does not support text color', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    delete (editor.schema.styleSchema as Record<string, unknown>).textColor

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        onApplyCollapsedTextColor={vi.fn()}
        visible
      />,
    )

    expect(screen.getByRole('button', { name: 'Text color' })).toBeDisabled()
  })

  it('applies collapsed cursor text color through the pending caret path', () => {
    const selectionSnapshot = { anchor: 2, head: 2, type: 'text' }
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot,
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const onApplyCollapsedTextColor = vi.fn()
    const onDefaultTextColorChange = vi.fn()
    let deferredFocus: FrameRequestCallback | null = null
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        deferredFocus = callback
        return 1
      })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        onApplyCollapsedTextColor={onApplyCollapsedTextColor}
        onDefaultTextColorChange={onDefaultTextColorChange}
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    expect(onApplyCollapsedTextColor).toHaveBeenCalledExactlyOnceWith(
      editor,
      'var(--t-red)',
      selectionSnapshot,
    )
    expect(onDefaultTextColorChange).toHaveBeenCalledExactlyOnceWith('var(--t-red)')
    expect(editor.addStyles).not.toHaveBeenCalled()
    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()
    expect(
      editor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('var(--t-red)')
    expect(requestAnimationFrameSpy).toHaveBeenCalled()
    act(() => {
      deferredFocus?.(0)
    })
    expect(editor.focus).toHaveBeenCalled()
    requestAnimationFrameSpy.mockRestore()
  })

  it('cancels deferred collapsed cursor focus when the toolbar unmounts', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 7)
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(vi.fn())

    const { unmount } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        onApplyCollapsedTextColor={vi.fn()}
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))
    unmount()

    expect(requestAnimationFrameSpy).toHaveBeenCalled()
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(7)
    expect(editor.focus).not.toHaveBeenCalled()
    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  it('cancels deferred selected text color focus when the toolbar unmounts', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 8)
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(vi.fn())

    const { unmount } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))
    unmount()

    expect(editor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
    expect(requestAnimationFrameSpy).toHaveBeenCalled()
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(8)
    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  it('cancels deferred collapsed cursor focus when the editor changes', () => {
    const firstEditor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const secondEditor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 4, head: 4, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-2', { textAlignment: 'left' })],
    })
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 9)
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(vi.fn())

    const { rerender } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={firstEditor as never}
        mode="full"
        onApplyCollapsedTextColor={vi.fn()}
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    rerender(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={secondEditor as never}
        mode="full"
        onApplyCollapsedTextColor={vi.fn()}
        visible
      />,
    )

    expect(requestAnimationFrameSpy).toHaveBeenCalled()
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(9)
    expect(firstEditor.focus).not.toHaveBeenCalled()
    requestAnimationFrameSpy.mockRestore()
    cancelAnimationFrameSpy.mockRestore()
  })

  it('updates color trigger previews immediately for collapsed cursor style changes', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    const highlightTrigger = screen.getByRole('button', { name: 'Highlight color' })
    fireEvent.click(highlightTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red highlight color' }))

    expect(highlightTrigger.querySelector('svg')).toHaveStyle({ color: 'var(--t-red)' })
  })

  it('uses the latest editor cursor when applying swatches from an already-open palette', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    editor.setSelectionSnapshot({ anchor: 5, head: 5, type: 'text' })
    fireEvent.click(screen.getByRole('button', { name: 'Select Blue text color' }))

    expect(editor._tiptapEditor.view.state.tr.setSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({ anchor: 5, head: 5 }),
    )
    expect(editor._tiptapEditor.view.dispatch).toHaveBeenLastCalledWith(
      editor._tiptapEditor.view.state.tr,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    editor.setSelectionSnapshot({ anchor: 6, head: 6, type: 'text' })
    fireEvent.click(screen.getByRole('button', { name: 'Select Red highlight color' }))

    expect(editor._tiptapEditor.view.state.tr.setSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({ anchor: 6, head: 6 }),
    )
    expect(editor._tiptapEditor.view.dispatch).toHaveBeenLastCalledWith(
      editor._tiptapEditor.view.state.tr,
    )
    expect(editor.focus).toHaveBeenCalled()
  })

  it('reflects active text color styles at a collapsed cursor', () => {
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-red)' },
      hasTextSelection: false,
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    fireEvent.click(textColorTrigger)
    expect(screen.getByRole('button', { name: 'Select Red text color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps pending color previews across collapsed cursor selection changes', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 2, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    const highlightTrigger = screen.getByRole('button', { name: 'Highlight color' })
    fireEvent.click(highlightTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Blue highlight color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 2, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(highlightTrigger.querySelector('svg')).toHaveStyle({ color: 'var(--t-blue)' })
  })

  it('clears the pending caret color when the collapsed cursor moves', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 3, head: 3, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(
      editor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('')
  })

  it('uses the pending text color for the editor caret', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    expect(
      editor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('var(--t-red)')

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 5, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(
      editor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('')
  })

  it('starts a new editor with its own pending color state', () => {
    const firstEditor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const secondEditor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 4, head: 4, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-2', { textAlignment: 'left' })],
    })

    const { rerender } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={firstEditor as never}
        mode="full"
        visible
      />,
    )

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))
    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    rerender(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={secondEditor as never}
        mode="full"
        visible
      />,
    )

    expect(
      firstEditor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('')
    expect(
      screen
        .getByRole('button', { name: 'Text color' })
        .querySelector(`[data-text-color="${DEFAULT_RICH_TEXT_COLOR_VALUE.color}"]`),
    ).toBeInTheDocument()
  })

  it('keeps toolbar subscriptions stable across same-editor rerenders', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    const { rerender } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    rerender(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    expect(editor.onSelectionChange).toHaveBeenCalledTimes(1)
    expect(editor.onChange).toHaveBeenCalledTimes(1)
  })

  it('does not carry a stored selection snapshot across editor swaps', () => {
    const firstEditor = createEditor({
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const secondEditor = createEditor({
      selectionSnapshot: null,
      selectedBlocks: [createParagraphBlock('paragraph-2', { textAlignment: 'left' })],
    })

    const { rerender } = render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={firstEditor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.pointerDown(screen.getByRole('toolbar', { name: 'Test formatting toolbar' }))
    rerender(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={secondEditor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select Red text color' }))

    expect(secondEditor._tiptapEditor.view.state.tr.setSelection).not.toHaveBeenCalled()
    expect(secondEditor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
  })

  it('keeps palette surface clicks from blurring the editor', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    const palette = screen
      .getByRole('button', { name: 'Select Red text color' })
      .closest('[data-formatting-color-palette]')
    expect(palette).toBeInstanceOf(HTMLElement)

    const pointerEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const mouseEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

    if (!(palette instanceof HTMLElement)) return

    palette.dispatchEvent(pointerEvent)
    palette.dispatchEvent(mouseEvent)

    expect(pointerEvent.defaultPrevented).toBe(true)
    expect(mouseEvent.defaultPrevented).toBe(true)
  })

  it('keeps dropdown trigger mouse down from blurring the editor', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <RichTextFormattingToolbar
        ariaLabel="Test formatting toolbar"
        editor={editor as never}
        mode="full"
        visible
      />,
    )

    for (const label of ['Block type', 'Text color', 'Highlight color']) {
      const trigger = screen.getByRole('button', { name: label })
      const mouseEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

      act(() => {
        trigger.dispatchEvent(mouseEvent)
      })

      expect(mouseEvent.defaultPrevented).toBe(true)
    }
  })

  it('keeps test editor document state aligned with selection changes', () => {
    const firstBlock = createParagraphBlock('paragraph-1', { textAlignment: 'left' })
    const nextBlock = createParagraphBlock('paragraph-2', { textAlignment: 'center' })
    const editor = createEditor({
      selectedBlocks: [firstBlock],
    })

    act(() => {
      editor.setSelection([nextBlock])
    })

    expect(editor.document).toEqual([nextBlock])
  })

  it('models ProseMirror transaction selection chaining', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })
    const transaction = editor._tiptapEditor.view.state.tr

    expect(transaction.setSelection({ anchor: 1, head: 1 })).toBe(transaction)
  })

  it('keeps editor focus while color palettes are open', async () => {
    const user = userEvent.setup()
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <>
        <div data-testid="editor-surface" />
        <RichTextFormattingToolbar
          ariaLabel="Test formatting toolbar"
          editor={editor as never}
          mode="full"
          visible
        />
      </>,
    )

    const editorSurface = editor._tiptapEditor.view.dom
    editorSurface.tabIndex = -1
    screen.getByTestId('editor-surface').appendChild(editorSurface)
    editorSurface.focus()

    await user.click(screen.getByRole('button', { name: 'Text color' }))
    expect(await screen.findByRole('button', { name: 'Select Red text color' })).toBeInTheDocument()
    expect(editorSurface).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Highlight color' }))
    expect(
      await screen.findByRole('button', { name: 'Select Red highlight color' }),
    ).toBeInTheDocument()
    expect(editorSurface).toHaveFocus()
  })
})
