import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createGameMap } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { RuntimeMapEditDialog } from '../runtime-edit-dialogs'

const mapDialogProps = vi.hoisted(() => ({
  current: null as null | { onSuccess?: () => void },
}))

vi.mock('../../../game-maps/forms/dialog', async () => {
  const React = await import('react')
  return {
    MapDialog: (props: { onSuccess?: () => void }) => {
      mapDialogProps.current = props
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => props.onSuccess?.(),
        },
        'Save map',
      )
    },
  }
})

describe('RuntimeMapEditDialog', () => {
  it('closes after the map form saves successfully', () => {
    const map = createGameMap({
      id: testId<'sidebarItems'>('map_1'),
      name: 'Dungeon',
    })
    const onClose = vi.fn()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [map],
      item: map,
    })

    render(<RuntimeMapEditDialog mapId={map.id} onClose={onClose} runtime={runtime} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save map' }))

    expect(mapDialogProps.current?.onSuccess).toBe(onClose)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
