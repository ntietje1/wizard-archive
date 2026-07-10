import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { WorkspaceContextMenu } from '../context-menu'
import { WorkspaceContextMenuModelSourceProvider } from '../../context-menu-model-source'
import type { BuiltContextMenu } from '../../../context-menu/types'
import type { ContextMenuHostRef } from '../../../context-menu/components/host'
import type { WorkspaceContextMenuModelSource } from '../../context-menu-model-source'

describe('WorkspaceContextMenu', () => {
  it('renders through the supplied context menu model source', () => {
    const source = vi.fn<WorkspaceContextMenuModelSource>(({ children }) => (
      <>
        {children({
          surfaceModel: {
            hostRef: createRef<ContextMenuHostRef>(),
            menu: emptyMenu,
          },
        })}
      </>
    ))

    render(
      <WorkspaceContextMenuModelSourceProvider source={source}>
        <WorkspaceContextMenu viewContext="sidebar">
          <button type="button">Menu target</button>
        </WorkspaceContextMenu>
      </WorkspaceContextMenuModelSourceProvider>,
    )

    expect(screen.getByRole('button', { name: 'Menu target' })).toBeInTheDocument()
    expect(source).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ viewContext: 'sidebar' }),
      }),
      undefined,
    )
  })

  it('preserves disabled target layout without requiring a model source', () => {
    render(
      <WorkspaceContextMenu viewContext="sidebar" disabled className="h-full">
        <button type="button">Disabled target</button>
      </WorkspaceContextMenu>,
    )

    expect(screen.getByRole('button', { name: 'Disabled target' }).closest('.h-full')).toBeVisible()
  })
})

const emptyMenu: BuiltContextMenu = {
  flatItems: [],
  groups: [],
  isEmpty: true,
}
