import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { testResourceId } from '../../../../../../shared/test/resource-id'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { FileSystemPermanentDeleteDialog } from '../dialogs'

describe('FileSystemPermanentDeleteDialog', () => {
  it('describes descendant deletion when permanently deleting selected folders', () => {
    const folder = createFolder({ id: testResourceId('folder_with_child'), name: 'Scenes' })
    const child = createNote({ parentId: folder.id, name: 'Hidden Room' })
    const note = createNote({ id: testResourceId('loose_note'), name: 'Loose Note' })

    render(
      <FileSystemPermanentDeleteDialog
        items={[folder, note]}
        trashState={{ items: [folder, child, note], status: 'success' }}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(
      screen.getByText(
        'This will permanently delete 2 selected items and 1 item inside selected folders. This action cannot be undone.',
      ),
    ).toBeInTheDocument()
  })

  it.each([
    {
      name: 'a leaf item',
      items: [createNote({ id: testResourceId('trashed_note'), name: 'Loose Note' })],
    },
    {
      name: 'selected leaf items',
      items: [
        createNote({ id: testResourceId('first_trashed_note'), name: 'First Note' }),
        createNote({ id: testResourceId('second_trashed_note'), name: 'Second Note' }),
      ],
    },
  ])(
    'confirms permanent deletion for $name when trash contents fail to load',
    async ({ items }) => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()

      render(
        <FileSystemPermanentDeleteDialog
          items={items}
          trashState={{ items: [], status: 'error' }}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Delete Forever' }))

      expect(onConfirm).toHaveBeenCalledOnce()
    },
  )

  it('blocks permanent deletion for folders when trash contents fail to load', async () => {
    const user = userEvent.setup()
    const folder = createFolder({ id: testResourceId('trashed_folder'), name: 'Scenes' })
    const onConfirm = vi.fn()

    render(
      <FileSystemPermanentDeleteDialog
        items={[folder]}
        trashState={{ items: [], status: 'error' }}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText('Trash contents could not be loaded.')).toBeInTheDocument()

    const deleteButton = screen.getByRole('button', { name: 'Delete Forever' })
    expect(deleteButton).toBeDisabled()

    await user.click(deleteButton)

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
