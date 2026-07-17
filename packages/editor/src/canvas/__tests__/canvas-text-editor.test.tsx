import { BlockNoteEditor } from '@blocknote/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { generateUuidV7 } from '../../resources/domain-id'
import { CanvasTextEditor } from '../canvas-text-editor'

const content = [
  {
    id: generateUuidV7(),
    type: 'heading' as const,
    props: { level: 2 as const, textAlignment: 'center' as const },
    content: [
      {
        type: 'text' as const,
        text: 'Harbor plan',
        styles: { bold: true, italic: true, textColor: 'red' },
      },
    ],
    children: [
      {
        id: generateUuidV7(),
        type: 'checkListItem' as const,
        props: { checked: true },
        content: [{ type: 'text' as const, text: 'Secure the docks' }],
      },
    ],
  },
]

describe('CanvasTextEditor', () => {
  it('keeps one canonical BlockNote view across read-only and editing modes', async () => {
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    const onChange = vi.fn()
    const onFinish = vi.fn()
    const view = render(
      <CanvasTextEditor
        content={content}
        editing={false}
        exclusivelySelected
        onChange={onChange}
        onFinish={onFinish}
        selected
        style={{ color: 'rgb(30, 41, 59)' }}
        textColor="rgb(30, 41, 59)"
      />,
    )
    const editor = await screen.findByRole('textbox', { name: 'Canvas text' })
    const surface = editor.closest('.canvas-text-editor')
    if (!(surface instanceof HTMLElement)) throw new Error('Expected canvas text surface')
    const creationCount = createEditor.mock.calls.length
    surface.scrollTop = 24

    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByRole('heading', { level: 2, name: /Harbor plan/ })).toBeVisible()
    const formattedText = screen.getByText('Harbor plan')
    expect(formattedText).toHaveStyle({ color: 'rgb(224, 62, 62)' })
    expect(formattedText.closest('strong')).not.toBeNull()
    expect(formattedText.closest('em')).not.toBeNull()
    expect(screen.getByText(/Secure the docks/)).toBeVisible()

    view.rerender(
      <CanvasTextEditor
        content={content}
        editing
        exclusivelySelected
        onChange={onChange}
        onDefaultTextColorChange={vi.fn()}
        onFinish={onFinish}
        selected
        style={{ color: 'rgb(30, 41, 59)' }}
        textColor="rgb(30, 41, 59)"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Canvas text' })).toBe(editor)
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(screen.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
    expect(surface).toHaveProperty('scrollTop', 24)
    expect(createEditor).toHaveBeenCalledTimes(creationCount)

    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(onFinish).toHaveBeenCalledOnce()
    createEditor.mockRestore()
  })
})
