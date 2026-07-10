import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { use } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { BlockNoteContextMenuContext } from '../blocknote-context-menu'
import { BlockNoteContextMenuProvider } from '../provider'

vi.mock('../../../workspace/context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ item }: { item?: { name?: string } }) => (
    <div data-testid="workspace-context-menu">{item?.name ?? 'empty'}</div>
  ),
}))

describe('BlockNoteContextMenuProvider', () => {
  it('opens only the provider instance that receives the local request', async () => {
    const user = userEvent.setup()

    render(
      <>
        <BlockNoteContextMenuProvider>
          <OpenContextMenuButton itemName="first surface" />
        </BlockNoteContextMenuProvider>
        <BlockNoteContextMenuProvider>
          <OpenContextMenuButton itemName="second surface" />
        </BlockNoteContextMenuProvider>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Open first surface menu' }))

    expect(screen.getAllByTestId('workspace-context-menu')).toHaveLength(1)
    expect(screen.getByTestId('workspace-context-menu')).toHaveTextContent('first surface')
  })
})

function OpenContextMenuButton({ itemName }: { itemName: string }) {
  const contextMenu = use(BlockNoteContextMenuContext)

  return (
    <button
      type="button"
      onClick={() =>
        contextMenu?.openMenu({
          position: { x: 10, y: 20 },
          surface: 'note-view',
          item: { name: itemName } as never,
        })
      }
    >
      Open {itemName} menu
    </button>
  )
}
