import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { EditorFormattingToolbar } from '../formatting-toolbar'
import {
  createFileBlock,
  createFormattingToolbarTestEditor as createEditor,
  createParagraphBlock,
} from './formatting-toolbar-test-utils'

describe('EditorFormattingToolbar', () => {
  it('renders the full note toolbar controls with app UI', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    expect(screen.getByRole('toolbar', { name: 'Note formatting toolbar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Text color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Highlight color' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nest block' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unnest block' })).not.toBeInTheDocument()
  })

  it('keeps the canvas toolbar aligned with the shared core formatting controls', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="compact" visible />)

    expect(screen.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Block type' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Text color' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Highlight color' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nest block' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unnest block' })).not.toBeInTheDocument()
  })

  it('uses ten-option text and highlight palettes without invisible text colors', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(10)
    expect(
      screen.getByRole('menuitemradio', { name: 'Select Default text color' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: 'Select Grey text color' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitemradio', { name: 'Select Primary text color' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(10)
    expect(screen.getByRole('menuitemradio', { name: 'Select No highlight' })).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: 'Select Grey highlight color' }),
    ).toBeInTheDocument()
  })

  it('applies and clears full toolbar background color commands', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red highlight color' }))
    expect(screen.getByRole('menuitemradio', { name: 'Select No highlight' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select No highlight' }))

    expect(editor.addStyles).toHaveBeenCalledWith({ backgroundColor: 'var(--bg-red)' })
    expect(editor.removeStyles).toHaveBeenCalledWith({ backgroundColor: undefined })
  })

  it('updates color trigger previews immediately for collapsed cursor style changes', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    const highlightTrigger = screen.getByRole('button', { name: 'Highlight color' })
    fireEvent.click(highlightTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red highlight color' }))

    expect(highlightTrigger.querySelector('svg')).toHaveStyle({ color: 'var(--t-red)' })
  })

  it('uses the latest editor cursor when applying swatches from an already-open palette', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    editor.setSelectionSnapshot({ anchor: 5, head: 5, type: 'text' })
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Blue text color' }))

    expect(editor._tiptapEditor.view.dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ anchor: 5, head: 5 }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Highlight color' }))
    editor.setSelectionSnapshot({ anchor: 6, head: 6, type: 'text' })
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red highlight color' }))

    expect(editor._tiptapEditor.view.dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ anchor: 6, head: 6 }),
    )
    expect(editor.focus).toHaveBeenCalled()
  })

  it('reflects active text color styles at a collapsed cursor', () => {
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-red)' },
      hasTextSelection: false,
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    fireEvent.click(textColorTrigger)
    expect(screen.getByRole('menuitemradio', { name: 'Select Red text color' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('keeps pending color previews across collapsed cursor selection changes', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 2, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(textColorTrigger.querySelector('[data-text-color="var(--t-red)"]')).toBeInTheDocument()

    const highlightTrigger = screen.getByRole('button', { name: 'Highlight color' })
    fireEvent.click(highlightTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Blue highlight color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 2, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(highlightTrigger.querySelector('svg')).toHaveStyle({ color: 'var(--t-blue)' })
  })

  it('clears pending color previews when a range selection starts', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 2, head: 5, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(
      textColorTrigger.querySelector('[data-text-color="var(--t-red)"]'),
    ).not.toBeInTheDocument()
  })

  it('clears pending color previews when the collapsed cursor moves', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 3, head: 3, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(
      textColorTrigger.querySelector('[data-text-color="var(--t-red)"]'),
    ).not.toBeInTheDocument()
    expect(
      editor._tiptapEditor.view.dom.style.getPropertyValue('--formatting-pending-text-color'),
    ).toBe('')
  })

  it('clears pending color previews from a range selection when the cursor changes', () => {
    const editor = createEditor({
      hasTextSelection: true,
      selectionSnapshot: { anchor: 2, head: 5, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    fireEvent.click(textColorTrigger)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    act(() => {
      editor.setSelectionSnapshot({ anchor: 5, head: 5, type: 'text' })
      editor.emitSelectionChange()
    })

    expect(
      textColorTrigger.querySelector('[data-text-color="var(--t-red)"]'),
    ).not.toBeInTheDocument()
  })

  it('uses the pending text color for the editor caret', () => {
    const editor = createEditor({
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

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

  it('keeps palette surface clicks from blurring the editor', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    const palette = screen
      .getByRole('menuitemradio', { name: 'Select Red text color' })
      .closest('[data-formatting-color-palette]')
    expect(palette).not.toBeNull()

    const pointerEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const mouseEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

    palette!.dispatchEvent(pointerEvent)
    palette!.dispatchEvent(mouseEvent)

    expect(pointerEvent.defaultPrevented).toBe(true)
    expect(mouseEvent.defaultPrevented).toBe(true)
  })

  it('keeps dropdown trigger mouse down from blurring the editor', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    for (const label of ['Block type', 'Text color', 'Highlight color']) {
      const trigger = screen.getByRole('button', { name: label })
      const pointerEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
      const mouseEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

      trigger.dispatchEvent(pointerEvent)
      trigger.dispatchEvent(mouseEvent)

      expect(pointerEvent.defaultPrevented).toBe(false)
      expect(mouseEvent.defaultPrevented).toBe(true)
    }
  })

  it('keeps editor focus while color palettes are open', async () => {
    const user = userEvent.setup()
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <>
        <div aria-label="Editor surface" contentEditable suppressContentEditableWarning>
          hello
        </div>
        <EditorFormattingToolbar editor={editor as never} mode="full" visible />
      </>,
    )

    const editorSurface = screen.getByLabelText('Editor surface')
    editorSurface.focus()

    await user.click(screen.getByRole('button', { name: 'Text color' }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'Select Red text color' }),
    ).toBeInTheDocument()
    expect(editorSurface).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Highlight color' }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'Select Red highlight color' }),
    ).toBeInTheDocument()
    expect(editorSurface).toHaveFocus()
  })

  it('shows file-specific controls for a selected file block', () => {
    const fileBlock = createFileBlock('file-1')
    const editor = createEditor({ selectedBlocks: [fileBlock] })

    render(<EditorFormattingToolbar editor={editor as never} mode="full" visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit file caption' }))
    fireEvent.change(screen.getByLabelText('File caption'), {
      target: { value: 'Updated caption' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Edit file caption form' }))

    expect(editor.updateBlock).toHaveBeenCalledWith(fileBlock.id, {
      props: { caption: 'Updated caption' },
    })
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument()
  })
})
