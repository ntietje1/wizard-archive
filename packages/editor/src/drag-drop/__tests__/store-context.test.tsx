import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vite-plus/test'
import { DndStoreContext, createDndStore, useDndStore } from '../store'
import { testId } from '../../test/id'
import type { SidebarItemId } from '../../../../../shared/common/ids'

function DragPreviewProbe({ itemId, label }: { itemId: SidebarItemId; label: string }) {
  const previewItemIds = useDndStore((state) => state.dragPreviewItemIds)
  const setDragPreviewItemIds = useDndStore((state) => state.setDragPreviewItemIds)

  return (
    <button type="button" onClick={() => setDragPreviewItemIds([itemId])}>
      {label}: {previewItemIds.join(',') || 'empty'}
    </button>
  )
}

describe('drag-drop store context', () => {
  it('scopes drag state to the nearest runtime store', async () => {
    const firstStore = createDndStore()
    const secondStore = createDndStore()
    const firstItemId = testId<'sidebarItems'>('note_first')
    const secondItemId = testId<'sidebarItems'>('note_second')

    render(
      <>
        <DndStoreContext.Provider value={firstStore}>
          <DragPreviewProbe itemId={firstItemId} label="First runtime" />
        </DndStoreContext.Provider>
        <DndStoreContext.Provider value={secondStore}>
          <DragPreviewProbe itemId={secondItemId} label="Second runtime" />
        </DndStoreContext.Provider>
      </>,
    )

    await userEvent.click(screen.getByRole('button', { name: /First runtime/ }))

    expect(screen.getByRole('button', { name: `First runtime: ${firstItemId}` })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Second runtime: empty' })).toBeVisible()
    expect(secondStore.getState().dragPreviewItemIds).toEqual([])
  })
})
