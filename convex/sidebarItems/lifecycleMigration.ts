import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
} from '@wizard-archive/editor/resources/items-persistence-contract'

const LEGACY_TRASH_LOCATION = 'trash'

type SidebarItemLifecycleMigrationInput = {
  location?: string
  status?: string
}

export function getSidebarItemLifecycleMigrationPatch(item: SidebarItemLifecycleMigrationInput) {
  const status = getMigratedSidebarItemStatus(item)

  if (item.location === RESOURCE_LOCATION.sidebar && item.status === status) {
    return null
  }

  return {
    location: RESOURCE_LOCATION.sidebar,
    status,
  }
}

function getMigratedSidebarItemStatus(item: SidebarItemLifecycleMigrationInput) {
  if (
    item.status === RESOURCE_STATUS.active ||
    item.status === RESOURCE_STATUS.trashed ||
    item.status === RESOURCE_STATUS.undoHidden
  ) {
    return item.status
  }

  return item.location === LEGACY_TRASH_LOCATION ? RESOURCE_STATUS.trashed : RESOURCE_STATUS.active
}
