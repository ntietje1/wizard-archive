import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import type { RightSidebarContentId } from '../content'
import type { RightSidebarAvailablePanels } from '../source'
import type { ResourceKind } from '../../resource-contract'
import { useRightSidebar } from '../use-right-sidebar'
import { useRightSidebarStateStore } from '../state-store'
import { RIGHT_SIDEBAR_PANEL_ID } from '../constants'
import { usePanelPreferenceStore } from '@wizard-archive/ui/panel-preferences/store'

describe('useRightSidebar', () => {
  beforeEach(() => {
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
    useRightSidebarStateStore.setState({ activeContentByItemType: {} })
  })

  it('defaults unsupported content to history for the current item type', () => {
    const rendered: Array<RightSidebarContentId> = []
    useRightSidebarStateStore.setState({
      activeContentByItemType: {
        [RESOURCE_TYPES.files]: RIGHT_SIDEBAR_CONTENT.outline,
      },
    })

    render(<RightSidebarProbe itemType={RESOURCE_TYPES.files} rendered={rendered} />)

    expect(rendered[0]).toBe(RIGHT_SIDEBAR_CONTENT.history)
  })

  it('persists the resolved content when stored content is unsupported for the current item type', async () => {
    useRightSidebarStateStore.setState({
      activeContentByItemType: {
        [RESOURCE_TYPES.files]: RIGHT_SIDEBAR_CONTENT.outline,
      },
    })

    render(<RightSidebarProbe itemType={RESOURCE_TYPES.files} />)

    await waitFor(() => {
      expect(
        useRightSidebarStateStore.getState().activeContentByItemType[RESOURCE_TYPES.files],
      ).toBe(RIGHT_SIDEBAR_CONTENT.history)
    })
  })

  it('closes the panel when the active fallback panel is unavailable for the current item type', async () => {
    usePanelPreferenceStore.setState({
      panels: {
        [RIGHT_SIDEBAR_PANEL_ID]: {
          size: 300,
          visible: true,
        },
      },
      isLoaded: true,
    })

    render(
      <RightSidebarProbe
        availablePanels={{
          [RIGHT_SIDEBAR_CONTENT.outline]: true,
        }}
        itemType={RESOURCE_TYPES.files}
      />,
    )

    await waitFor(() => {
      expect(usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]).toMatchObject({
        visible: false,
      })
    })
  })

  it('defaults safely when there is no current item type', () => {
    const rendered: Array<RightSidebarContentId> = []

    render(<RightSidebarProbe itemType={undefined} rendered={rendered} />)

    expect(rendered[0]).toBe(RIGHT_SIDEBAR_CONTENT.history)
  })

  it('stores the default content when asked to open unsupported content', () => {
    const rendered: Array<ReturnType<typeof useRightSidebar>> = []

    render(<RightSidebarProbe itemType={RESOURCE_TYPES.files} renderedSidebar={rendered} />)

    act(() => {
      rendered[0].open(RIGHT_SIDEBAR_CONTENT.outline)
    })

    expect(useRightSidebarStateStore.getState().activeContentByItemType[RESOURCE_TYPES.files]).toBe(
      RIGHT_SIDEBAR_CONTENT.history,
    )
    expect(usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]).toMatchObject({
      visible: true,
    })
  })
})

const ALL_RIGHT_SIDEBAR_PANELS_AVAILABLE = {
  [RIGHT_SIDEBAR_CONTENT.history]: true,
  [RIGHT_SIDEBAR_CONTENT.backlinks]: true,
  [RIGHT_SIDEBAR_CONTENT.outgoing]: true,
  [RIGHT_SIDEBAR_CONTENT.outline]: true,
} satisfies RightSidebarAvailablePanels

function RightSidebarProbe({
  availablePanels = ALL_RIGHT_SIDEBAR_PANELS_AVAILABLE,
  itemType,
  rendered,
  renderedSidebar,
}: {
  availablePanels?: RightSidebarAvailablePanels
  itemType: ResourceKind | undefined
  rendered?: Array<RightSidebarContentId>
  renderedSidebar?: Array<ReturnType<typeof useRightSidebar>>
}) {
  const sidebar = useRightSidebar(itemType, availablePanels)
  rendered?.push(sidebar.activeContentId)
  renderedSidebar?.push(sidebar)
  return null
}
