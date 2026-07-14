import { testResourceId } from '../../../../../../shared/test/resource-id'
import type { ResourceId } from '../../../resources/domain-id'
import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AnyItem } from '../../items'
import { createWorkspaceResource } from '../../runtime'
import type { BuiltContextMenu } from '../../../context-menu/types'
import type { ContextMenuHostRef } from '../../../context-menu/components/host'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import { createRuntimeRightSidebarSource } from '../runtime-source'
import { WorkspaceContextMenuModelSourceProvider } from '../../context-menu-model-source'
import type { WorkspaceContextMenuModelSource } from '../../context-menu-model-source'
import { createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { createAvailableSearch } from './test-helpers'
import { RightSidebarPanel } from '../panels'

const { openItemMock } = vi.hoisted(() => ({
  openItemMock: vi.fn(),
}))

function sidebarItemId(id: string): ResourceId {
  return testResourceId(id)
}

const resolvedRow = {
  id: 'link-1',
  query: 'Target Note',
  displayName: null,
  item: {
    id: sidebarItemId('target-id'),
    name: 'Target Note',
  },
}

describe('link sidebar panels', () => {
  beforeEach(() => {
    openItemMock.mockReset()
  })

  it('renders outgoing links from runtime search and navigates resolved rows', () => {
    const getItemLinks = vi.fn(() => ({ status: 'success' as const, links: [resolvedRow] }))
    const panel = renderLinkPanel({
      panelId: RIGHT_SIDEBAR_CONTENT.outgoing,
      search: createAvailableSearch({ getItemLinks }),
    })

    render(panel)

    fireEvent.click(screen.getByRole('button', { name: /Target Note/ }))

    expect(getItemLinks).toHaveBeenCalledWith({
      itemId: sidebarItemId('source-id'),
      kind: 'outgoing',
    })
    expect(openItemMock).toHaveBeenCalledWith(createWorkspaceResource(sidebarItemId('target-id')))
  })

  it('renders unresolved outgoing link labels', () => {
    const panel = renderLinkPanel({
      panelId: RIGHT_SIDEBAR_CONTENT.outgoing,
      search: createAvailableSearch({
        getItemLinks: () => ({
          status: 'success',
          links: [
            {
              ...resolvedRow,
              id: 'link-2',
              query: 'Missing Note',
              item: null,
            },
          ],
        }),
      }),
    })

    render(panel)

    expect(screen.getByText('Missing Note')).toBeInTheDocument()
    expect(screen.getByText('Unresolved link')).toBeInTheDocument()
  })

  it('renders backlink rows from runtime search', () => {
    const getItemLinks = vi.fn(() => ({ status: 'success' as const, links: [resolvedRow] }))
    const panel = renderLinkPanel({
      itemId: sidebarItemId('target-id'),
      panelId: RIGHT_SIDEBAR_CONTENT.backlinks,
      search: createAvailableSearch({ getItemLinks }),
    })

    render(panel)

    expect(screen.getByRole('button', { name: /Target Note/ })).toBeInTheDocument()
    expect(getItemLinks).toHaveBeenCalledWith({
      itemId: sidebarItemId('target-id'),
      kind: 'backlinks',
    })
  })

  it('uses the workspace context menu model for resolved link rows', () => {
    const target = createNote({ id: sidebarItemId('target-id'), name: 'Target Note' })
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
    const panel = renderLinkPanel({
      activeItems: [target],
      panelId: RIGHT_SIDEBAR_CONTENT.outgoing,
      search: createAvailableSearch({
        getItemLinks: () => ({ status: 'success', links: [resolvedRow] }),
      }),
    })

    render(
      <WorkspaceContextMenuModelSourceProvider source={source}>
        {panel}
      </WorkspaceContextMenuModelSourceProvider>,
    )

    expect(source).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          item: target,
          viewContext: 'search-results',
        }),
      }),
      undefined,
    )
  })
})

function renderLinkPanel({
  activeItems,
  itemId = sidebarItemId('source-id'),
  panelId,
  search,
}: {
  activeItems?: Array<AnyItem>
  itemId?: ResourceId
  panelId: typeof RIGHT_SIDEBAR_CONTENT.backlinks | typeof RIGHT_SIDEBAR_CONTENT.outgoing
  search: ReturnType<typeof createAvailableSearch>
}) {
  const runtime = createTestWorkspaceRuntime({
    activeItems,
    navigation: { openItem: openItemMock },
    search,
  })
  const source = createRuntimeRightSidebarSource(runtime, { navigateToHeading: vi.fn() })

  return <RightSidebarPanel contentId={panelId} itemId={itemId} source={source} />
}

const emptyMenu: BuiltContextMenu = {
  flatItems: [],
  groups: [],
  isEmpty: true,
}
