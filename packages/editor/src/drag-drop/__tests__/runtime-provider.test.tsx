import { act, render, screen } from '@testing-library/react'
import { use } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DndProviderContext } from '../context'
import { DndRuntimeProvider } from '../runtime-provider'
import { createDisabledExternalFileDropCapability } from '../file-drop'
import { createResourceCatalogModel } from '../../filesystem/catalog'
import { createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import { resetDndStore } from './store-test-utils'

const monitorForElements = vi.fn()
const monitorForExternal = vi.fn()

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  monitorForElements: (args: unknown) => monitorForElements(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  monitorForExternal: (args: unknown) => monitorForExternal(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles: vi.fn(() => true),
}))

type ElementMonitor = {
  onDragStart: (args: {
    source: { data: Record<string, unknown> }
    location: { current: { input: { clientX: number; clientY: number } } }
  }) => void
}

function getElementMonitor() {
  expect(monitorForElements).toHaveBeenCalledTimes(1)
  return monitorForElements.mock.calls[0]?.[0] as ElementMonitor
}

describe('DndRuntimeProvider', () => {
  beforeEach(() => {
    monitorForElements.mockReset()
    monitorForElements.mockReturnValue(vi.fn())
    monitorForExternal.mockReset()
    monitorForExternal.mockReturnValue(vi.fn())
    resetDndStore()
  })

  it('keeps context consumers idle when only drag overlay state changes', () => {
    const note = createNote({
      id: testId<'sidebarItems'>('note_context_identity'),
      campaignId: testCampaignId('campaign_context_identity'),
    })
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    })
    const contextValues: Array<unknown> = []
    function ContextConsumer() {
      contextValues.push(use(DndProviderContext))
      return <span data-testid="dnd-context-consumer" />
    }

    render(
      <DndRuntimeProvider
        catalog={catalog}
        dndContext={{
          executeFileSystemCommand: vi.fn(),
          openItem: vi.fn(),
        }}
        dropPlanningContext={{
          workspaceId: note.campaignId,
          workspaceName: 'Test Campaign',
          canCreateRootItems: true,
          canManageFolders: true,
        }}
        externalFiles={createDisabledExternalFileDropCapability()}
        operationItems={operationItems}
        paths={{ getVisibleItemLinkPath: (item) => [item.name] }}
      >
        <ContextConsumer />
      </DndRuntimeProvider>,
    )

    const initialContext = contextValues[0]

    act(() => {
      getElementMonitor().onDragStart({
        source: {
          data: {
            sidebarItemId: note.id,
            sidebarItemIds: [note.id],
          },
        },
        location: { current: { input: { clientX: 10, clientY: 20 } } },
      })
    })

    expect(screen.getByText(note.name)).toBeInTheDocument()
    expect(contextValues).toEqual([initialContext])
  })

  it('does not monitor external files when external file drops are disabled', () => {
    const note = createNote({
      id: testId<'sidebarItems'>('note_external_disabled'),
      campaignId: testCampaignId('campaign_external_disabled'),
    })
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    })

    render(
      <DndRuntimeProvider
        catalog={catalog}
        dndContext={{
          executeFileSystemCommand: vi.fn(),
          openItem: vi.fn(),
        }}
        dropPlanningContext={{
          workspaceId: note.campaignId,
          workspaceName: 'Test Campaign',
          canCreateRootItems: true,
          canManageFolders: true,
        }}
        externalFiles={createDisabledExternalFileDropCapability()}
        operationItems={operationItems}
        paths={{ getVisibleItemLinkPath: (item) => [item.name] }}
      >
        <span>Editor</span>
      </DndRuntimeProvider>,
    )

    expect(monitorForExternal).not.toHaveBeenCalled()
  })

  it('exposes only runtime drop capabilities through the DnD provider value', () => {
    const note = createNote({
      id: testId<'sidebarItems'>('note_context_shape'),
      campaignId: testCampaignId('campaign_context_shape'),
    })
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    })
    let contextValue: unknown
    function ContextConsumer() {
      contextValue = use(DndProviderContext)
      return <span data-testid="dnd-context-shape" />
    }

    render(
      <DndRuntimeProvider
        catalog={catalog}
        dndContext={{
          executeFileSystemCommand: vi.fn(),
          openItem: vi.fn(),
        }}
        dropPlanningContext={{
          workspaceId: note.campaignId,
          workspaceName: 'Test Campaign',
          canCreateRootItems: true,
          canManageFolders: true,
        }}
        externalFiles={createDisabledExternalFileDropCapability()}
        operationItems={operationItems}
        paths={{ getVisibleItemLinkPath: (item) => [item.name] }}
      >
        <ContextConsumer />
      </DndRuntimeProvider>,
    )

    expect(Object.keys(contextValue as Record<string, unknown>).sort()).toEqual([
      'canAcceptExternalFiles',
      'dispatchDropPayload',
      'getItemLinkPath',
      'runtimeId',
    ])
  })

  it('monitors external files when external file drops are enabled', () => {
    const note = createNote({
      id: testId<'sidebarItems'>('note_external_enabled'),
      campaignId: testCampaignId('campaign_external_enabled'),
    })
    const { catalog, operationItems } = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    })

    render(
      <DndRuntimeProvider
        catalog={catalog}
        dndContext={{
          executeFileSystemCommand: vi.fn(),
          openItem: vi.fn(),
        }}
        dropPlanningContext={{
          workspaceId: note.campaignId,
          workspaceName: 'Test Campaign',
          canCreateRootItems: true,
          canManageFolders: true,
        }}
        externalFiles={{
          status: 'enabled',
          handleDropFiles: vi.fn(() =>
            Promise.resolve({ status: 'completed' as const, receipt: null }),
          ),
        }}
        operationItems={operationItems}
        paths={{ getVisibleItemLinkPath: (item) => [item.name] }}
      >
        <span>Editor</span>
      </DndRuntimeProvider>,
    )

    expect(monitorForExternal).toHaveBeenCalledTimes(1)
  })
})
