import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CanvasFloatingFormattingToolbar } from '../canvas-floating-formatting-toolbar'
import { getNextBlockTypeMenuState } from '../canvas-floating-formatting-toolbar-state'

type TestBlock = {
  content?: Array<unknown>
  id: string
  props: Record<string, unknown>
  type: string
}

describe('CanvasFloatingFormattingToolbar', () => {
  it('reflects the current inline style and alignment state', () => {
    const editor = createEditor({
      activeStyles: { bold: true },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'center' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Align center' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Paragraph')).toBeInTheDocument()

    act(() => {
      editor.setSelection([createHeadingBlock('heading-1', 2, 'left')])
      editor.setActiveStyles({})
    })

    expect(screen.getByText('Heading 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Align left' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('toggles inline styles and applies alignment changes to selected blocks', () => {
    const paragraph = createParagraphBlock('paragraph-1', { textAlignment: 'left' })
    const heading = createHeadingBlock('heading-1', 1, 'left')
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [paragraph, heading],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Align right' }))

    expect(editor.focus).toHaveBeenCalledTimes(2)
    expect(editor.toggleStyles).toHaveBeenCalledWith({ bold: true })
    expect(editor.transact).toHaveBeenCalledTimes(1)
    expect(editor.updateBlock).toHaveBeenNthCalledWith(1, paragraph, {
      props: { textAlignment: 'right' },
    })
    expect(editor.updateBlock).toHaveBeenNthCalledWith(2, heading, {
      props: { textAlignment: 'right' },
    })
  })

  it('updates every selected block when a block type is chosen', () => {
    const firstParagraph = createParagraphBlock('paragraph-1', { textAlignment: 'left' })
    const secondParagraph = createParagraphBlock('paragraph-2', { textAlignment: 'left' })
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [firstParagraph, secondParagraph],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Block type' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Heading 2' }))

    expect(editor.focus).toHaveBeenCalledTimes(1)
    expect(editor.transact).toHaveBeenCalledTimes(1)
    expect(editor.updateBlock).toHaveBeenNthCalledWith(1, firstParagraph, {
      type: 'heading',
      props: { level: 2, isToggleable: false },
    })
    expect(editor.updateBlock).toHaveBeenNthCalledWith(2, secondParagraph, {
      type: 'heading',
      props: { level: 2, isToggleable: false },
    })
  })

  it('opens and closes the block type dropdown when the trigger is pressed repeatedly', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    const trigger = screen.getByRole('button', { name: 'Block type' })

    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('ignores only the click-close from the same opening mouse gesture', () => {
    const openedState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: false,
      nextOpen: true,
      details: {
        reason: 'trigger-press',
        event: new MouseEvent('mousedown'),
      },
    })

    expect(openedState).toEqual({
      open: true,
      ignoreOpeningClickClose: true,
    })

    const releasedState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: openedState.ignoreOpeningClickClose,
      nextOpen: false,
      details: {
        reason: 'trigger-press',
        event: new MouseEvent('click'),
      },
    })

    expect(releasedState).toEqual({
      open: true,
      ignoreOpeningClickClose: false,
    })

    const intentionalCloseState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: releasedState.ignoreOpeningClickClose,
      nextOpen: false,
      details: {
        reason: 'trigger-press',
        event: new MouseEvent('mousedown'),
      },
    })

    expect(intentionalCloseState).toEqual({
      open: false,
      ignoreOpeningClickClose: false,
    })
  })

  it('prevents trigger mouse down from blurring the active editor selection', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    const trigger = screen.getByRole('button', { name: 'Block type' })
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

    trigger.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })
})

function createEditor({
  activeStyles,
  selectedBlocks,
}: {
  activeStyles: Record<string, boolean>
  selectedBlocks: Array<TestBlock>
}) {
  let currentActiveStyles = activeStyles
  let currentSelectedBlocks = selectedBlocks
  const selectionListeners = new Set<() => void>()
  const changeListeners = new Set<() => void>()

  const editor = {
    focus: vi.fn(),
    getActiveStyles: vi.fn(() => currentActiveStyles),
    getSelection: vi.fn(() => ({ blocks: currentSelectedBlocks })),
    getTextCursorPosition: vi.fn(() => ({
      block: currentSelectedBlocks[0],
      nextBlock: undefined,
      parentBlock: undefined,
      prevBlock: undefined,
    })),
    isEditable: true,
    onChange: vi.fn((callback: () => void) => {
      changeListeners.add(callback)
      return () => changeListeners.delete(callback)
    }),
    onSelectionChange: vi.fn((callback: () => void) => {
      selectionListeners.add(callback)
      return () => selectionListeners.delete(callback)
    }),
    schema: {
      blockSchema: {
        bulletListItem: {
          propSchema: {
            backgroundColor: {},
            textAlignment: {},
            textColor: {},
          },
        },
        checkListItem: {
          propSchema: {
            backgroundColor: {},
            checked: {},
            textAlignment: {},
            textColor: {},
          },
        },
        codeBlock: {
          propSchema: {
            language: {},
          },
        },
        heading: {
          propSchema: {
            backgroundColor: {},
            isToggleable: {},
            level: {},
            textAlignment: {},
            textColor: {},
          },
        },
        numberedListItem: {
          propSchema: {
            backgroundColor: {},
            start: {},
            textAlignment: {},
            textColor: {},
          },
        },
        paragraph: {
          propSchema: {
            backgroundColor: {},
            textAlignment: {},
            textColor: {},
          },
        },
        quote: {
          propSchema: {
            backgroundColor: {},
            textColor: {},
          },
        },
      },
      styleSchema: {
        bold: { propSchema: 'boolean', type: 'bold' },
        italic: { propSchema: 'boolean', type: 'italic' },
        strike: { propSchema: 'boolean', type: 'strike' },
        underline: { propSchema: 'boolean', type: 'underline' },
      },
    },
    setActiveStyles(nextActiveStyles: Record<string, boolean>) {
      currentActiveStyles = nextActiveStyles
      changeListeners.forEach((listener) => listener())
    },
    setSelection(nextSelectedBlocks: Array<TestBlock>) {
      currentSelectedBlocks = nextSelectedBlocks
      selectionListeners.forEach((listener) => listener())
    },
    toggleStyles: vi.fn(),
    transact: vi.fn((callback: () => void) => callback()),
    updateBlock: vi.fn(),
  }

  return editor
}

function createParagraphBlock(id: string, props: Record<string, unknown>): TestBlock {
  return {
    id,
    type: 'paragraph',
    props,
    content: [{ text: 'hello' }],
  }
}

function createHeadingBlock(id: string, level: number, textAlignment: string): TestBlock {
  return {
    id,
    type: 'heading',
    props: {
      level,
      isToggleable: false,
      textAlignment,
    },
    content: [{ text: 'heading' }],
  }
}
