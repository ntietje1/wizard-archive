import { act, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { TRASH_DROP_ZONE_TYPE } from '../../../../drag-drop/drop-target-data'
import { createDndStore, DndStoreContext } from '../../../../drag-drop/store'
import { TrashButton } from '../trash-button'

const dropTargetCalls = vi.hoisted(
  () =>
    [] as Array<{
      canDrop?: boolean
      data: Record<string, unknown>
    }>,
)

vi.mock('../../../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: (options: { canDrop?: boolean; data: Record<string, unknown> }) => {
    dropTargetCalls.push(options)
    return { dropTargetRef: vi.fn(), dropTargetKey: 'trash-drop-zone', isDropTarget: false }
  },
}))

vi.mock('../trash-popover-content', () => ({
  TrashPopoverContent: () => <div data-testid="trash-popover-content" />,
}))

describe('TrashButton', () => {
  beforeEach(() => {
    dropTargetCalls.length = 0
  })

  it('registers the sidebar trash button as a filesystem drop target without a source permission gate', () => {
    render(<TrashButton source={createTrashButtonSource()} />)

    expect(dropTargetCalls.at(-1)).toEqual({
      data: { type: TRASH_DROP_ZONE_TYPE },
    })
  })

  it('renders the trash count badge when trash has items', () => {
    render(<TrashButton source={createTrashButtonSource({ getItemCount: () => 3 })} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('omits the trash count badge when trash is empty', () => {
    render(<TrashButton source={createTrashButtonSource()} />)

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('marks the row active when trash view is active', () => {
    render(<TrashButton source={createTrashButtonSource({ isTrashActive: () => true })} />)

    expect(screen.getByRole('button', { name: 'Trash' })).toHaveAttribute('data-active', 'true')
  })

  it('marks the row active while the popover is open', async () => {
    const user = userEvent.setup()
    render(<TrashButton source={createTrashButtonSource()} />)

    await user.click(screen.getByRole('button', { name: 'Trash' }))

    expect(screen.getByRole('button', { name: 'Trash' })).toHaveAttribute('data-active', 'true')
  })

  it('toggles the popover closed from the trigger', async () => {
    const user = userEvent.setup()
    render(<TrashButton source={createTrashButtonSource()} />)

    const button = screen.getByRole('button', { name: 'Trash' })
    await user.click(button)
    expect(screen.getByTestId('trash-popover-content')).toBeInTheDocument()

    await user.click(button)
    expect(screen.queryByTestId('trash-popover-content')).not.toBeInTheDocument()
  })

  it('closes the popover when an element drag starts', async () => {
    const user = userEvent.setup()
    const store = createDndStore()

    render(
      <DndStoreContext.Provider value={store}>
        <TrashButton source={createTrashButtonSource()} />
      </DndStoreContext.Provider>,
    )

    await user.click(screen.getByRole('button', { name: 'Trash' }))
    expect(screen.getByTestId('trash-popover-content')).toBeInTheDocument()

    act(() => {
      store.getState().setIsDraggingElement(true)
    })

    expect(screen.queryByTestId('trash-popover-content')).not.toBeInTheDocument()
  })
})

function createTrashButtonSource(
  overrides: Partial<ComponentProps<typeof TrashButton>['source']> = {},
): ComponentProps<typeof TrashButton>['source'] {
  return {
    canDragItem: () => false,
    canDeleteItemForever: () => true,
    canEmptyTrash: () => false,
    canRestoreItem: () => true,
    getItemCount: () => 0,
    getRootItems: () => [],
    getSidebarDragData: (item) => ({
      dragPreviewItemIds: [item.id],
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
    }),
    isTrashActive: () => false,
    openItem: vi.fn(),
    openTrash: vi.fn(),
    requestDeleteItemsForever: vi.fn(),
    requestEmptyTrash: vi.fn(),
    restoreItems: vi.fn(),
    ...overrides,
  }
}
