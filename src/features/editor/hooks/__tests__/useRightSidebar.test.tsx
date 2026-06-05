import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/components/right-sidebar/constants'
import type { RightSidebarContentId } from '~/features/editor/components/right-sidebar/constants'
import type { RightSidebarItemType } from '~/features/editor/components/right-sidebar/right-sidebar-model'
import { useRightSidebar } from '~/features/editor/hooks/useRightSidebar'
import { useRightSidebarStateStore } from '~/features/editor/stores/right-sidebar-state-store'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutate: mutateMock }),
}))

describe('useRightSidebar', () => {
  beforeEach(() => {
    mutateMock.mockClear()
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
    useRightSidebarStateStore.setState({ activeContentByItemType: {} })
  })

  it('defaults unsupported content to history for the current item type', () => {
    const rendered: Array<RightSidebarContentId> = []
    useRightSidebarStateStore.setState({
      activeContentByItemType: {
        [SIDEBAR_ITEM_TYPES.files]: RIGHT_SIDEBAR_CONTENT.outline,
      },
    })

    render(<RightSidebarProbe itemType={SIDEBAR_ITEM_TYPES.files} rendered={rendered} />)

    expect(rendered[0]).toBe(RIGHT_SIDEBAR_CONTENT.history)
  })

  it('stores the default content when asked to open unsupported content', () => {
    const rendered: Array<ReturnType<typeof useRightSidebar>> = []

    render(<RightSidebarProbe itemType={SIDEBAR_ITEM_TYPES.files} renderedSidebar={rendered} />)

    act(() => {
      rendered[0].open(RIGHT_SIDEBAR_CONTENT.outline)
    })

    expect(
      useRightSidebarStateStore.getState().activeContentByItemType[SIDEBAR_ITEM_TYPES.files],
    ).toBe(RIGHT_SIDEBAR_CONTENT.history)
    expect(usePanelPreferenceStore.getState().panels['editor-right-sidebar']).toMatchObject({
      visible: true,
    })
  })
})

function RightSidebarProbe({
  itemType,
  rendered,
  renderedSidebar,
}: {
  itemType: RightSidebarItemType
  rendered?: Array<RightSidebarContentId>
  renderedSidebar?: Array<ReturnType<typeof useRightSidebar>>
}) {
  const sidebar = useRightSidebar(itemType)
  rendered?.push(sidebar.activeContentId)
  renderedSidebar?.push(sidebar)
  return null
}
