import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { SidebarShareButton } from '../sidebar-item-share-button'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemsValue } from '~/features/sidebar/hooks/useSidebarItems'
import { SidebarItemsContext } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createNote } from '~/test/factories/sidebar-item-factory'

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ isDm: true }),
}))

vi.mock('~/features/sharing/components/sidebar-items-share-panel', () => ({
  SidebarItemsSharePanel: ({ items }: { items: Array<AnySidebarItem> }) => (
    <div data-testid="share-panel">{items.map((item) => item.name).join(', ')}</div>
  ),
}))

function sidebarItemsValue(items: Array<AnySidebarItem>): SidebarItemsValue {
  return {
    data: items,
    status: 'success',
    ...buildSidebarItemMaps(items),
  }
}

function renderShareButton(item: AnySidebarItem, activeItems: Array<AnySidebarItem>) {
  return render(
    <SidebarItemsContext.Provider
      value={{
        [SIDEBAR_ITEM_LOCATION.sidebar]: sidebarItemsValue(activeItems),
        [SIDEBAR_ITEM_LOCATION.trash]: sidebarItemsValue([]),
      }}
    >
      <SidebarShareButton item={item} />
    </SidebarItemsContext.Provider>,
  )
}

describe('SidebarShareButton', () => {
  afterEach(() => {
    useSidebarUIStore.setState({
      selectedItemIds: [],
      anchorItemId: null,
      focusedItemId: null,
      selectionSurface: null,
      focusSurface: null,
      activeItemSurface: null,
    })
  })

  it('shares the selected item group when the row belongs to the current selection', async () => {
    const user = userEvent.setup()
    const first = createNote({ name: 'First' })
    const second = createNote({ name: 'Second' })
    useSidebarUIStore.setState({
      selectedItemIds: [first._id, second._id],
      anchorItemId: first._id,
    })

    renderShareButton(first, [first, second])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('First, Second')
  })

  it('shares only the clicked row when the row is outside the current selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    const clicked = createNote({ name: 'Clicked' })
    useSidebarUIStore.setState({
      selectedItemIds: [selected._id],
      anchorItemId: selected._id,
    })

    renderShareButton(clicked, [selected, clicked])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })

  it('shares the clicked row when there is no item selection', async () => {
    const user = userEvent.setup()
    const clicked = createNote({ name: 'Clicked' })

    renderShareButton(clicked, [clicked])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })

  it('shares a single selected item when the row belongs to that selection', async () => {
    const user = userEvent.setup()
    const selected = createNote({ name: 'Selected' })
    useSidebarUIStore.setState({
      selectedItemIds: [selected._id],
      anchorItemId: selected._id,
    })

    renderShareButton(selected, [selected])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Selected')
  })

  it('falls back to the clicked row when active sidebar data is stale', async () => {
    const user = userEvent.setup()
    const clicked = createNote({ name: 'Clicked' })
    useSidebarUIStore.setState({
      selectedItemIds: [clicked._id],
      anchorItemId: clicked._id,
    })

    renderShareButton(clicked, [])

    await user.click(screen.getByRole('button', { name: 'Share' }))

    expect(await screen.findByTestId('share-panel')).toHaveTextContent('Clicked')
  })
})
