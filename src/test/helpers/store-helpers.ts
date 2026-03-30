import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

export function resetSidebarUIStore() {
  useSidebarUIStore.setState({
    campaignStates: {},
    renamingId: null,
    pendingItemName: '',
    selectedSlug: null,
    viewAsPlayerId: null,
  })
}
