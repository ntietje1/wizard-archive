import { BlockNoteEditor } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/shadcn'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { RichTextBlockContextMenu } from '../block-context-menu'

let editor: BlockNoteEditor | null = null

afterEach(() => {
  editor?._tiptapEditor.destroy()
  editor = null
})

describe('RichTextBlockContextMenu', () => {
  it('opens the shared block actions for the clicked block', async () => {
    editor = BlockNoteEditor.create({
      initialContent: [{ id: 'target-block', type: 'paragraph', content: 'Target' }],
    })
    const block = editor.document[0]!
    const onCopyLink = vi.fn()
    const onDuplicate = vi.fn()
    const onOpenVisibility = vi.fn()

    render(
      <RichTextBlockContextMenu
        editor={editor}
        enabled
        onCopyLink={onCopyLink}
        onDuplicate={onDuplicate}
        onOpenVisibility={onOpenVisibility}
      >
        <TestBlockNoteView editor={editor} />
      </RichTextBlockContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Target'), { clientX: 24, clientY: 36 })

    expect(await screen.findByTestId('block-context-menu')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Turn into' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Color' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Visibility...' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Copy link to block' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link to block' }))
    expect(onCopyLink).toHaveBeenCalledWith(block)
  })

  it('runs a block mutation once', async () => {
    editor = BlockNoteEditor.create({
      initialContent: [{ id: 'target-block', type: 'paragraph', content: 'Target' }],
    })
    const onDuplicate = vi.fn()

    render(
      <RichTextBlockContextMenu editor={editor} enabled onDuplicate={onDuplicate}>
        <TestBlockNoteView editor={editor} />
      </RichTextBlockContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Target'), { clientX: 24, clientY: 36 })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))

    expect(onDuplicate).toHaveBeenCalledOnce()
  })

  it('does not replace a nested specialized context menu', () => {
    editor = BlockNoteEditor.create({
      initialContent: [{ id: 'target-block', type: 'paragraph', content: 'Target' }],
    })

    render(
      <RichTextBlockContextMenu editor={editor} enabled onDuplicate={vi.fn()}>
        <TestBlockNoteView editor={editor} />
      </RichTextBlockContextMenu>,
    )
    const target = screen.getByText('Target')
    target.dataset.slot = 'context-menu-trigger'

    fireEvent.contextMenu(target)

    expect(screen.queryByTestId('block-context-menu')).not.toBeInTheDocument()
  })
})

function TestBlockNoteView({ editor: blockEditor }: { editor: BlockNoteEditor }) {
  return (
    <BlockNoteView
      editor={blockEditor}
      formattingToolbar={false}
      linkToolbar={false}
      sideMenu={false}
      slashMenu={false}
    />
  )
}
