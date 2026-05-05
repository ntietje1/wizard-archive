import { act, fireEvent, render, screen } from '@testing-library/react'
import { Schema } from '@tiptap/pm/model'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { applyCanvasToolbarTextAlignment } from '../canvas-floating-formatting-toolbar-commands'
import { CanvasFloatingFormattingToolbar } from '../canvas-floating-formatting-toolbar'
import {
  EMPTY_TOOLBAR_SNAPSHOT,
  toolbarSnapshotsEqual,
} from '../canvas-floating-formatting-toolbar-model'
import { getNextBlockTypeMenuState } from '../canvas-floating-formatting-toolbar-state'
import { CANVAS_SELECTION_OVERLAY_Z_INDEX } from '../../../components/canvas-screen-space-overlay-utils'

type TestBlock = {
  children?: Array<TestBlock>
  content?: Array<unknown>
  id: string
  props: Record<string, unknown>
  type: string
}

describe('CanvasFloatingFormattingToolbar', () => {
  it('compares formatting toolbar snapshots by rendered state', () => {
    const snapshot = {
      ...EMPTY_TOOLBAR_SNAPSHOT,
      activeStyles: { bold: true },
    }

    expect(toolbarSnapshotsEqual(snapshot, { ...snapshot, activeStyles: { bold: true } })).toBe(
      true,
    )
    expect(toolbarSnapshotsEqual(snapshot, { ...snapshot, activeStyles: { italic: true } })).toBe(
      false,
    )
  })

  it('applies alignment through the extracted command helper', () => {
    const paragraph = createParagraphBlock('paragraph-1', { textAlignment: 'left' })
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [paragraph],
    })

    applyCanvasToolbarTextAlignment({
      alignment: 'right',
      editor: editor as never,
      selectionSnapshot: null,
    })

    expect(editor.updateBlock).toHaveBeenCalledWith(paragraph, {
      props: { textAlignment: 'right' },
    })
  })

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

  it('opens dropdown controls from a real pointer click sequence', async () => {
    const user = userEvent.setup()
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    await user.click(screen.getByRole('button', { name: 'Block type' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Heading 2' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Text color' }))
    expect(
      await screen.findByRole('menuitemradio', { name: 'Select Red text color' }),
    ).toBeInTheDocument()
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

    const pointerOpenedState = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: false,
      nextOpen: true,
      details: {
        reason: 'trigger-press',
        event: new MouseEvent('pointerdown'),
      },
    })

    expect(pointerOpenedState).toEqual({
      open: true,
      ignoreOpeningClickClose: true,
    })
  })

  it('does not cancel dropdown trigger pointer events', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    const blockTypeTrigger = screen.getByRole('button', { name: 'Block type' })
    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    const blockTypeEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    const textColorEvent = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })

    act(() => {
      blockTypeTrigger.dispatchEvent(blockTypeEvent)
      textColorTrigger.dispatchEvent(textColorEvent)
    })

    expect(blockTypeEvent.defaultPrevented).toBe(false)
    expect(textColorEvent.defaultPrevented).toBe(false)
  })

  it('prevents text color swatch pointer down from blurring the active editor selection', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    const redButton = screen.getByRole('menuitemradio', { name: 'Select Red text color' })
    const event = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })

    redButton.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('renders above the canvas selection overlay layer', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    render(
      <>
        <div
          data-testid="canvas-selection-resize-wrapper"
          style={{ zIndex: CANVAS_SELECTION_OVERLAY_Z_INDEX }}
        />
        <CanvasFloatingFormattingToolbar editor={editor as never} visible />
      </>,
    )

    const toolbar = screen.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    const overlay = screen.getByTestId('canvas-selection-resize-wrapper')

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    const palette = screen
      .getByRole('menuitemradio', { name: 'Select Red text color' })
      .closest('[data-slot="dropdown-menu-content"]')

    expect(readZIndex(palette, 'text color palette')).toBeGreaterThan(
      readZIndex(toolbar.parentElement, 'toolbar wrapper'),
    )
    expect(readZIndex(toolbar.parentElement, 'toolbar wrapper')).toBeGreaterThan(
      readZIndex(overlay, 'selection overlay'),
    )
  })

  it('applies preset text color to selected rich text', () => {
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-blue)' },
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
        }),
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('menuitemradio', { name: 'Select Red text color' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    expect(screen.getByRole('menuitemradio', { name: 'Select Blue text color' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    expect(editor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
    expect(editor.replaceBlocks).not.toHaveBeenCalled()
    expect(editor.removeStyles).not.toHaveBeenCalled()
  })

  it('restores the editor cursor after applying a selected text color', () => {
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-blue)' },
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
        }),
      ],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    const addStylesOrder = editor.addStyles.mock.invocationCallOrder[0]
    const lastFocusOrder = editor.focus.mock.invocationCallOrder.at(-1)

    expect(addStylesOrder).toBeDefined()
    expect(lastFocusOrder).toBeDefined()
    expect(lastFocusOrder).toBeGreaterThan(addStylesOrder!)
  })

  it('restores the editor cursor again after the text color menu closes', () => {
    const animationFrames: Array<FrameRequestCallback> = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        animationFrames.push(callback)
        return animationFrames.length
      })
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-blue)' },
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
        }),
      ],
    })

    try {
      render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

      fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

      const addStylesOrder = editor.addStyles.mock.invocationCallOrder[0]
      expect(addStylesOrder).toBeDefined()
      expect(requestAnimationFrameSpy).toHaveBeenCalled()
      const focusCountAfterColorChange = editor.focus.mock.calls.length

      act(() => {
        animationFrames.forEach((callback) => callback(performance.now()))
      })

      expect(editor.focus).toHaveBeenCalledTimes(focusCountAfterColorChange + 1)
      expect(editor.focus.mock.invocationCallOrder.at(-1)).toBeGreaterThan(addStylesOrder!)
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })

  it('does not return focus to the text color trigger after selecting a swatch', async () => {
    const user = userEvent.setup()
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-blue)' },
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
        }),
      ],
    })

    render(<CanvasFloatingFormattingToolbar editor={editor as never} visible />)

    const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
    await user.click(textColorTrigger)
    await user.click(await screen.findByRole('menuitemradio', { name: 'Select Red text color' }))

    expect(editor.focus).toHaveBeenCalled()
    expect(textColorTrigger).not.toHaveFocus()
  })

  it('reflects a custom selected text color in the trigger icon', () => {
    const editor = createEditor({
      activeStyles: { textColor: '#123456' },
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [{ type: 'text', text: 'custom', styles: { textColor: '#123456' } }],
        }),
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Text color' }).querySelector('.bn-color-icon'))
      .toHaveStyle(`
        color: #123456;
      `)
  })

  it('updates the node default text color when no rich text range is selected', () => {
    const onDefaultTextColorChange = vi.fn()
    const paragraph = createParagraphBlock('paragraph-1', {
      textAlignment: 'left',
      content: [
        { type: 'text', text: 'existing default' },
        { type: 'text', text: 'existing red', styles: { textColor: 'var(--t-red)' } },
      ],
    })
    const editor = createEditor({
      activeStyles: {},
      hasTextSelection: false,
      selectedBlocks: [paragraph],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--t-blue)"
        onDefaultTextColorChange={onDefaultTextColorChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    expect(screen.getByRole('menuitemradio', { name: 'Select Blue text color' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

    expect(onDefaultTextColorChange).toHaveBeenCalledWith('var(--t-red)')
    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [paragraph],
      [
        {
          ...paragraph,
          content: [
            {
              type: 'text',
              text: 'existing default',
              styles: { textColor: 'var(--t-blue)' },
            },
            { type: 'text', text: 'existing red', styles: { textColor: 'var(--t-red)' } },
          ],
        },
      ],
    )
    expect(editor.addStyles).toHaveBeenCalledWith({ textColor: 'var(--t-red)' })
  })

  it('keeps the pending text color mark after changing color with a collapsed cursor', () => {
    const animationFrames: Array<FrameRequestCallback> = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        animationFrames.push(callback)
        return animationFrames.length
      })
    const paragraph = createParagraphBlock('paragraph-1', {
      textAlignment: 'left',
      content: [
        { type: 'text', text: 'existing default' },
        { type: 'text', text: 'existing blue', styles: { textColor: 'var(--t-blue)' } },
      ],
    })
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-blue)' },
      hasTextSelection: false,
      selectionSnapshot: { anchor: 2, head: 2, type: 'text' },
      selectedBlocks: [paragraph],
    })

    try {
      render(
        <CanvasFloatingFormattingToolbar
          editor={editor as never}
          visible
          defaultTextColor="var(--foreground)"
          onDefaultTextColorChange={vi.fn()}
        />,
      )

      const textColorTrigger = screen.getByRole('button', { name: 'Text color' })
      fireEvent.pointerDown(textColorTrigger)
      fireEvent.click(textColorTrigger)
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Select Red text color' }))

      const addStylesOrder = editor.addStyles.mock.invocationCallOrder[0]
      expect(addStylesOrder).toBeDefined()

      act(() => {
        animationFrames.forEach((callback) => callback(performance.now()))
      })

      const selectionDispatchAfterPendingMark =
        editor._tiptapEditor.view.dispatch.mock.invocationCallOrder.some(
          (dispatchOrder) => dispatchOrder > addStylesOrder!,
        )
      expect(selectionDispatchAfterPendingMark).toBe(false)
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })

  it('shows mixed text color state when selected rich text contains multiple colors', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [
        createParagraphBlock('paragraph-1', {
          textAlignment: 'left',
          content: [
            { type: 'text', text: 'red', styles: { textColor: 'var(--t-red)' } },
            { type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } },
          ],
        }),
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color (mixed values)' }))

    expect(screen.getByRole('menuitemradio', { name: 'Select Blue text color' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Select Red text color' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('shows mixed text color state when nested selected rich text contains multiple colors', () => {
    const editor = createEditor({
      activeStyles: {},
      selectedBlocks: [
        {
          ...createParagraphBlock('paragraph-1', {
            textAlignment: 'left',
            content: [{ type: 'text', text: 'red', styles: { textColor: 'var(--t-red)' } }],
          }),
          children: [
            createParagraphBlock('paragraph-child-1', {
              textAlignment: 'left',
              content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
            }),
          ],
        },
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color (mixed values)' }))

    expect(screen.getByRole('menuitemradio', { name: 'Select Blue text color' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Select Red text color' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('uses nested selected rich-text colors when the parent block has no text', () => {
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-red)' },
      selectedBlocks: [
        {
          ...createParagraphBlock('paragraph-1', {
            textAlignment: 'left',
            content: [],
          }),
          children: [
            createParagraphBlock('paragraph-child-1', {
              textAlignment: 'left',
              content: [{ type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } }],
            }),
          ],
        },
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    expect(screen.getByRole('menuitemradio', { name: 'Select Blue text color' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('uses the sliced text selection colors instead of the full selected block colors', () => {
    const selectedBlock = createParagraphBlock('paragraph-1', {
      textAlignment: 'left',
      content: [
        { type: 'text', text: 'red', styles: { textColor: 'var(--t-red)' } },
        { type: 'text', text: 'blue', styles: { textColor: 'var(--t-blue)' } },
      ],
    })
    const editor = createEditor({
      activeStyles: { textColor: 'var(--t-red)' },
      selectedBlocks: [selectedBlock],
      selectedCutBlocks: [
        {
          ...selectedBlock,
          content: [{ type: 'text', text: 'red', styles: { textColor: 'var(--t-red)' } }],
        },
      ],
    })

    render(
      <CanvasFloatingFormattingToolbar
        editor={editor as never}
        visible
        defaultTextColor="var(--foreground)"
        onDefaultTextColorChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))

    expect(screen.getByRole('menuitemradio', { name: 'Select Red text color' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})

function readZIndex(element: Element | null, label = 'element'): number {
  expect(element, `${label} should exist before reading z-index`).not.toBeNull()

  const zIndex = window.getComputedStyle(element!).zIndex
  expect(zIndex, `${label} should have a numeric z-index, received "${zIndex}"`).toMatch(/^-?\d+$/)
  return Number.parseInt(zIndex, 10)
}

const proseMirrorTestSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'text*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
})

function createProseMirrorTestDoc() {
  return proseMirrorTestSchema.node('doc', null, [
    proseMirrorTestSchema.node('paragraph', null, [proseMirrorTestSchema.text('hello')]),
  ])
}

function createEditor({
  activeStyles,
  hasTextSelection = true,
  selectionSnapshot = null,
  selectedCutBlocks,
  selectedBlocks,
}: {
  activeStyles: Record<string, unknown>
  hasTextSelection?: boolean
  selectionSnapshot?: Record<string, unknown> | null
  selectedCutBlocks?: Array<TestBlock>
  selectedBlocks: Array<TestBlock>
}) {
  let currentActiveStyles = activeStyles
  let currentSelectedBlocks = selectedBlocks
  let currentSelectedCutBlocks = selectedCutBlocks ?? selectedBlocks
  const selectionListeners = new Set<() => void>()
  const changeListeners = new Set<() => void>()
  const focus = vi.fn()

  const editor = {
    _tiptapEditor: {
      view: {
        dispatch: vi.fn(),
        focus,
        state: {
          doc: createProseMirrorTestDoc(),
          selection: {
            toJSON: vi.fn(() => selectionSnapshot),
          },
          tr: {
            setSelection: vi.fn((selection: unknown) => selection),
          },
        },
      },
    },
    focus,
    document: currentSelectedBlocks,
    getActiveStyles: vi.fn(() => currentActiveStyles),
    getSelection: vi.fn(() => (hasTextSelection ? { blocks: currentSelectedBlocks } : undefined)),
    getSelectionCutBlocks: vi.fn(() => ({
      _meta: { endPos: 0, startPos: 0 },
      blockCutAtEnd: undefined,
      blockCutAtStart: undefined,
      blocks: currentSelectedCutBlocks,
    })),
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
        backgroundColor: { propSchema: 'string', type: 'backgroundColor' },
        bold: { propSchema: 'boolean', type: 'bold' },
        italic: { propSchema: 'boolean', type: 'italic' },
        strike: { propSchema: 'boolean', type: 'strike' },
        textColor: { propSchema: 'string', type: 'textColor' },
        underline: { propSchema: 'boolean', type: 'underline' },
      },
    },
    addStyles: vi.fn(),
    removeStyles: vi.fn(),
    replaceBlocks: vi.fn(),
    setActiveStyles(nextActiveStyles: Record<string, unknown>) {
      currentActiveStyles = nextActiveStyles
      changeListeners.forEach((listener) => listener())
    },
    setSelection(nextSelectedBlocks: Array<TestBlock>) {
      currentSelectedBlocks = nextSelectedBlocks
      currentSelectedCutBlocks = nextSelectedBlocks
      selectionListeners.forEach((listener) => listener())
    },
    toggleStyles: vi.fn(),
    transact: vi.fn((callback: () => void) => callback()),
    updateBlock: vi.fn(),
  }

  return editor
}

function createParagraphBlock(
  id: string,
  props: Record<string, unknown> & { content?: Array<unknown> },
): TestBlock {
  const { content, ...blockProps } = props
  return {
    id,
    type: 'paragraph',
    props: blockProps,
    content: content ?? [{ text: 'hello' }],
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
