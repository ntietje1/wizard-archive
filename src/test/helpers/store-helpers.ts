import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

export function resetSidebarUIStore() {
  useSidebarUIStore.setState({
    campaignStates: {},
    renamingId: null,
    pendingItemName: '',
    selectedSlug: null,
    selectedItemIds: [],
    anchorItemId: null,
    selectionSurface: null,
    activeItemSurface: null,
    itemClipboard: null,
    viewAsPlayerId: null,
  })
}
